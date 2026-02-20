using System.Globalization;
using System.Text.Json;
using backend.Models;
using Microsoft.Data.SqlClient;
using Microsoft.Extensions.Configuration;

namespace backend.Services;

public interface ICustomerManufacturingSqlService
{
    Task<PagedResponse<CustomerResponse>> GetCustomersAsync(string? search, int limit, int offset, CancellationToken cancellationToken = default);
    Task<CustomerResponse?> GetCustomerByIdAsync(Guid customerId, CancellationToken cancellationToken = default);
    Task<CustomerResponse> CreateCustomerAsync(CustomerUpsertRequest request, CancellationToken cancellationToken = default);
    Task<CustomerResponse?> UpdateCustomerAsync(Guid customerId, CustomerUpsertRequest request, CancellationToken cancellationToken = default);
    Task<bool> DeleteCustomerAsync(Guid customerId, CancellationToken cancellationToken = default);
    Task<bool> AppendCustomerNoteAsync(Guid customerId, string note, CancellationToken cancellationToken = default);
    Task<IReadOnlyList<CustomerActivityResponse>> GetCustomerActivityAsync(Guid customerId, int limit, CancellationToken cancellationToken = default);

    Task<PagedResponse<ManufacturingProjectSummaryResponse>> GetManufacturingProjectsAsync(
        string? search,
        string? status,
        Guid? customerId,
        int limit,
        int offset,
        CancellationToken cancellationToken = default);
    Task<ManufacturingProjectDetailResponse?> GetManufacturingProjectByIdAsync(int projectId, CancellationToken cancellationToken = default);
    Task<ManufacturingProjectDetailResponse> CreateManufacturingProjectAsync(
        ManufacturingProjectUpsertRequest request,
        CancellationToken cancellationToken = default);
    Task<ManufacturingProjectDetailResponse?> UpdateManufacturingProjectAsync(
        int projectId,
        ManufacturingProjectUpsertRequest request,
        CancellationToken cancellationToken = default);
    Task<bool> DeleteManufacturingProjectAsync(int projectId, CancellationToken cancellationToken = default);

    Task<AnalyticsOverviewResponse> GetAnalyticsAsync(CancellationToken cancellationToken = default);
}

public sealed class CustomerManufacturingSqlService : ICustomerManufacturingSqlService
{
    private readonly string _connectionString;

    public CustomerManufacturingSqlService(IConfiguration configuration)
    {
        _connectionString = configuration["SqlConnection"]
            ?? throw new InvalidOperationException("Missing SqlConnection configuration value.");
    }

    public async Task<PagedResponse<CustomerResponse>> GetCustomersAsync(
        string? search,
        int limit,
        int offset,
        CancellationToken cancellationToken = default)
    {
        (limit, offset) = NormalizePaging(limit, offset);

        var whereClause = BuildCustomerSearchWhereClause(search);
        var countSql = $"SELECT COUNT(*) FROM dbo.customers c {whereClause};";
        var listSql = $"""
            SELECT
                c.id,
                c.name,
                c.nickname,
                c.email,
                c.phone,
                c.address,
                c.notes,
                c.photo_url,
                c.customer_since,
                c.created_at_utc,
                c.updated_at_utc,
                COALESCE(s.total_spent, 0) AS total_spent,
                COALESCE(s.purchase_count, 0) AS purchase_count
            FROM dbo.customers c
            OUTER APPLY (
                SELECT
                    SUM(COALESCE(mp.selling_price, 0)) AS total_spent,
                    COUNT(*) AS purchase_count
                FROM dbo.manufacturing_projects mp
                WHERE mp.customer_id = c.id
                  AND mp.status = 'sold'
            ) s
            {whereClause}
            ORDER BY c.created_at_utc DESC, c.name
            OFFSET @Offset ROWS FETCH NEXT @Limit ROWS ONLY;
            """;

        await using var conn = new SqlConnection(_connectionString);
        await conn.OpenAsync(cancellationToken);

        int totalCount;
        await using (var countCmd = new SqlCommand(countSql, conn))
        {
            ApplyCustomerSearchParams(countCmd, search);
            totalCount = Convert.ToInt32(await countCmd.ExecuteScalarAsync(cancellationToken) ?? 0);
        }

        var items = new List<CustomerResponse>();
        await using (var listCmd = new SqlCommand(listSql, conn))
        {
            ApplyCustomerSearchParams(listCmd, search);
            listCmd.Parameters.AddWithValue("@Offset", offset);
            listCmd.Parameters.AddWithValue("@Limit", limit);

            await using var reader = await listCmd.ExecuteReaderAsync(cancellationToken);
            while (await reader.ReadAsync(cancellationToken))
            {
                items.Add(MapCustomer(reader));
            }
        }

        return new PagedResponse<CustomerResponse>(items, totalCount, limit, offset);
    }

    public async Task<CustomerResponse?> GetCustomerByIdAsync(Guid customerId, CancellationToken cancellationToken = default)
    {
        const string sql = """
            SELECT
                c.id,
                c.name,
                c.nickname,
                c.email,
                c.phone,
                c.address,
                c.notes,
                c.photo_url,
                c.customer_since,
                c.created_at_utc,
                c.updated_at_utc,
                COALESCE(s.total_spent, 0) AS total_spent,
                COALESCE(s.purchase_count, 0) AS purchase_count
            FROM dbo.customers c
            OUTER APPLY (
                SELECT
                    SUM(COALESCE(mp.selling_price, 0)) AS total_spent,
                    COUNT(*) AS purchase_count
                FROM dbo.manufacturing_projects mp
                WHERE mp.customer_id = c.id
                  AND mp.status = 'sold'
            ) s
            WHERE c.id = @CustomerId;
            """;

        await using var conn = new SqlConnection(_connectionString);
        await conn.OpenAsync(cancellationToken);

        await using var cmd = new SqlCommand(sql, conn);
        cmd.Parameters.AddWithValue("@CustomerId", customerId);

        await using var reader = await cmd.ExecuteReaderAsync(cancellationToken);
        if (!await reader.ReadAsync(cancellationToken))
        {
            return null;
        }

        return MapCustomer(reader);
    }

    public async Task<CustomerResponse> CreateCustomerAsync(CustomerUpsertRequest request, CancellationToken cancellationToken = default)
    {
        var normalizedName = NormalizeRequired(request.Name, "Customer name is required.");

        const string sql = """
            INSERT INTO dbo.customers (
                name,
                nickname,
                email,
                phone,
                address,
                notes,
                photo_url,
                customer_since,
                updated_at_utc
            )
            OUTPUT INSERTED.id
            VALUES (
                @Name,
                @Nickname,
                @Email,
                @Phone,
                @Address,
                @Notes,
                @PhotoUrl,
                @CustomerSince,
                SYSUTCDATETIME()
            );
            """;

        await using var conn = new SqlConnection(_connectionString);
        await conn.OpenAsync(cancellationToken);

        Guid createdId;
        await using (var cmd = new SqlCommand(sql, conn))
        {
            cmd.Parameters.AddWithValue("@Name", normalizedName);
            cmd.Parameters.AddWithValue("@Nickname", DbNullIfEmpty(request.Nickname));
            cmd.Parameters.AddWithValue("@Email", DbNullIfEmpty(request.Email));
            cmd.Parameters.AddWithValue("@Phone", DbNullIfEmpty(request.Phone));
            cmd.Parameters.AddWithValue("@Address", DbNullIfEmpty(request.Address));
            cmd.Parameters.AddWithValue("@Notes", DbNullIfEmpty(request.Notes));
            cmd.Parameters.AddWithValue("@PhotoUrl", DbNullIfEmpty(request.PhotoUrl));
            cmd.Parameters.AddWithValue("@CustomerSince", DbValue(request.CustomerSince));
            createdId = (Guid)(await cmd.ExecuteScalarAsync(cancellationToken) ?? Guid.Empty);
        }

        var created = await GetCustomerByIdAsync(createdId, cancellationToken);
        if (created is null)
        {
            throw new InvalidOperationException("Customer was created but could not be read back.");
        }

        return created;
    }

    public async Task<CustomerResponse?> UpdateCustomerAsync(
        Guid customerId,
        CustomerUpsertRequest request,
        CancellationToken cancellationToken = default)
    {
        var existing = await GetCustomerByIdAsync(customerId, cancellationToken);
        if (existing is null)
        {
            return null;
        }

        var normalizedName = string.IsNullOrWhiteSpace(request.Name)
            ? existing.Name
            : request.Name.Trim();
        var customerSince = request.CustomerSince ?? existing.CustomerSince;

        const string sql = """
            UPDATE dbo.customers
            SET
                name = @Name,
                nickname = @Nickname,
                email = @Email,
                phone = @Phone,
                address = @Address,
                notes = @Notes,
                photo_url = @PhotoUrl,
                customer_since = @CustomerSince,
                updated_at_utc = SYSUTCDATETIME()
            WHERE id = @CustomerId;
            """;

        await using var conn = new SqlConnection(_connectionString);
        await conn.OpenAsync(cancellationToken);

        await using (var cmd = new SqlCommand(sql, conn))
        {
            cmd.Parameters.AddWithValue("@CustomerId", customerId);
            cmd.Parameters.AddWithValue("@Name", normalizedName);
            cmd.Parameters.AddWithValue("@Nickname", request.Nickname is null ? DbNullIfEmpty(existing.Nickname) : DbNullIfEmpty(request.Nickname));
            cmd.Parameters.AddWithValue("@Email", request.Email is null ? DbNullIfEmpty(existing.Email) : DbNullIfEmpty(request.Email));
            cmd.Parameters.AddWithValue("@Phone", request.Phone is null ? DbNullIfEmpty(existing.Phone) : DbNullIfEmpty(request.Phone));
            cmd.Parameters.AddWithValue("@Address", request.Address is null ? DbNullIfEmpty(existing.Address) : DbNullIfEmpty(request.Address));
            cmd.Parameters.AddWithValue("@Notes", request.Notes is null ? DbNullIfEmpty(existing.Notes) : DbNullIfEmpty(request.Notes));
            cmd.Parameters.AddWithValue("@PhotoUrl", request.PhotoUrl is null ? DbNullIfEmpty(existing.PhotoUrl) : DbNullIfEmpty(request.PhotoUrl));
            cmd.Parameters.AddWithValue("@CustomerSince", DbValue(customerSince));
            var rows = await cmd.ExecuteNonQueryAsync(cancellationToken);
            if (rows <= 0)
            {
                return null;
            }
        }

        return await GetCustomerByIdAsync(customerId, cancellationToken);
    }

    public async Task<bool> DeleteCustomerAsync(Guid customerId, CancellationToken cancellationToken = default)
    {
        const string sql = "DELETE FROM dbo.customers WHERE id = @CustomerId;";

        await using var conn = new SqlConnection(_connectionString);
        await conn.OpenAsync(cancellationToken);

        await using var cmd = new SqlCommand(sql, conn);
        cmd.Parameters.AddWithValue("@CustomerId", customerId);
        var rows = await cmd.ExecuteNonQueryAsync(cancellationToken);
        return rows > 0;
    }

    public async Task<bool> AppendCustomerNoteAsync(Guid customerId, string note, CancellationToken cancellationToken = default)
    {
        var normalizedNote = NormalizeRequired(note, "Customer note is required.");
        var noteEntry = $"[{DateTime.UtcNow:O}] {normalizedNote}";

        const string sql = """
            UPDATE dbo.customers
            SET
                notes = CASE
                    WHEN notes IS NULL OR LTRIM(RTRIM(notes)) = '' THEN @NoteEntry
                    ELSE CONCAT(notes, CHAR(10), CHAR(10), @NoteEntry)
                END,
                updated_at_utc = SYSUTCDATETIME()
            WHERE id = @CustomerId;
            """;

        await using var conn = new SqlConnection(_connectionString);
        await conn.OpenAsync(cancellationToken);

        await using var cmd = new SqlCommand(sql, conn);
        cmd.Parameters.AddWithValue("@CustomerId", customerId);
        cmd.Parameters.AddWithValue("@NoteEntry", noteEntry);
        var rows = await cmd.ExecuteNonQueryAsync(cancellationToken);
        return rows > 0;
    }

    public async Task<IReadOnlyList<CustomerActivityResponse>> GetCustomerActivityAsync(
        Guid customerId,
        int limit,
        CancellationToken cancellationToken = default)
    {
        const string sql = """
            SELECT TOP (@Limit)
                l.id,
                l.project_id,
                p.manufacturing_code,
                p.piece_name,
                l.status,
                l.activity_at_utc,
                l.craftsman_name,
                l.notes
            FROM dbo.manufacturing_activity_log l
            INNER JOIN dbo.manufacturing_projects p
                ON p.id = l.project_id
            WHERE p.customer_id = @CustomerId
            ORDER BY l.activity_at_utc DESC, l.id DESC;
            """;

        await using var conn = new SqlConnection(_connectionString);
        await conn.OpenAsync(cancellationToken);

        var items = new List<CustomerActivityResponse>();
        await using var cmd = new SqlCommand(sql, conn);
        cmd.Parameters.AddWithValue("@CustomerId", customerId);
        cmd.Parameters.AddWithValue("@Limit", Math.Clamp(limit, 1, 200));

        await using var reader = await cmd.ExecuteReaderAsync(cancellationToken);
        while (await reader.ReadAsync(cancellationToken))
        {
            items.Add(new CustomerActivityResponse
            {
                Id = GetInt32(reader, "id"),
                ProjectId = GetInt32(reader, "project_id"),
                ManufacturingCode = GetString(reader, "manufacturing_code"),
                PieceName = GetString(reader, "piece_name"),
                Status = GetString(reader, "status"),
                ActivityAtUtc = GetDateTime(reader, "activity_at_utc"),
                CraftsmanName = GetNullableString(reader, "craftsman_name"),
                Notes = GetNullableString(reader, "notes"),
            });
        }

        return items;
    }

    public async Task<PagedResponse<ManufacturingProjectSummaryResponse>> GetManufacturingProjectsAsync(
        string? search,
        string? status,
        Guid? customerId,
        int limit,
        int offset,
        CancellationToken cancellationToken = default)
    {
        (limit, offset) = NormalizePaging(limit, offset);
        var whereClause = BuildManufacturingWhereClause(search, status, customerId);

        var countSql = $"SELECT COUNT(*) FROM dbo.manufacturing_projects mp LEFT JOIN dbo.customers c ON c.id = mp.customer_id {whereClause};";
        var listSql = $"""
            SELECT
                mp.id,
                mp.manufacturing_code,
                mp.piece_name,
                mp.piece_type,
                mp.design_date,
                mp.designer_name,
                mp.status,
                mp.craftsman_name,
                mp.metal_plating_json,
                mp.setting_cost,
                mp.diamond_cost,
                mp.gemstone_cost,
                mp.total_cost,
                mp.selling_price,
                mp.completion_date,
                mp.customer_id,
                mp.sold_at,
                mp.created_at_utc,
                mp.updated_at_utc,
                c.name AS customer_name,
                (
                    SELECT COUNT(*)
                    FROM dbo.manufacturing_project_gemstones mg
                    WHERE mg.project_id = mp.id
                ) AS gemstone_count
            FROM dbo.manufacturing_projects mp
            LEFT JOIN dbo.customers c
                ON c.id = mp.customer_id
            {whereClause}
            ORDER BY mp.updated_at_utc DESC, mp.id DESC
            OFFSET @Offset ROWS FETCH NEXT @Limit ROWS ONLY;
            """;

        await using var conn = new SqlConnection(_connectionString);
        await conn.OpenAsync(cancellationToken);

        int totalCount;
        await using (var countCmd = new SqlCommand(countSql, conn))
        {
            ApplyManufacturingParams(countCmd, search, status, customerId);
            totalCount = Convert.ToInt32(await countCmd.ExecuteScalarAsync(cancellationToken) ?? 0);
        }

        var items = new List<ManufacturingProjectSummaryResponse>();
        await using (var listCmd = new SqlCommand(listSql, conn))
        {
            ApplyManufacturingParams(listCmd, search, status, customerId);
            listCmd.Parameters.AddWithValue("@Offset", offset);
            listCmd.Parameters.AddWithValue("@Limit", limit);

            await using var reader = await listCmd.ExecuteReaderAsync(cancellationToken);
            while (await reader.ReadAsync(cancellationToken))
            {
                items.Add(MapManufacturingSummary(reader));
            }
        }

        return new PagedResponse<ManufacturingProjectSummaryResponse>(items, totalCount, limit, offset);
    }

    public async Task<ManufacturingProjectDetailResponse?> GetManufacturingProjectByIdAsync(
        int projectId,
        CancellationToken cancellationToken = default)
    {
        const string projectSql = """
            SELECT
                mp.id,
                mp.manufacturing_code,
                mp.piece_name,
                mp.piece_type,
                mp.design_date,
                mp.designer_name,
                mp.status,
                mp.craftsman_name,
                mp.metal_plating_json,
                mp.metal_plating_notes,
                mp.setting_cost,
                mp.diamond_cost,
                mp.gemstone_cost,
                mp.total_cost,
                mp.selling_price,
                mp.completion_date,
                mp.usage_notes,
                mp.photos_json,
                mp.customer_id,
                mp.sold_at,
                mp.created_at_utc,
                mp.updated_at_utc,
                c.name AS customer_name
            FROM dbo.manufacturing_projects mp
            LEFT JOIN dbo.customers c
                ON c.id = mp.customer_id
            WHERE mp.id = @ProjectId;
            """;

        const string gemstonesSql = """
            SELECT
                mg.id,
                mg.inventory_item_id,
                mg.gemstone_code,
                COALESCE(mg.gemstone_type, gi.gemstone_type) AS gemstone_type,
                mg.pieces_used,
                mg.weight_used_ct,
                mg.line_cost,
                mg.notes
            FROM dbo.manufacturing_project_gemstones mg
            LEFT JOIN dbo.gem_inventory_items gi
                ON gi.id = mg.inventory_item_id
            WHERE mg.project_id = @ProjectId
            ORDER BY mg.id;
            """;

        const string activitySql = """
            SELECT
                id,
                status,
                activity_at_utc,
                craftsman_name,
                notes
            FROM dbo.manufacturing_activity_log
            WHERE project_id = @ProjectId
            ORDER BY activity_at_utc DESC, id DESC;
            """;

        await using var conn = new SqlConnection(_connectionString);
        await conn.OpenAsync(cancellationToken);

        ManufacturingProjectDetailResponse? detail;
        await using (var projectCmd = new SqlCommand(projectSql, conn))
        {
            projectCmd.Parameters.AddWithValue("@ProjectId", projectId);
            await using var reader = await projectCmd.ExecuteReaderAsync(cancellationToken);
            if (!await reader.ReadAsync(cancellationToken))
            {
                return null;
            }

            detail = MapManufacturingDetail(reader);
        }

        var gemstones = new List<ManufacturingGemstoneResponse>();
        await using (var gemstonesCmd = new SqlCommand(gemstonesSql, conn))
        {
            gemstonesCmd.Parameters.AddWithValue("@ProjectId", projectId);
            await using var reader = await gemstonesCmd.ExecuteReaderAsync(cancellationToken);
            while (await reader.ReadAsync(cancellationToken))
            {
                gemstones.Add(new ManufacturingGemstoneResponse
                {
                    Id = GetInt32(reader, "id"),
                    InventoryItemId = GetNullableInt32(reader, "inventory_item_id"),
                    GemstoneCode = GetNullableString(reader, "gemstone_code"),
                    GemstoneType = GetNullableString(reader, "gemstone_type"),
                    PiecesUsed = GetDecimal(reader, "pieces_used"),
                    WeightUsedCt = GetDecimal(reader, "weight_used_ct"),
                    LineCost = GetDecimal(reader, "line_cost"),
                    Notes = GetNullableString(reader, "notes"),
                });
            }
        }

        var activity = new List<ManufacturingActivityLogResponse>();
        await using (var activityCmd = new SqlCommand(activitySql, conn))
        {
            activityCmd.Parameters.AddWithValue("@ProjectId", projectId);
            await using var reader = await activityCmd.ExecuteReaderAsync(cancellationToken);
            while (await reader.ReadAsync(cancellationToken))
            {
                activity.Add(new ManufacturingActivityLogResponse
                {
                    Id = GetInt32(reader, "id"),
                    Status = GetString(reader, "status"),
                    ActivityAtUtc = GetDateTime(reader, "activity_at_utc"),
                    CraftsmanName = GetNullableString(reader, "craftsman_name"),
                    Notes = GetNullableString(reader, "notes"),
                });
            }
        }

        return new ManufacturingProjectDetailResponse
        {
            Id = detail.Id,
            ManufacturingCode = detail.ManufacturingCode,
            PieceName = detail.PieceName,
            PieceType = detail.PieceType,
            DesignDate = detail.DesignDate,
            DesignerName = detail.DesignerName,
            Status = detail.Status,
            CraftsmanName = detail.CraftsmanName,
            MetalPlating = detail.MetalPlating,
            MetalPlatingNotes = detail.MetalPlatingNotes,
            SettingCost = detail.SettingCost,
            DiamondCost = detail.DiamondCost,
            GemstoneCost = detail.GemstoneCost,
            TotalCost = detail.TotalCost,
            SellingPrice = detail.SellingPrice,
            CompletionDate = detail.CompletionDate,
            UsageNotes = detail.UsageNotes,
            Photos = detail.Photos,
            CustomerId = detail.CustomerId,
            CustomerName = detail.CustomerName,
            SoldAt = detail.SoldAt,
            CreatedAtUtc = detail.CreatedAtUtc,
            UpdatedAtUtc = detail.UpdatedAtUtc,
            Gemstones = gemstones,
            ActivityLog = activity,
        };
    }

    public async Task<ManufacturingProjectDetailResponse> CreateManufacturingProjectAsync(
        ManufacturingProjectUpsertRequest request,
        CancellationToken cancellationToken = default)
    {
        var manufacturingCode = NormalizeRequired(request.ManufacturingCode, "Manufacturing code is required.");
        var pieceName = NormalizeRequired(request.PieceName, "Piece name is required.");
        var status = ManufacturingStatuses.NormalizeOrDefault(request.Status, ManufacturingStatuses.Approved);
        var pieceType = ManufacturingPieceTypes.NormalizeOrNull(request.PieceType);

        const string insertSql = """
            INSERT INTO dbo.manufacturing_projects (
                manufacturing_code,
                piece_name,
                piece_type,
                design_date,
                designer_name,
                status,
                craftsman_name,
                metal_plating_json,
                metal_plating_notes,
                setting_cost,
                diamond_cost,
                gemstone_cost,
                total_cost,
                selling_price,
                completion_date,
                usage_notes,
                photos_json,
                customer_id,
                sold_at,
                updated_at_utc
            )
            OUTPUT INSERTED.id
            VALUES (
                @ManufacturingCode,
                @PieceName,
                @PieceType,
                @DesignDate,
                @DesignerName,
                @Status,
                @CraftsmanName,
                @MetalPlatingJson,
                @MetalPlatingNotes,
                @SettingCost,
                @DiamondCost,
                @GemstoneCost,
                @TotalCost,
                @SellingPrice,
                @CompletionDate,
                @UsageNotes,
                @PhotosJson,
                @CustomerId,
                @SoldAt,
                SYSUTCDATETIME()
            );
            """;

        await using var conn = new SqlConnection(_connectionString);
        await conn.OpenAsync(cancellationToken);

        await using var tx = (SqlTransaction)await conn.BeginTransactionAsync(cancellationToken);

        try
        {
            int createdId;
            await using (var insertCmd = new SqlCommand(insertSql, conn, tx))
            {
                insertCmd.Parameters.AddWithValue("@ManufacturingCode", manufacturingCode);
                insertCmd.Parameters.AddWithValue("@PieceName", pieceName);
                insertCmd.Parameters.AddWithValue("@PieceType", DbNullIfEmpty(pieceType));
                insertCmd.Parameters.AddWithValue("@DesignDate", DbValue(request.DesignDate));
                insertCmd.Parameters.AddWithValue("@DesignerName", DbNullIfEmpty(request.DesignerName));
                insertCmd.Parameters.AddWithValue("@Status", status);
                insertCmd.Parameters.AddWithValue("@CraftsmanName", DbNullIfEmpty(request.CraftsmanName));
                insertCmd.Parameters.AddWithValue("@MetalPlatingJson", SerializeJsonArray(request.MetalPlating));
                insertCmd.Parameters.AddWithValue("@MetalPlatingNotes", DbNullIfEmpty(request.MetalPlatingNotes));
                insertCmd.Parameters.AddWithValue("@SettingCost", request.SettingCost ?? 0m);
                insertCmd.Parameters.AddWithValue("@DiamondCost", request.DiamondCost ?? 0m);
                insertCmd.Parameters.AddWithValue("@GemstoneCost", request.GemstoneCost ?? 0m);
                insertCmd.Parameters.AddWithValue("@TotalCost", request.TotalCost ?? 0m);
                insertCmd.Parameters.AddWithValue("@SellingPrice", request.SellingPrice ?? 0m);
                insertCmd.Parameters.AddWithValue("@CompletionDate", DbValue(request.CompletionDate));
                insertCmd.Parameters.AddWithValue("@UsageNotes", DbNullIfEmpty(request.UsageNotes));
                insertCmd.Parameters.AddWithValue("@PhotosJson", SerializeJsonArray(request.Photos));
                insertCmd.Parameters.AddWithValue("@CustomerId", DbValue(request.CustomerId));
                insertCmd.Parameters.AddWithValue("@SoldAt", DbValue(request.SoldAt));

                createdId = Convert.ToInt32(await insertCmd.ExecuteScalarAsync(cancellationToken) ?? 0);
            }

            await ReplaceProjectGemstonesAsync(conn, tx, createdId, request.Gemstones ?? [], cancellationToken);
            await InsertActivityLogAsync(
                conn,
                tx,
                createdId,
                status,
                request.CraftsmanName,
                request.ActivityNote ?? $"Project created with status: {status}",
                cancellationToken);

            await tx.CommitAsync(cancellationToken);

            var created = await GetManufacturingProjectByIdAsync(createdId, cancellationToken);
            if (created is null)
            {
                throw new InvalidOperationException("Manufacturing project was created but could not be read back.");
            }

            return created;
        }
        catch
        {
            await tx.RollbackAsync(cancellationToken);
            throw;
        }
    }

    public async Task<ManufacturingProjectDetailResponse?> UpdateManufacturingProjectAsync(
        int projectId,
        ManufacturingProjectUpsertRequest request,
        CancellationToken cancellationToken = default)
    {
        var existing = await GetManufacturingProjectByIdAsync(projectId, cancellationToken);
        if (existing is null)
        {
            return null;
        }

        var manufacturingCode = string.IsNullOrWhiteSpace(request.ManufacturingCode)
            ? existing.ManufacturingCode
            : request.ManufacturingCode.Trim();
        var pieceName = string.IsNullOrWhiteSpace(request.PieceName)
            ? existing.PieceName
            : request.PieceName.Trim();
        var pieceType = request.PieceType is null
            ? existing.PieceType
            : ManufacturingPieceTypes.NormalizeOrNull(request.PieceType);
        var status = request.Status is null
            ? existing.Status
            : ManufacturingStatuses.NormalizeOrDefault(request.Status, existing.Status);

        var soldAt = status == ManufacturingStatuses.Sold
            ? request.SoldAt ?? existing.SoldAt ?? DateTime.UtcNow
            : (request.Status is null ? existing.SoldAt : null);
        var designDate = request.DesignDate ?? existing.DesignDate;
        var completionDate = request.CompletionDate ?? existing.CompletionDate;

        var customerId = request.CustomerId ?? existing.CustomerId;
        if (status != ManufacturingStatuses.Sold && request.Status is not null)
        {
            customerId = request.CustomerId;
        }

        const string updateSql = """
            UPDATE dbo.manufacturing_projects
            SET
                manufacturing_code = @ManufacturingCode,
                piece_name = @PieceName,
                piece_type = @PieceType,
                design_date = @DesignDate,
                designer_name = @DesignerName,
                status = @Status,
                craftsman_name = @CraftsmanName,
                metal_plating_json = @MetalPlatingJson,
                metal_plating_notes = @MetalPlatingNotes,
                setting_cost = @SettingCost,
                diamond_cost = @DiamondCost,
                gemstone_cost = @GemstoneCost,
                total_cost = @TotalCost,
                selling_price = @SellingPrice,
                completion_date = @CompletionDate,
                usage_notes = @UsageNotes,
                photos_json = @PhotosJson,
                customer_id = @CustomerId,
                sold_at = @SoldAt,
                updated_at_utc = SYSUTCDATETIME()
            WHERE id = @ProjectId;
            """;

        await using var conn = new SqlConnection(_connectionString);
        await conn.OpenAsync(cancellationToken);

        await using var tx = (SqlTransaction)await conn.BeginTransactionAsync(cancellationToken);

        try
        {
            await using (var updateCmd = new SqlCommand(updateSql, conn, tx))
            {
                updateCmd.Parameters.AddWithValue("@ProjectId", projectId);
                updateCmd.Parameters.AddWithValue("@ManufacturingCode", manufacturingCode);
                updateCmd.Parameters.AddWithValue("@PieceName", pieceName);
                updateCmd.Parameters.AddWithValue("@PieceType", DbNullIfEmpty(pieceType));
                updateCmd.Parameters.AddWithValue("@DesignDate", DbValue(designDate));
                updateCmd.Parameters.AddWithValue("@DesignerName", request.DesignerName is null ? DbNullIfEmpty(existing.DesignerName) : DbNullIfEmpty(request.DesignerName));
                updateCmd.Parameters.AddWithValue("@Status", status);
                updateCmd.Parameters.AddWithValue("@CraftsmanName", request.CraftsmanName is null ? DbNullIfEmpty(existing.CraftsmanName) : DbNullIfEmpty(request.CraftsmanName));
                updateCmd.Parameters.AddWithValue("@MetalPlatingJson", SerializeJsonArray(request.MetalPlating ?? existing.MetalPlating));
                updateCmd.Parameters.AddWithValue("@MetalPlatingNotes", request.MetalPlatingNotes is null ? DbNullIfEmpty(existing.MetalPlatingNotes) : DbNullIfEmpty(request.MetalPlatingNotes));
                updateCmd.Parameters.AddWithValue("@SettingCost", request.SettingCost ?? existing.SettingCost);
                updateCmd.Parameters.AddWithValue("@DiamondCost", request.DiamondCost ?? existing.DiamondCost);
                updateCmd.Parameters.AddWithValue("@GemstoneCost", request.GemstoneCost ?? existing.GemstoneCost);
                updateCmd.Parameters.AddWithValue("@TotalCost", request.TotalCost ?? existing.TotalCost);
                updateCmd.Parameters.AddWithValue("@SellingPrice", request.SellingPrice ?? existing.SellingPrice);
                updateCmd.Parameters.AddWithValue("@CompletionDate", DbValue(completionDate));
                updateCmd.Parameters.AddWithValue("@UsageNotes", request.UsageNotes is null ? DbNullIfEmpty(existing.UsageNotes) : DbNullIfEmpty(request.UsageNotes));
                updateCmd.Parameters.AddWithValue("@PhotosJson", SerializeJsonArray(request.Photos ?? existing.Photos));
                updateCmd.Parameters.AddWithValue("@CustomerId", DbValue(customerId));
                updateCmd.Parameters.AddWithValue("@SoldAt", DbValue(soldAt));

                var rows = await updateCmd.ExecuteNonQueryAsync(cancellationToken);
                if (rows <= 0)
                {
                    await tx.RollbackAsync(cancellationToken);
                    return null;
                }
            }

            if (request.Gemstones is not null)
            {
                await ReplaceProjectGemstonesAsync(conn, tx, projectId, request.Gemstones, cancellationToken);
            }

            var statusChanged = !string.Equals(existing.Status, status, StringComparison.OrdinalIgnoreCase);
            if (statusChanged || !string.IsNullOrWhiteSpace(request.ActivityNote))
            {
                var activityNote = !string.IsNullOrWhiteSpace(request.ActivityNote)
                    ? request.ActivityNote.Trim()
                    : $"Status changed from {existing.Status} to {status}";

                await InsertActivityLogAsync(
                    conn,
                    tx,
                    projectId,
                    status,
                    request.CraftsmanName ?? existing.CraftsmanName,
                    activityNote,
                    cancellationToken);
            }

            await tx.CommitAsync(cancellationToken);
            return await GetManufacturingProjectByIdAsync(projectId, cancellationToken);
        }
        catch
        {
            await tx.RollbackAsync(cancellationToken);
            throw;
        }
    }

    public async Task<bool> DeleteManufacturingProjectAsync(int projectId, CancellationToken cancellationToken = default)
    {
        const string sql = "DELETE FROM dbo.manufacturing_projects WHERE id = @ProjectId;";

        await using var conn = new SqlConnection(_connectionString);
        await conn.OpenAsync(cancellationToken);

        await using var cmd = new SqlCommand(sql, conn);
        cmd.Parameters.AddWithValue("@ProjectId", projectId);

        var rows = await cmd.ExecuteNonQueryAsync(cancellationToken);
        return rows > 0;
    }

    public async Task<AnalyticsOverviewResponse> GetAnalyticsAsync(CancellationToken cancellationToken = default)
    {
        const string soldSql = """
            SELECT
                mp.customer_id,
                c.name AS customer_name,
                mp.selling_price,
                mp.total_cost,
                mp.sold_at,
                mp.created_at_utc
            FROM dbo.manufacturing_projects mp
            LEFT JOIN dbo.customers c
                ON c.id = mp.customer_id
            WHERE mp.status = 'sold';
            """;

        const string customersSql = "SELECT COUNT(*) FROM dbo.customers;";

        await using var conn = new SqlConnection(_connectionString);
        await conn.OpenAsync(cancellationToken);

        var soldRows = new List<SoldProjectRow>();
        await using (var soldCmd = new SqlCommand(soldSql, conn))
        {
            await using var reader = await soldCmd.ExecuteReaderAsync(cancellationToken);
            while (await reader.ReadAsync(cancellationToken))
            {
                soldRows.Add(new SoldProjectRow
                {
                    CustomerId = GetNullableGuid(reader, "customer_id"),
                    CustomerName = GetNullableString(reader, "customer_name"),
                    SellingPrice = GetDecimal(reader, "selling_price"),
                    TotalCost = GetDecimal(reader, "total_cost"),
                    SoldAtUtc = GetNullableDateTime(reader, "sold_at"),
                    CreatedAtUtc = GetDateTime(reader, "created_at_utc"),
                });
            }
        }

        int customerCount;
        await using (var customersCmd = new SqlCommand(customersSql, conn))
        {
            customerCount = Convert.ToInt32(await customersCmd.ExecuteScalarAsync(cancellationToken) ?? 0);
        }

        var now = DateTime.UtcNow;
        var currentMonthStart = new DateTime(now.Year, now.Month, 1, 0, 0, 0, DateTimeKind.Utc);
        var currentMonthEnd = currentMonthStart.AddMonths(1);

        var soldDateRows = soldRows
            .Select(row => new
            {
                Row = row,
                SoldDateUtc = row.SoldAtUtc ?? row.CreatedAtUtc,
            })
            .ToList();

        var currentMonthSales = soldDateRows
            .Where(item => item.SoldDateUtc >= currentMonthStart && item.SoldDateUtc < currentMonthEnd)
            .ToList();

        var totalRevenue = soldRows.Sum(row => row.SellingPrice);
        var totalOrders = soldRows.Count;
        var avgOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0m;

        var monthlyRevenue = new List<AnalyticsMonthlyRevenuePoint>();
        for (var i = 5; i >= 0; i--)
        {
            var monthStart = currentMonthStart.AddMonths(-i);
            var monthEnd = monthStart.AddMonths(1);

            var monthSales = soldDateRows
                .Where(item => item.SoldDateUtc >= monthStart && item.SoldDateUtc < monthEnd)
                .ToList();

            var monthCustomers = monthSales
                .Select(item => item.Row.CustomerId)
                .Where(value => value.HasValue)
                .Select(value => value!.Value)
                .Distinct()
                .Count();

            monthlyRevenue.Add(new AnalyticsMonthlyRevenuePoint
            {
                Month = monthStart.ToString("MMM", CultureInfo.InvariantCulture),
                Revenue = monthSales.Sum(item => item.Row.SellingPrice),
                Customers = monthCustomers,
                Orders = monthSales.Count,
            });
        }

        var topCustomers = soldRows
            .Where(row => row.CustomerId.HasValue)
            .GroupBy(row => row.CustomerId!.Value)
            .Select(group =>
            {
                var latest = group
                    .OrderByDescending(row => row.SoldAtUtc ?? row.CreatedAtUtc)
                    .First();

                return new AnalyticsTopCustomerPoint
                {
                    CustomerId = group.Key,
                    CustomerName = string.IsNullOrWhiteSpace(latest.CustomerName) ? "Unknown Customer" : latest.CustomerName,
                    TotalSpent = group.Sum(row => row.SellingPrice),
                    Purchases = group.Count(),
                    LastPurchaseUtc = group.Max(row => row.SoldAtUtc ?? row.CreatedAtUtc),
                };
            })
            .OrderByDescending(item => item.TotalSpent)
            .Take(5)
            .ToList();

        var customersWithPurchases = soldRows
            .Select(row => row.CustomerId)
            .Where(value => value.HasValue)
            .Select(value => value!.Value)
            .Distinct()
            .Count();

        return new AnalyticsOverviewResponse
        {
            CurrentMonth = new AnalyticsCurrentMonthResponse
            {
                Revenue = currentMonthSales.Sum(item => item.Row.SellingPrice),
                Transactions = currentMonthSales.Count,
                StartDateUtc = currentMonthStart,
            },
            Totals = new AnalyticsTotalsResponse
            {
                Revenue = totalRevenue,
                Orders = totalOrders,
                AvgOrderValue = avgOrderValue,
                Customers = customerCount,
                CustomersWithPurchases = customersWithPurchases,
            },
            MonthlyRevenue = monthlyRevenue,
            TopCustomers = topCustomers,
        };
    }

    private static string BuildCustomerSearchWhereClause(string? search)
    {
        if (string.IsNullOrWhiteSpace(search))
        {
            return string.Empty;
        }

        return "WHERE (c.name LIKE @Search OR c.nickname LIKE @Search OR c.email LIKE @Search OR c.phone LIKE @Search)";
    }

    private static void ApplyCustomerSearchParams(SqlCommand command, string? search)
    {
        if (!string.IsNullOrWhiteSpace(search))
        {
            command.Parameters.AddWithValue("@Search", $"%{search.Trim()}%");
        }
    }

    private static string BuildManufacturingWhereClause(string? search, string? status, Guid? customerId)
    {
        var clauses = new List<string>();

        if (!string.IsNullOrWhiteSpace(search))
        {
            clauses.Add("(mp.manufacturing_code LIKE @Search OR mp.piece_name LIKE @Search OR mp.designer_name LIKE @Search OR mp.craftsman_name LIKE @Search OR c.name LIKE @Search)");
        }

        if (!string.IsNullOrWhiteSpace(status) && !status.Equals("all", StringComparison.OrdinalIgnoreCase))
        {
            if (status.Equals("in_production", StringComparison.OrdinalIgnoreCase))
            {
                clauses.Add("mp.status NOT IN ('ready_for_sale', 'sold')");
            }
            else
            {
                clauses.Add("mp.status = @Status");
            }
        }

        if (customerId.HasValue)
        {
            clauses.Add("mp.customer_id = @CustomerId");
        }

        return clauses.Count == 0 ? string.Empty : "WHERE " + string.Join(" AND ", clauses);
    }

    private static void ApplyManufacturingParams(SqlCommand command, string? search, string? status, Guid? customerId)
    {
        if (!string.IsNullOrWhiteSpace(search))
        {
            command.Parameters.AddWithValue("@Search", $"%{search.Trim()}%");
        }

        if (!string.IsNullOrWhiteSpace(status) &&
            !status.Equals("all", StringComparison.OrdinalIgnoreCase) &&
            !status.Equals("in_production", StringComparison.OrdinalIgnoreCase))
        {
            command.Parameters.AddWithValue("@Status", ManufacturingStatuses.NormalizeOrDefault(status));
        }

        if (customerId.HasValue)
        {
            command.Parameters.AddWithValue("@CustomerId", customerId.Value);
        }
    }

    private static async Task ReplaceProjectGemstonesAsync(
        SqlConnection conn,
        SqlTransaction tx,
        int projectId,
        IReadOnlyList<ManufacturingGemstoneUpsertRequest> gemstones,
        CancellationToken cancellationToken)
    {
        const string deleteSql = "DELETE FROM dbo.manufacturing_project_gemstones WHERE project_id = @ProjectId;";
        await using (var deleteCmd = new SqlCommand(deleteSql, conn, tx))
        {
            deleteCmd.Parameters.AddWithValue("@ProjectId", projectId);
            await deleteCmd.ExecuteNonQueryAsync(cancellationToken);
        }

        if (gemstones.Count == 0)
        {
            return;
        }

        const string insertSql = """
            INSERT INTO dbo.manufacturing_project_gemstones (
                project_id,
                inventory_item_id,
                gemstone_code,
                gemstone_type,
                pieces_used,
                weight_used_ct,
                line_cost,
                notes
            )
            VALUES (
                @ProjectId,
                @InventoryItemId,
                @GemstoneCode,
                @GemstoneType,
                @PiecesUsed,
                @WeightUsedCt,
                @LineCost,
                @Notes
            );
            """;

        foreach (var item in gemstones)
        {
            await using var insertCmd = new SqlCommand(insertSql, conn, tx);
            insertCmd.Parameters.AddWithValue("@ProjectId", projectId);
            insertCmd.Parameters.AddWithValue("@InventoryItemId", DbValue(item.InventoryItemId));
            insertCmd.Parameters.AddWithValue("@GemstoneCode", DbNullIfEmpty(item.GemstoneCode));
            insertCmd.Parameters.AddWithValue("@GemstoneType", DbNullIfEmpty(item.GemstoneType));
            insertCmd.Parameters.AddWithValue("@PiecesUsed", item.PiecesUsed ?? 0m);
            insertCmd.Parameters.AddWithValue("@WeightUsedCt", item.WeightUsedCt ?? 0m);
            insertCmd.Parameters.AddWithValue("@LineCost", item.LineCost ?? 0m);
            insertCmd.Parameters.AddWithValue("@Notes", DbNullIfEmpty(item.Notes));
            await insertCmd.ExecuteNonQueryAsync(cancellationToken);
        }
    }

    private static async Task InsertActivityLogAsync(
        SqlConnection conn,
        SqlTransaction tx,
        int projectId,
        string status,
        string? craftsmanName,
        string notes,
        CancellationToken cancellationToken)
    {
        const string sql = """
            INSERT INTO dbo.manufacturing_activity_log (
                project_id,
                status,
                activity_at_utc,
                craftsman_name,
                notes
            )
            VALUES (
                @ProjectId,
                @Status,
                SYSUTCDATETIME(),
                @CraftsmanName,
                @Notes
            );
            """;

        await using var cmd = new SqlCommand(sql, conn, tx);
        cmd.Parameters.AddWithValue("@ProjectId", projectId);
        cmd.Parameters.AddWithValue("@Status", ManufacturingStatuses.NormalizeOrDefault(status));
        cmd.Parameters.AddWithValue("@CraftsmanName", DbNullIfEmpty(craftsmanName));
        cmd.Parameters.AddWithValue("@Notes", DbNullIfEmpty(notes));

        await cmd.ExecuteNonQueryAsync(cancellationToken);
    }

    private static CustomerResponse MapCustomer(SqlDataReader reader)
    {
        return new CustomerResponse
        {
            Id = GetGuid(reader, "id"),
            Name = GetString(reader, "name"),
            Nickname = GetNullableString(reader, "nickname"),
            Email = GetNullableString(reader, "email"),
            Phone = GetNullableString(reader, "phone"),
            Address = GetNullableString(reader, "address"),
            Notes = GetNullableString(reader, "notes"),
            PhotoUrl = GetNullableString(reader, "photo_url"),
            CustomerSince = GetNullableDateTime(reader, "customer_since"),
            CreatedAtUtc = GetDateTime(reader, "created_at_utc"),
            UpdatedAtUtc = GetDateTime(reader, "updated_at_utc"),
            TotalSpent = GetDecimal(reader, "total_spent"),
            PurchaseCount = GetInt32(reader, "purchase_count"),
        };
    }

    private static ManufacturingProjectSummaryResponse MapManufacturingSummary(SqlDataReader reader)
    {
        return new ManufacturingProjectSummaryResponse
        {
            Id = GetInt32(reader, "id"),
            ManufacturingCode = GetString(reader, "manufacturing_code"),
            PieceName = GetString(reader, "piece_name"),
            PieceType = GetNullableString(reader, "piece_type"),
            DesignDate = GetNullableDateTime(reader, "design_date"),
            DesignerName = GetNullableString(reader, "designer_name"),
            Status = GetString(reader, "status"),
            CraftsmanName = GetNullableString(reader, "craftsman_name"),
            MetalPlating = DeserializeJsonArray(GetNullableString(reader, "metal_plating_json")),
            SettingCost = GetDecimal(reader, "setting_cost"),
            DiamondCost = GetDecimal(reader, "diamond_cost"),
            GemstoneCost = GetDecimal(reader, "gemstone_cost"),
            TotalCost = GetDecimal(reader, "total_cost"),
            SellingPrice = GetDecimal(reader, "selling_price"),
            CompletionDate = GetNullableDateTime(reader, "completion_date"),
            CustomerId = GetNullableGuid(reader, "customer_id"),
            CustomerName = GetNullableString(reader, "customer_name"),
            SoldAt = GetNullableDateTime(reader, "sold_at"),
            CreatedAtUtc = GetDateTime(reader, "created_at_utc"),
            UpdatedAtUtc = GetDateTime(reader, "updated_at_utc"),
            GemstoneCount = GetInt32(reader, "gemstone_count"),
        };
    }

    private static ManufacturingProjectDetailResponse MapManufacturingDetail(SqlDataReader reader)
    {
        return new ManufacturingProjectDetailResponse
        {
            Id = GetInt32(reader, "id"),
            ManufacturingCode = GetString(reader, "manufacturing_code"),
            PieceName = GetString(reader, "piece_name"),
            PieceType = GetNullableString(reader, "piece_type"),
            DesignDate = GetNullableDateTime(reader, "design_date"),
            DesignerName = GetNullableString(reader, "designer_name"),
            Status = GetString(reader, "status"),
            CraftsmanName = GetNullableString(reader, "craftsman_name"),
            MetalPlating = DeserializeJsonArray(GetNullableString(reader, "metal_plating_json")),
            MetalPlatingNotes = GetNullableString(reader, "metal_plating_notes"),
            SettingCost = GetDecimal(reader, "setting_cost"),
            DiamondCost = GetDecimal(reader, "diamond_cost"),
            GemstoneCost = GetDecimal(reader, "gemstone_cost"),
            TotalCost = GetDecimal(reader, "total_cost"),
            SellingPrice = GetDecimal(reader, "selling_price"),
            CompletionDate = GetNullableDateTime(reader, "completion_date"),
            UsageNotes = GetNullableString(reader, "usage_notes"),
            Photos = DeserializeJsonArray(GetNullableString(reader, "photos_json")),
            CustomerId = GetNullableGuid(reader, "customer_id"),
            CustomerName = GetNullableString(reader, "customer_name"),
            SoldAt = GetNullableDateTime(reader, "sold_at"),
            CreatedAtUtc = GetDateTime(reader, "created_at_utc"),
            UpdatedAtUtc = GetDateTime(reader, "updated_at_utc"),
        };
    }

    private static string SerializeJsonArray(IReadOnlyList<string>? values)
    {
        var normalized = values?
            .Where(value => !string.IsNullOrWhiteSpace(value))
            .Select(value => value.Trim())
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .ToList() ?? [];

        return JsonSerializer.Serialize(normalized);
    }

    private static IReadOnlyList<string> DeserializeJsonArray(string? raw)
    {
        if (string.IsNullOrWhiteSpace(raw))
        {
            return [];
        }

        try
        {
            var values = JsonSerializer.Deserialize<List<string>>(raw);
            return values?
                .Where(value => !string.IsNullOrWhiteSpace(value))
                .Select(value => value.Trim())
                .ToList() ?? [];
        }
        catch
        {
            return [];
        }
    }

    private static object DbNullIfEmpty(string? value)
    {
        if (string.IsNullOrWhiteSpace(value))
        {
            return DBNull.Value;
        }

        return value.Trim();
    }

    private static object DbValue<T>(T? value) where T : struct
    {
        return value.HasValue ? value.Value : DBNull.Value;
    }

    private static string NormalizeRequired(string? value, string message)
    {
        if (string.IsNullOrWhiteSpace(value))
        {
            throw new ArgumentException(message);
        }

        return value.Trim();
    }

    private static (int Limit, int Offset) NormalizePaging(int limit, int offset)
    {
        return (Math.Clamp(limit, 1, 200), Math.Max(offset, 0));
    }

    private static int GetOrdinal(SqlDataReader reader, string columnName) => reader.GetOrdinal(columnName);

    private static string GetString(SqlDataReader reader, string columnName)
    {
        var ordinal = GetOrdinal(reader, columnName);
        return reader.IsDBNull(ordinal) ? string.Empty : Convert.ToString(reader.GetValue(ordinal)) ?? string.Empty;
    }

    private static string? GetNullableString(SqlDataReader reader, string columnName)
    {
        var ordinal = GetOrdinal(reader, columnName);
        if (reader.IsDBNull(ordinal))
        {
            return null;
        }

        return Convert.ToString(reader.GetValue(ordinal));
    }

    private static int GetInt32(SqlDataReader reader, string columnName)
    {
        var ordinal = GetOrdinal(reader, columnName);
        if (reader.IsDBNull(ordinal))
        {
            return 0;
        }

        return Convert.ToInt32(reader.GetValue(ordinal));
    }

    private static int? GetNullableInt32(SqlDataReader reader, string columnName)
    {
        var ordinal = GetOrdinal(reader, columnName);
        if (reader.IsDBNull(ordinal))
        {
            return null;
        }

        return Convert.ToInt32(reader.GetValue(ordinal));
    }

    private static decimal GetDecimal(SqlDataReader reader, string columnName)
    {
        var ordinal = GetOrdinal(reader, columnName);
        if (reader.IsDBNull(ordinal))
        {
            return 0m;
        }

        return Convert.ToDecimal(reader.GetValue(ordinal));
    }

    private static DateTime GetDateTime(SqlDataReader reader, string columnName)
    {
        var ordinal = GetOrdinal(reader, columnName);
        if (reader.IsDBNull(ordinal))
        {
            return DateTime.UtcNow;
        }

        return Convert.ToDateTime(reader.GetValue(ordinal));
    }

    private static DateTime? GetNullableDateTime(SqlDataReader reader, string columnName)
    {
        var ordinal = GetOrdinal(reader, columnName);
        if (reader.IsDBNull(ordinal))
        {
            return null;
        }

        return Convert.ToDateTime(reader.GetValue(ordinal));
    }

    private static Guid GetGuid(SqlDataReader reader, string columnName)
    {
        var ordinal = GetOrdinal(reader, columnName);
        if (reader.IsDBNull(ordinal))
        {
            return Guid.Empty;
        }

        var value = reader.GetValue(ordinal);
        return value is Guid guid ? guid : Guid.Parse(Convert.ToString(value) ?? Guid.Empty.ToString());
    }

    private static Guid? GetNullableGuid(SqlDataReader reader, string columnName)
    {
        var ordinal = GetOrdinal(reader, columnName);
        if (reader.IsDBNull(ordinal))
        {
            return null;
        }

        var value = reader.GetValue(ordinal);
        if (value is Guid guid)
        {
            return guid;
        }

        return Guid.Parse(Convert.ToString(value) ?? Guid.Empty.ToString());
    }

    private sealed class SoldProjectRow
    {
        public Guid? CustomerId { get; init; }
        public string? CustomerName { get; init; }
        public decimal SellingPrice { get; init; }
        public decimal TotalCost { get; init; }
        public DateTime? SoldAtUtc { get; init; }
        public DateTime CreatedAtUtc { get; init; }
    }
}
