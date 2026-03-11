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
    Task<IReadOnlyList<CustomerPurchasedPhotoResponse>> GetCustomerPurchasedProductPhotosAsync(
        Guid customerId,
        int limit,
        CancellationToken cancellationToken = default);
    Task<PagedResponse<SupplierResponse>> GetSuppliersAsync(string? search, int limit, int offset, CancellationToken cancellationToken = default);
    Task<SupplierResponse?> GetSupplierByIdAsync(Guid supplierId, CancellationToken cancellationToken = default);
    Task<SupplierResponse> CreateSupplierAsync(SupplierUpsertRequest request, CancellationToken cancellationToken = default);
    Task<SupplierResponse?> UpdateSupplierAsync(Guid supplierId, SupplierUpsertRequest request, CancellationToken cancellationToken = default);
    Task<bool> DeleteSupplierAsync(Guid supplierId, CancellationToken cancellationToken = default);
    Task<IReadOnlyList<SupplierPurchaseHistoryResponse>> GetSupplierPurchaseHistoryAsync(Guid supplierId, int limit, CancellationToken cancellationToken = default);
    Task<SupplierPurchaseHistoryResponse> CreateSupplierPurchaseHistoryAsync(Guid supplierId, SupplierPurchaseUpsertRequest request, CancellationToken cancellationToken = default);
    Task<PagedResponse<PlatformActivityLogResponse>> GetPlatformActivityAsync(
        string? search,
        string? category,
        int limit,
        int offset,
        CancellationToken cancellationToken = default);
    Task<PagedResponse<GalleryAssetResponse>> GetGalleryAssetsAsync(
        string? search,
        string? attachment,
        int limit,
        int offset,
        CancellationToken cancellationToken = default);
    Task<GalleryAssetResponse> CreateGalleryAssetAsync(
        GalleryAssetCreateRequest request,
        CancellationToken cancellationToken = default);
    Task<GalleryAssetResponse?> AttachGalleryAssetAsync(
        Guid assetId,
        GalleryAssetAttachRequest request,
        CancellationToken cancellationToken = default);
    Task<bool> DeleteGalleryAssetAsync(Guid assetId, CancellationToken cancellationToken = default);

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
    Task<IReadOnlyList<ManufacturingPersonResponse>> GetManufacturingPeopleAsync(
        string? role,
        bool activeOnly,
        CancellationToken cancellationToken = default);
    Task<ManufacturingPersonResponse> CreateManufacturingPersonAsync(
        ManufacturingPersonUpsertRequest request,
        CancellationToken cancellationToken = default);
    Task<ManufacturingPersonResponse?> UpdateManufacturingPersonAsync(
        int personId,
        ManufacturingPersonUpsertRequest request,
        CancellationToken cancellationToken = default);
    Task<bool> DeleteManufacturingPersonAsync(int personId, CancellationToken cancellationToken = default);
    Task<ManufacturingPersonProfileResponse?> GetManufacturingPersonProfileAsync(
        int personId,
        int limit,
        CancellationToken cancellationToken = default);
    Task<ManufacturingSettingsResponse> GetManufacturingSettingsAsync(CancellationToken cancellationToken = default);
    Task<ManufacturingSettingsResponse> SaveManufacturingSettingsAsync(
        ManufacturingSettingsUpdateRequest request,
        CancellationToken cancellationToken = default);

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
                c.photos_json,
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
                c.photos_json,
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
                photos_json,
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
                @PhotosJson,
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
            cmd.Parameters.AddWithValue("@PhotosJson", SerializeJsonArray(request.Photos));
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
                photos_json = @PhotosJson,
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
            cmd.Parameters.AddWithValue("@PhotosJson", request.Photos is null ? SerializeJsonArray(existing.Photos) : SerializeJsonArray(request.Photos));
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

    public async Task<IReadOnlyList<CustomerPurchasedPhotoResponse>> GetCustomerPurchasedProductPhotosAsync(
        Guid customerId,
        int limit,
        CancellationToken cancellationToken = default)
    {
        const string sql = """
            SELECT TOP (@Limit)
                mp.id AS project_id,
                mp.manufacturing_code,
                mp.piece_name,
                mp.sold_at,
                photo.[value] AS photo_url
            FROM dbo.manufacturing_projects mp
            CROSS APPLY OPENJSON(
                CASE
                    WHEN ISJSON(mp.photos_json) = 1 THEN mp.photos_json
                    ELSE '[]'
                END
            ) photo
            WHERE mp.customer_id = @CustomerId
              AND mp.status = 'sold'
              AND photo.[type] IN (1, 2)
              AND LTRIM(RTRIM(CONVERT(NVARCHAR(MAX), photo.[value]))) <> ''
            ORDER BY COALESCE(mp.sold_at, mp.updated_at_utc) DESC, mp.id DESC;
            """;

        await using var conn = new SqlConnection(_connectionString);
        await conn.OpenAsync(cancellationToken);

        var items = new List<CustomerPurchasedPhotoResponse>();
        await using var cmd = new SqlCommand(sql, conn);
        cmd.Parameters.AddWithValue("@CustomerId", customerId);
        cmd.Parameters.AddWithValue("@Limit", Math.Clamp(limit, 1, 500));

        await using var reader = await cmd.ExecuteReaderAsync(cancellationToken);
        while (await reader.ReadAsync(cancellationToken))
        {
            items.Add(new CustomerPurchasedPhotoResponse
            {
                ProjectId = GetInt32(reader, "project_id"),
                ManufacturingCode = GetString(reader, "manufacturing_code"),
                PieceName = GetString(reader, "piece_name"),
                SoldAt = GetNullableDateTime(reader, "sold_at"),
                PhotoUrl = GetString(reader, "photo_url"),
            });
        }

        return items;
    }

    public async Task<PagedResponse<SupplierResponse>> GetSuppliersAsync(
        string? search,
        int limit,
        int offset,
        CancellationToken cancellationToken = default)
    {
        (limit, offset) = NormalizePaging(limit, offset);

        var whereClause = BuildSupplierSearchWhereClause(search);
        var countSql = $"SELECT COUNT(*) FROM dbo.suppliers s {whereClause};";
        var listSql = $"""
            SELECT
                s.id,
                s.name,
                s.contact_name,
                s.organization_name,
                s.branch_name,
                s.email,
                s.phone,
                s.address,
                s.tax_id,
                s.source_channel,
                s.shipping_address,
                s.shipping_email,
                s.shipping_phone,
                s.notes,
                s.created_at_utc,
                s.updated_at_utc,
                COALESCE(p.total_purchased_amount, 0) AS total_purchased_amount,
                COALESCE(p.purchase_count, 0) AS purchase_count
            FROM dbo.suppliers s
            OUTER APPLY (
                SELECT
                    SUM(COALESCE(ph.total_amount, 0)) AS total_purchased_amount,
                    COUNT(*) AS purchase_count
                FROM dbo.supplier_purchase_history ph
                WHERE ph.supplier_id = s.id
            ) p
            {whereClause}
            ORDER BY s.updated_at_utc DESC, s.name
            OFFSET @Offset ROWS FETCH NEXT @Limit ROWS ONLY;
            """;

        await using var conn = new SqlConnection(_connectionString);
        await conn.OpenAsync(cancellationToken);

        int totalCount;
        await using (var countCmd = new SqlCommand(countSql, conn))
        {
            ApplySupplierSearchParams(countCmd, search);
            totalCount = Convert.ToInt32(await countCmd.ExecuteScalarAsync(cancellationToken) ?? 0);
        }

        var items = new List<SupplierResponse>();
        await using (var listCmd = new SqlCommand(listSql, conn))
        {
            ApplySupplierSearchParams(listCmd, search);
            listCmd.Parameters.AddWithValue("@Offset", offset);
            listCmd.Parameters.AddWithValue("@Limit", limit);

            await using var reader = await listCmd.ExecuteReaderAsync(cancellationToken);
            while (await reader.ReadAsync(cancellationToken))
            {
                items.Add(MapSupplier(reader));
            }
        }

        return new PagedResponse<SupplierResponse>(items, totalCount, limit, offset);
    }

    public async Task<SupplierResponse?> GetSupplierByIdAsync(Guid supplierId, CancellationToken cancellationToken = default)
    {
        const string sql = """
            SELECT
                s.id,
                s.name,
                s.contact_name,
                s.organization_name,
                s.branch_name,
                s.email,
                s.phone,
                s.address,
                s.tax_id,
                s.source_channel,
                s.shipping_address,
                s.shipping_email,
                s.shipping_phone,
                s.notes,
                s.created_at_utc,
                s.updated_at_utc,
                COALESCE(p.total_purchased_amount, 0) AS total_purchased_amount,
                COALESCE(p.purchase_count, 0) AS purchase_count
            FROM dbo.suppliers s
            OUTER APPLY (
                SELECT
                    SUM(COALESCE(ph.total_amount, 0)) AS total_purchased_amount,
                    COUNT(*) AS purchase_count
                FROM dbo.supplier_purchase_history ph
                WHERE ph.supplier_id = s.id
            ) p
            WHERE s.id = @SupplierId;
            """;

        await using var conn = new SqlConnection(_connectionString);
        await conn.OpenAsync(cancellationToken);

        await using var cmd = new SqlCommand(sql, conn);
        cmd.Parameters.AddWithValue("@SupplierId", supplierId);
        await using var reader = await cmd.ExecuteReaderAsync(cancellationToken);
        if (!await reader.ReadAsync(cancellationToken))
        {
            return null;
        }

        return MapSupplier(reader);
    }

    public async Task<SupplierResponse> CreateSupplierAsync(SupplierUpsertRequest request, CancellationToken cancellationToken = default)
    {
        var normalizedName = NormalizeRequired(request.Name, "Supplier name is required.");

        const string sql = """
            INSERT INTO dbo.suppliers (
                name,
                contact_name,
                organization_name,
                branch_name,
                email,
                phone,
                address,
                tax_id,
                source_channel,
                shipping_address,
                shipping_email,
                shipping_phone,
                notes,
                updated_at_utc
            )
            OUTPUT INSERTED.id
            VALUES (
                @Name,
                @ContactName,
                @OrganizationName,
                @BranchName,
                @Email,
                @Phone,
                @Address,
                @TaxId,
                @SourceChannel,
                @ShippingAddress,
                @ShippingEmail,
                @ShippingPhone,
                @Notes,
                SYSUTCDATETIME()
            );
            """;

        await using var conn = new SqlConnection(_connectionString);
        await conn.OpenAsync(cancellationToken);

        Guid createdId;
        await using (var cmd = new SqlCommand(sql, conn))
        {
            cmd.Parameters.AddWithValue("@Name", normalizedName);
            cmd.Parameters.AddWithValue("@ContactName", DbNullIfEmpty(request.ContactName));
            cmd.Parameters.AddWithValue("@OrganizationName", DbNullIfEmpty(request.OrganizationName));
            cmd.Parameters.AddWithValue("@BranchName", DbNullIfEmpty(request.BranchName));
            cmd.Parameters.AddWithValue("@Email", DbNullIfEmpty(request.Email));
            cmd.Parameters.AddWithValue("@Phone", DbNullIfEmpty(request.Phone));
            cmd.Parameters.AddWithValue("@Address", DbNullIfEmpty(request.Address));
            cmd.Parameters.AddWithValue("@TaxId", DbNullIfEmpty(request.TaxId));
            cmd.Parameters.AddWithValue("@SourceChannel", DbNullIfEmpty(request.SourceChannel));
            cmd.Parameters.AddWithValue("@ShippingAddress", DbNullIfEmpty(request.ShippingAddress));
            cmd.Parameters.AddWithValue("@ShippingEmail", DbNullIfEmpty(request.ShippingEmail));
            cmd.Parameters.AddWithValue("@ShippingPhone", DbNullIfEmpty(request.ShippingPhone));
            cmd.Parameters.AddWithValue("@Notes", DbNullIfEmpty(request.Notes));
            createdId = (Guid)(await cmd.ExecuteScalarAsync(cancellationToken) ?? Guid.Empty);
        }

        var created = await GetSupplierByIdAsync(createdId, cancellationToken);
        if (created is null)
        {
            throw new InvalidOperationException("Supplier was created but could not be read back.");
        }

        return created;
    }

    public async Task<SupplierResponse?> UpdateSupplierAsync(
        Guid supplierId,
        SupplierUpsertRequest request,
        CancellationToken cancellationToken = default)
    {
        var existing = await GetSupplierByIdAsync(supplierId, cancellationToken);
        if (existing is null)
        {
            return null;
        }

        var normalizedName = string.IsNullOrWhiteSpace(request.Name)
            ? existing.Name
            : request.Name.Trim();

        const string sql = """
            UPDATE dbo.suppliers
            SET
                name = @Name,
                contact_name = @ContactName,
                organization_name = @OrganizationName,
                branch_name = @BranchName,
                email = @Email,
                phone = @Phone,
                address = @Address,
                tax_id = @TaxId,
                source_channel = @SourceChannel,
                shipping_address = @ShippingAddress,
                shipping_email = @ShippingEmail,
                shipping_phone = @ShippingPhone,
                notes = @Notes,
                updated_at_utc = SYSUTCDATETIME()
            WHERE id = @SupplierId;
            """;

        await using var conn = new SqlConnection(_connectionString);
        await conn.OpenAsync(cancellationToken);

        await using (var cmd = new SqlCommand(sql, conn))
        {
            cmd.Parameters.AddWithValue("@SupplierId", supplierId);
            cmd.Parameters.AddWithValue("@Name", normalizedName);
            cmd.Parameters.AddWithValue("@ContactName", request.ContactName is null ? DbNullIfEmpty(existing.ContactName) : DbNullIfEmpty(request.ContactName));
            cmd.Parameters.AddWithValue("@OrganizationName", request.OrganizationName is null ? DbNullIfEmpty(existing.OrganizationName) : DbNullIfEmpty(request.OrganizationName));
            cmd.Parameters.AddWithValue("@BranchName", request.BranchName is null ? DbNullIfEmpty(existing.BranchName) : DbNullIfEmpty(request.BranchName));
            cmd.Parameters.AddWithValue("@Email", request.Email is null ? DbNullIfEmpty(existing.Email) : DbNullIfEmpty(request.Email));
            cmd.Parameters.AddWithValue("@Phone", request.Phone is null ? DbNullIfEmpty(existing.Phone) : DbNullIfEmpty(request.Phone));
            cmd.Parameters.AddWithValue("@Address", request.Address is null ? DbNullIfEmpty(existing.Address) : DbNullIfEmpty(request.Address));
            cmd.Parameters.AddWithValue("@TaxId", request.TaxId is null ? DbNullIfEmpty(existing.TaxId) : DbNullIfEmpty(request.TaxId));
            cmd.Parameters.AddWithValue("@SourceChannel", request.SourceChannel is null ? DbNullIfEmpty(existing.SourceChannel) : DbNullIfEmpty(request.SourceChannel));
            cmd.Parameters.AddWithValue("@ShippingAddress", request.ShippingAddress is null ? DbNullIfEmpty(existing.ShippingAddress) : DbNullIfEmpty(request.ShippingAddress));
            cmd.Parameters.AddWithValue("@ShippingEmail", request.ShippingEmail is null ? DbNullIfEmpty(existing.ShippingEmail) : DbNullIfEmpty(request.ShippingEmail));
            cmd.Parameters.AddWithValue("@ShippingPhone", request.ShippingPhone is null ? DbNullIfEmpty(existing.ShippingPhone) : DbNullIfEmpty(request.ShippingPhone));
            cmd.Parameters.AddWithValue("@Notes", request.Notes is null ? DbNullIfEmpty(existing.Notes) : DbNullIfEmpty(request.Notes));
            var rows = await cmd.ExecuteNonQueryAsync(cancellationToken);
            if (rows <= 0)
            {
                return null;
            }
        }

        return await GetSupplierByIdAsync(supplierId, cancellationToken);
    }

    public async Task<bool> DeleteSupplierAsync(Guid supplierId, CancellationToken cancellationToken = default)
    {
        const string sql = "DELETE FROM dbo.suppliers WHERE id = @SupplierId;";

        await using var conn = new SqlConnection(_connectionString);
        await conn.OpenAsync(cancellationToken);

        await using var cmd = new SqlCommand(sql, conn);
        cmd.Parameters.AddWithValue("@SupplierId", supplierId);
        var rows = await cmd.ExecuteNonQueryAsync(cancellationToken);
        return rows > 0;
    }

    public async Task<IReadOnlyList<SupplierPurchaseHistoryResponse>> GetSupplierPurchaseHistoryAsync(
        Guid supplierId,
        int limit,
        CancellationToken cancellationToken = default)
    {
        const string sql = """
            SELECT TOP (@Limit)
                id,
                supplier_id,
                purchase_date,
                reference_no,
                description,
                currency_code,
                subtotal_amount,
                tax_amount,
                total_amount,
                status,
                notes,
                attachment_urls_json,
                created_at_utc,
                updated_at_utc
            FROM dbo.supplier_purchase_history
            WHERE supplier_id = @SupplierId
            ORDER BY COALESCE(purchase_date, CONVERT(DATE, created_at_utc)) DESC, id DESC;
            """;

        await using var conn = new SqlConnection(_connectionString);
        await conn.OpenAsync(cancellationToken);

        var items = new List<SupplierPurchaseHistoryResponse>();
        await using var cmd = new SqlCommand(sql, conn);
        cmd.Parameters.AddWithValue("@SupplierId", supplierId);
        cmd.Parameters.AddWithValue("@Limit", Math.Clamp(limit, 1, 300));
        await using var reader = await cmd.ExecuteReaderAsync(cancellationToken);
        while (await reader.ReadAsync(cancellationToken))
        {
            items.Add(MapSupplierPurchaseHistory(reader));
        }

        return items;
    }

    public async Task<SupplierPurchaseHistoryResponse> CreateSupplierPurchaseHistoryAsync(
        Guid supplierId,
        SupplierPurchaseUpsertRequest request,
        CancellationToken cancellationToken = default)
    {
        var existing = await GetSupplierByIdAsync(supplierId, cancellationToken);
        if (existing is null)
        {
            throw new ArgumentException("Supplier not found.");
        }

        var currencyCode = string.IsNullOrWhiteSpace(request.CurrencyCode) ? "THB" : request.CurrencyCode.Trim().ToUpperInvariant();
        var status = string.IsNullOrWhiteSpace(request.Status) ? "recorded" : request.Status.Trim();

        const string sql = """
            INSERT INTO dbo.supplier_purchase_history (
                supplier_id,
                purchase_date,
                reference_no,
                description,
                currency_code,
                subtotal_amount,
                tax_amount,
                total_amount,
                status,
                notes,
                attachment_urls_json,
                updated_at_utc
            )
            OUTPUT INSERTED.id
            VALUES (
                @SupplierId,
                @PurchaseDate,
                @ReferenceNo,
                @Description,
                @CurrencyCode,
                @SubtotalAmount,
                @TaxAmount,
                @TotalAmount,
                @Status,
                @Notes,
                @AttachmentUrlsJson,
                SYSUTCDATETIME()
            );
            """;

        await using var conn = new SqlConnection(_connectionString);
        await conn.OpenAsync(cancellationToken);

        long createdId;
        await using (var cmd = new SqlCommand(sql, conn))
        {
            cmd.Parameters.AddWithValue("@SupplierId", supplierId);
            cmd.Parameters.AddWithValue("@PurchaseDate", DbValue(request.PurchaseDate));
            cmd.Parameters.AddWithValue("@ReferenceNo", DbNullIfEmpty(request.ReferenceNo));
            cmd.Parameters.AddWithValue("@Description", DbNullIfEmpty(request.Description));
            cmd.Parameters.AddWithValue("@CurrencyCode", currencyCode);
            cmd.Parameters.AddWithValue("@SubtotalAmount", DbValue(request.SubtotalAmount));
            cmd.Parameters.AddWithValue("@TaxAmount", DbValue(request.TaxAmount));
            cmd.Parameters.AddWithValue("@TotalAmount", DbValue(request.TotalAmount));
            cmd.Parameters.AddWithValue("@Status", status);
            cmd.Parameters.AddWithValue("@Notes", DbNullIfEmpty(request.Notes));
            cmd.Parameters.AddWithValue("@AttachmentUrlsJson", SerializeJsonArray(request.AttachmentUrls));
            createdId = Convert.ToInt64(await cmd.ExecuteScalarAsync(cancellationToken) ?? 0L);
        }

        const string readSql = """
            SELECT TOP 1
                id,
                supplier_id,
                purchase_date,
                reference_no,
                description,
                currency_code,
                subtotal_amount,
                tax_amount,
                total_amount,
                status,
                notes,
                attachment_urls_json,
                created_at_utc,
                updated_at_utc
            FROM dbo.supplier_purchase_history
            WHERE id = @Id;
            """;

        await using var readCmd = new SqlCommand(readSql, conn);
        readCmd.Parameters.AddWithValue("@Id", createdId);
        await using var reader = await readCmd.ExecuteReaderAsync(cancellationToken);
        if (!await reader.ReadAsync(cancellationToken))
        {
            throw new InvalidOperationException("Supplier purchase history entry was created but could not be read back.");
        }

        return MapSupplierPurchaseHistory(reader);
    }

    public async Task<PagedResponse<PlatformActivityLogResponse>> GetPlatformActivityAsync(
        string? search,
        string? category,
        int limit,
        int offset,
        CancellationToken cancellationToken = default)
    {
        (limit, offset) = NormalizePaging(limit, offset);
        var whereClause = BuildPlatformActivityWhereClause(search, category);

        var sourceSql = """
            SELECT
                'manufacturing_step' AS event_type,
                'manufacturing' AS category,
                l.activity_at_utc AS event_at_utc,
                CONCAT('Step: ', REPLACE(l.status, '_', ' '), ' • ', mp.manufacturing_code) AS title,
                l.notes AS description,
                l.craftsman_name AS actor_name,
                mp.manufacturing_code AS reference_code,
                CONCAT('/dashboard/manufacturing/', mp.id) AS route
            FROM dbo.manufacturing_activity_log l
            INNER JOIN dbo.manufacturing_projects mp
                ON mp.id = l.project_id

            UNION ALL

            SELECT
                'manufacturing_created' AS event_type,
                'manufacturing' AS category,
                mp.created_at_utc AS event_at_utc,
                CONCAT('New manufacturing project: ', mp.manufacturing_code) AS title,
                CONCAT('Piece: ', mp.piece_name) AS description,
                mp.designer_name AS actor_name,
                mp.manufacturing_code AS reference_code,
                CONCAT('/dashboard/manufacturing/', mp.id) AS route
            FROM dbo.manufacturing_projects mp

            UNION ALL

            SELECT
                'sale_recorded' AS event_type,
                'sales' AS category,
                COALESCE(mp.sold_at, mp.updated_at_utc) AS event_at_utc,
                CONCAT('Sale completed: ', mp.manufacturing_code) AS title,
                CONCAT('Selling Price THB ', CONVERT(NVARCHAR(64), CAST(mp.selling_price AS DECIMAL(18,2)))) AS description,
                NULL AS actor_name,
                mp.manufacturing_code AS reference_code,
                CONCAT('/dashboard/manufacturing/', mp.id) AS route
            FROM dbo.manufacturing_projects mp
            WHERE mp.status = 'sold'

            UNION ALL

            SELECT
                'customer_created' AS event_type,
                'customers' AS category,
                c.created_at_utc AS event_at_utc,
                CONCAT('New customer profile: ', c.name) AS title,
                c.email AS description,
                NULL AS actor_name,
                c.name AS reference_code,
                CONCAT('/dashboard/customers/', CONVERT(NVARCHAR(36), c.id)) AS route
            FROM dbo.customers c

            UNION ALL

            SELECT
                'customer_updated' AS event_type,
                'customers' AS category,
                c.updated_at_utc AS event_at_utc,
                CONCAT('Customer updated: ', c.name) AS title,
                NULL AS description,
                NULL AS actor_name,
                c.name AS reference_code,
                CONCAT('/dashboard/customers/', CONVERT(NVARCHAR(36), c.id)) AS route
            FROM dbo.customers c
            WHERE c.updated_at_utc > DATEADD(SECOND, 1, c.created_at_utc)

            UNION ALL

            SELECT
                'inventory_imported' AS event_type,
                'inventory' AS category,
                gi.imported_at_utc AS event_at_utc,
                CONCAT('Gem inventory imported: ', COALESCE(NULLIF(gi.gemstone_number_text, ''), CONVERT(NVARCHAR(32), gi.gemstone_number), CONCAT('#', CONVERT(NVARCHAR(32), gi.id)))) AS title,
                COALESCE(gi.gemstone_type, gi.source_sheet) AS description,
                gi.owner_name AS actor_name,
                COALESCE(NULLIF(gi.gemstone_number_text, ''), CONVERT(NVARCHAR(32), gi.gemstone_number), CONVERT(NVARCHAR(32), gi.id)) AS reference_code,
                CONCAT('/dashboard/inventory/', gi.id) AS route
            FROM dbo.gem_inventory_items gi

            UNION ALL

            SELECT
                'usage_batch_imported' AS event_type,
                'usage' AS category,
                gb.imported_at_utc AS event_at_utc,
                CONCAT('Usage batch imported: ', COALESCE(gb.product_code, CONCAT('#', CONVERT(NVARCHAR(32), gb.id)))) AS title,
                gb.product_category AS description,
                gb.requester_name AS actor_name,
                gb.product_code AS reference_code,
                '/dashboard/history' AS route
            FROM dbo.gem_usage_batches gb
            """;

        var countSql = $"SELECT COUNT(*) FROM ({sourceSql}) events {whereClause};";
        var listSql = $"""
            SELECT
                event_type,
                category,
                event_at_utc,
                title,
                description,
                actor_name,
                reference_code,
                route
            FROM ({sourceSql}) events
            {whereClause}
            ORDER BY event_at_utc DESC, title ASC
            OFFSET @Offset ROWS FETCH NEXT @Limit ROWS ONLY;
            """;

        await using var conn = new SqlConnection(_connectionString);
        await conn.OpenAsync(cancellationToken);

        int totalCount;
        await using (var countCmd = new SqlCommand(countSql, conn))
        {
            ApplyPlatformActivityParams(countCmd, search, category);
            totalCount = Convert.ToInt32(await countCmd.ExecuteScalarAsync(cancellationToken) ?? 0);
        }

        var items = new List<PlatformActivityLogResponse>();
        await using (var listCmd = new SqlCommand(listSql, conn))
        {
            ApplyPlatformActivityParams(listCmd, search, category);
            listCmd.Parameters.AddWithValue("@Offset", offset);
            listCmd.Parameters.AddWithValue("@Limit", limit);
            await using var reader = await listCmd.ExecuteReaderAsync(cancellationToken);
            while (await reader.ReadAsync(cancellationToken))
            {
                items.Add(new PlatformActivityLogResponse
                {
                    EventType = GetString(reader, "event_type"),
                    Category = GetString(reader, "category"),
                    EventAtUtc = GetDateTime(reader, "event_at_utc"),
                    Title = GetString(reader, "title"),
                    Description = GetNullableString(reader, "description"),
                    ActorName = GetNullableString(reader, "actor_name"),
                    ReferenceCode = GetNullableString(reader, "reference_code"),
                    Route = GetNullableString(reader, "route")
                });
            }
        }

        return new PagedResponse<PlatformActivityLogResponse>(items, totalCount, limit, offset);
    }

    public async Task<PagedResponse<GalleryAssetResponse>> GetGalleryAssetsAsync(
        string? search,
        string? attachment,
        int limit,
        int offset,
        CancellationToken cancellationToken = default)
    {
        (limit, offset) = NormalizePaging(limit, offset);
        var whereClause = BuildGalleryWhereClause(search, attachment);

        var countSql = $"""
            SELECT COUNT(*)
            FROM dbo.gallery_assets ga
            LEFT JOIN dbo.customers c ON c.id = ga.attached_customer_id
            LEFT JOIN dbo.manufacturing_projects mp ON mp.id = ga.attached_project_id
            LEFT JOIN dbo.inventory_items ii ON ii.id = ga.attached_inventory_item_id
            {whereClause};
            """;

        var listSql = $"""
            SELECT
                ga.id,
                ga.photo_url,
                ga.attached_customer_id,
                c.name AS attached_customer_name,
                ga.attached_project_id,
                mp.manufacturing_code AS attached_manufacturing_code,
                ga.attached_inventory_item_id,
                COALESCE(NULLIF(ii.gemstone_number_text, ''), CONVERT(NVARCHAR(64), ii.gemstone_number), CONVERT(NVARCHAR(64), ii.id)) AS attached_gemstone_code,
                ga.created_by,
                ga.created_at_utc,
                ga.updated_at_utc
            FROM dbo.gallery_assets ga
            LEFT JOIN dbo.customers c ON c.id = ga.attached_customer_id
            LEFT JOIN dbo.manufacturing_projects mp ON mp.id = ga.attached_project_id
            LEFT JOIN dbo.inventory_items ii ON ii.id = ga.attached_inventory_item_id
            {whereClause}
            ORDER BY ga.created_at_utc DESC
            OFFSET @Offset ROWS FETCH NEXT @Limit ROWS ONLY;
            """;

        await using var conn = new SqlConnection(_connectionString);
        await conn.OpenAsync(cancellationToken);

        int totalCount;
        await using (var countCmd = new SqlCommand(countSql, conn))
        {
            ApplyGalleryParams(countCmd, search, attachment);
            totalCount = Convert.ToInt32(await countCmd.ExecuteScalarAsync(cancellationToken) ?? 0);
        }

        var items = new List<GalleryAssetResponse>();
        await using (var listCmd = new SqlCommand(listSql, conn))
        {
            ApplyGalleryParams(listCmd, search, attachment);
            listCmd.Parameters.AddWithValue("@Offset", offset);
            listCmd.Parameters.AddWithValue("@Limit", limit);
            await using var reader = await listCmd.ExecuteReaderAsync(cancellationToken);
            while (await reader.ReadAsync(cancellationToken))
            {
                items.Add(MapGalleryAsset(reader));
            }
        }

        return new PagedResponse<GalleryAssetResponse>(items, totalCount, limit, offset);
    }

    public async Task<GalleryAssetResponse> CreateGalleryAssetAsync(
        GalleryAssetCreateRequest request,
        CancellationToken cancellationToken = default)
    {
        var photoUrl = NormalizeRequired(request.PhotoUrl, "Gallery photo is required.");
        var createdBy = string.IsNullOrWhiteSpace(request.CreatedBy) ? null : request.CreatedBy.Trim();

        const string sql = """
            INSERT INTO dbo.gallery_assets (
                photo_url,
                created_by,
                created_at_utc,
                updated_at_utc
            )
            OUTPUT INSERTED.id
            VALUES (
                @PhotoUrl,
                @CreatedBy,
                SYSUTCDATETIME(),
                SYSUTCDATETIME()
            );
            """;

        await using var conn = new SqlConnection(_connectionString);
        await conn.OpenAsync(cancellationToken);

        Guid createdId;
        await using (var cmd = new SqlCommand(sql, conn))
        {
            cmd.Parameters.AddWithValue("@PhotoUrl", photoUrl);
            cmd.Parameters.AddWithValue("@CreatedBy", DbNullIfEmpty(createdBy));
            var rawId = await cmd.ExecuteScalarAsync(cancellationToken);
            createdId = rawId is Guid value ? value : Guid.Empty;
        }

        if (createdId == Guid.Empty)
        {
            throw new InvalidOperationException("Unable to create gallery asset.");
        }

        return await GetGalleryAssetByIdAsync(createdId, cancellationToken)
            ?? throw new InvalidOperationException("Gallery asset was created but could not be loaded.");
    }

    public async Task<GalleryAssetResponse?> AttachGalleryAssetAsync(
        Guid assetId,
        GalleryAssetAttachRequest request,
        CancellationToken cancellationToken = default)
    {
        var attachmentCount = 0;
        if (request.CustomerId.HasValue) attachmentCount++;
        if (request.ManufacturingProjectId.HasValue) attachmentCount++;
        if (request.InventoryItemId.HasValue) attachmentCount++;

        if (attachmentCount > 1)
        {
            throw new ArgumentException("Attach exactly one target at a time.");
        }

        const string sql = """
            UPDATE dbo.gallery_assets
            SET
                attached_customer_id = @CustomerId,
                attached_project_id = @ProjectId,
                attached_inventory_item_id = @InventoryItemId,
                updated_at_utc = SYSUTCDATETIME()
            WHERE id = @Id;
            """;

        await using var conn = new SqlConnection(_connectionString);
        await conn.OpenAsync(cancellationToken);
        await using (var cmd = new SqlCommand(sql, conn))
        {
            cmd.Parameters.AddWithValue("@Id", assetId);
            cmd.Parameters.AddWithValue("@CustomerId", DbValue(request.CustomerId));
            cmd.Parameters.AddWithValue("@ProjectId", DbValue(request.ManufacturingProjectId));
            cmd.Parameters.AddWithValue("@InventoryItemId", DbValue(request.InventoryItemId));
            var affected = await cmd.ExecuteNonQueryAsync(cancellationToken);
            if (affected == 0)
            {
                return null;
            }
        }

        return await GetGalleryAssetByIdAsync(assetId, cancellationToken);
    }

    public async Task<bool> DeleteGalleryAssetAsync(Guid assetId, CancellationToken cancellationToken = default)
    {
        const string sql = "DELETE FROM dbo.gallery_assets WHERE id = @Id;";
        await using var conn = new SqlConnection(_connectionString);
        await conn.OpenAsync(cancellationToken);
        await using var cmd = new SqlCommand(sql, conn);
        cmd.Parameters.AddWithValue("@Id", assetId);
        var affected = await cmd.ExecuteNonQueryAsync(cancellationToken);
        return affected > 0;
    }

    private async Task<GalleryAssetResponse?> GetGalleryAssetByIdAsync(Guid assetId, CancellationToken cancellationToken)
    {
        const string sql = """
            SELECT
                ga.id,
                ga.photo_url,
                ga.attached_customer_id,
                c.name AS attached_customer_name,
                ga.attached_project_id,
                mp.manufacturing_code AS attached_manufacturing_code,
                ga.attached_inventory_item_id,
                COALESCE(NULLIF(ii.gemstone_number_text, ''), CONVERT(NVARCHAR(64), ii.gemstone_number), CONVERT(NVARCHAR(64), ii.id)) AS attached_gemstone_code,
                ga.created_by,
                ga.created_at_utc,
                ga.updated_at_utc
            FROM dbo.gallery_assets ga
            LEFT JOIN dbo.customers c ON c.id = ga.attached_customer_id
            LEFT JOIN dbo.manufacturing_projects mp ON mp.id = ga.attached_project_id
            LEFT JOIN dbo.inventory_items ii ON ii.id = ga.attached_inventory_item_id
            WHERE ga.id = @Id;
            """;

        await using var conn = new SqlConnection(_connectionString);
        await conn.OpenAsync(cancellationToken);
        await using var cmd = new SqlCommand(sql, conn);
        cmd.Parameters.AddWithValue("@Id", assetId);
        await using var reader = await cmd.ExecuteReaderAsync(cancellationToken);
        if (!await reader.ReadAsync(cancellationToken))
        {
            return null;
        }

        return MapGalleryAsset(reader);
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
                mp.maximum_discounted_price,
                mp.budget,
                mp.completion_date,
                mp.custom_order,
                mp.material,
                mp.customer_id,
                mp.sold_at,
                mp.created_at_utc,
                mp.updated_at_utc,
                mp.custom_fields_json,
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
                mp.maximum_discounted_price,
                mp.budget,
                mp.completion_date,
                mp.custom_order,
                mp.material,
                mp.usage_notes,
                mp.photos_json,
                mp.customer_id,
                mp.sold_at,
                mp.created_at_utc,
                mp.updated_at_utc,
                mp.custom_fields_json,
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
                gi.parsed_price_per_ct,
                gi.parsed_price_per_piece,
                mg.notes
            FROM dbo.manufacturing_project_gemstones mg
            LEFT JOIN dbo.gem_inventory_items gi
                ON gi.id = mg.inventory_item_id
            WHERE mg.project_id = @ProjectId
            ORDER BY mg.id;
            """;

        await using var conn = new SqlConnection(_connectionString);
        await conn.OpenAsync(cancellationToken);

        var hasActivityPhotosColumn = await ColumnExistsAsync(conn, "dbo.manufacturing_activity_log", "photos_json", cancellationToken);
        var activitySql = hasActivityPhotosColumn
            ? """
                SELECT
                    id,
                    status,
                    activity_at_utc,
                    craftsman_name,
                    notes,
                    photos_json
                FROM dbo.manufacturing_activity_log
                WHERE project_id = @ProjectId
                ORDER BY activity_at_utc DESC, id DESC;
                """
            : """
                SELECT
                    id,
                    status,
                    activity_at_utc,
                    craftsman_name,
                    notes,
                    NULL AS photos_json
                FROM dbo.manufacturing_activity_log
                WHERE project_id = @ProjectId
                ORDER BY activity_at_utc DESC, id DESC;
                """;

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
                    PricePerCt = GetNullableDecimal(reader, "parsed_price_per_ct"),
                    PricePerPiece = GetNullableDecimal(reader, "parsed_price_per_piece"),
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
                    Photos = DeserializeJsonArray(GetNullableString(reader, "photos_json"))
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
            MaximumDiscountedPrice = detail.MaximumDiscountedPrice,
            CompletionDate = detail.CompletionDate,
            CustomOrder = detail.CustomOrder,
            Material = detail.Material,
            UsageNotes = detail.UsageNotes,
            Photos = detail.Photos,
            CustomerId = detail.CustomerId,
            CustomerName = detail.CustomerName,
            SoldAt = detail.SoldAt,
            CreatedAtUtc = detail.CreatedAtUtc,
            UpdatedAtUtc = detail.UpdatedAtUtc,
            Gemstones = gemstones,
            ActivityLog = activity,
            CustomFields = detail.CustomFields,
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
                maximum_discounted_price,
                budget,
                completion_date,
                custom_order,
                material,
                usage_notes,
                photos_json,
                custom_fields_json,
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
                @MaximumDiscountedPrice,
                @Budget,
                @CompletionDate,
                @CustomOrder,
                @Material,
                @UsageNotes,
                @PhotosJson,
                @CustomFieldsJson,
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
            var createStepRequirement = await GetStepRequirementAsync(conn, tx, status, cancellationToken);
            var createHasPhotoEvidence =
                HasAnyText(request.Photos) ||
                HasAnyText(request.ActivityPhotos);
            EnsureStepRequirements(
                status,
                createStepRequirement.RequirePhoto,
                createStepRequirement.RequireComment,
                createHasPhotoEvidence,
                request.UsageNotes,
                request.ActivityNote);

            var settingCost = request.SettingCost ?? 0m;
            var diamondCost = request.DiamondCost ?? 0m;
            var customOrder = request.CustomOrder ?? false;
            var customerId = customOrder ? request.CustomerId : null;
            if (customOrder && !customerId.HasValue)
            {
                throw new ArgumentException("Custom orders must be linked to a customer.");
            }

            await EnsureCostInputsForStatusAsync(conn, tx, status, settingCost, diamondCost, cancellationToken);

            var gemstonesForSave = await ResolveGemstonesForPersistenceAsync(
                conn,
                tx,
                request.Gemstones ?? [],
                cancellationToken);
            var gemstoneCost = gemstonesForSave.Sum(item => item.LineCost ?? 0m);
            var totalCost = settingCost + diamondCost + gemstoneCost;
            var maximumDiscountedPrice = request.MaximumDiscountedPrice ?? 0m;
            var budget = request.Budget;
            var material = string.IsNullOrWhiteSpace(request.Material) ? null : request.Material.Trim();
            var metalPlating = NormalizeSingleSelection(request.MetalPlating);

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
                insertCmd.Parameters.AddWithValue("@MetalPlatingJson", SerializeJsonArray(metalPlating));
                insertCmd.Parameters.AddWithValue("@MetalPlatingNotes", DbNullIfEmpty(request.MetalPlatingNotes));
                insertCmd.Parameters.AddWithValue("@SettingCost", settingCost);
                insertCmd.Parameters.AddWithValue("@DiamondCost", diamondCost);
                insertCmd.Parameters.AddWithValue("@GemstoneCost", gemstoneCost);
                insertCmd.Parameters.AddWithValue("@TotalCost", totalCost);
                insertCmd.Parameters.AddWithValue("@SellingPrice", request.SellingPrice ?? 0m);
                insertCmd.Parameters.AddWithValue("@MaximumDiscountedPrice", maximumDiscountedPrice);
                insertCmd.Parameters.AddWithValue("@Budget", DbValue(budget));
                insertCmd.Parameters.AddWithValue("@CompletionDate", DbValue(request.CompletionDate));
                insertCmd.Parameters.AddWithValue("@CustomOrder", customOrder);
                insertCmd.Parameters.AddWithValue("@Material", DbNullIfEmpty(material));
                insertCmd.Parameters.AddWithValue("@UsageNotes", DbNullIfEmpty(request.UsageNotes));
                insertCmd.Parameters.AddWithValue("@PhotosJson", SerializeJsonArray(request.Photos));
                insertCmd.Parameters.AddWithValue("@CustomFieldsJson", SerializeJsonDictionary(request.CustomFields));
                insertCmd.Parameters.AddWithValue("@CustomerId", DbValue(customerId));
                insertCmd.Parameters.AddWithValue("@SoldAt", DbValue(request.SoldAt));

                createdId = Convert.ToInt32(await insertCmd.ExecuteScalarAsync(cancellationToken) ?? 0);
            }

            await EnsureManufacturingPersonExistsAsync(
                conn,
                tx,
                ManufacturingPersonRoles.Designer,
                request.DesignerName,
                cancellationToken);
            await EnsureManufacturingPersonExistsAsync(
                conn,
                tx,
                ManufacturingPersonRoles.Craftsman,
                request.CraftsmanName,
                cancellationToken);

            await ReplaceProjectGemstonesAsync(conn, tx, createdId, gemstonesForSave, cancellationToken);
            await InsertActivityLogAsync(
                conn,
                tx,
                createdId,
                status,
                request.CraftsmanName,
                request.ActivityNote ?? $"Project created with status: {status}",
                request.ActivityPhotos,
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
        var settingCost = request.SettingCost ?? existing.SettingCost;
        var diamondCost = request.DiamondCost ?? existing.DiamondCost;
        var maximumDiscountedPrice = request.MaximumDiscountedPrice ?? existing.MaximumDiscountedPrice;
        var budget = request.Budget ?? existing.Budget;
        var customOrder = request.CustomOrder ?? existing.CustomOrder;
        var material = request.Material is null ? existing.Material : (string.IsNullOrWhiteSpace(request.Material) ? null : request.Material.Trim());

        var customerId = customOrder ? (request.CustomerId ?? existing.CustomerId) : null;
        if (customOrder && !customerId.HasValue)
        {
            throw new ArgumentException("Custom orders must be linked to a customer.");
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
                maximum_discounted_price = @MaximumDiscountedPrice,
                budget = @Budget,
                completion_date = @CompletionDate,
                custom_order = @CustomOrder,
                material = @Material,
                usage_notes = @UsageNotes,
                photos_json = @PhotosJson,
                custom_fields_json = @CustomFieldsJson,
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
            var photos = request.Photos ?? existing.Photos;
            var usageNotes = request.UsageNotes ?? existing.UsageNotes;
            await EnsureCurrentStepCompletionBeforeAdvanceAsync(
                conn,
                tx,
                projectId,
                existing.Status,
                status,
                request.UsageNotes ?? existing.UsageNotes,
                request.ActivityNote,
                request.ActivityPhotos,
                cancellationToken);

            var updateStepRequirement = await GetStepRequirementAsync(conn, tx, status, cancellationToken);
            var hasStepPhotoEvidence = await HasStepPhotoEvidenceAsync(
                conn,
                tx,
                projectId,
                status,
                photos,
                request.ActivityPhotos,
                cancellationToken);
            EnsureStepRequirements(
                status,
                updateStepRequirement.RequirePhoto,
                updateStepRequirement.RequireComment,
                hasStepPhotoEvidence,
                usageNotes,
                request.ActivityNote);
            await EnsureCostInputsForStatusAsync(conn, tx, status, settingCost, diamondCost, cancellationToken);

            IReadOnlyList<ManufacturingGemstoneUpsertRequest>? gemstonesForSave = null;
            var gemstoneCost = existing.GemstoneCost;
            if (request.Gemstones is not null)
            {
                gemstonesForSave = await ResolveGemstonesForPersistenceAsync(conn, tx, request.Gemstones, cancellationToken);
                gemstoneCost = gemstonesForSave.Sum(item => item.LineCost ?? 0m);
            }

            var totalCost = settingCost + diamondCost + gemstoneCost;
            var metalPlating = NormalizeSingleSelection(request.MetalPlating ?? existing.MetalPlating);

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
                updateCmd.Parameters.AddWithValue("@MetalPlatingJson", SerializeJsonArray(metalPlating));
                updateCmd.Parameters.AddWithValue("@MetalPlatingNotes", request.MetalPlatingNotes is null ? DbNullIfEmpty(existing.MetalPlatingNotes) : DbNullIfEmpty(request.MetalPlatingNotes));
                updateCmd.Parameters.AddWithValue("@SettingCost", settingCost);
                updateCmd.Parameters.AddWithValue("@DiamondCost", diamondCost);
                updateCmd.Parameters.AddWithValue("@GemstoneCost", gemstoneCost);
                updateCmd.Parameters.AddWithValue("@TotalCost", totalCost);
                updateCmd.Parameters.AddWithValue("@SellingPrice", request.SellingPrice ?? existing.SellingPrice);
                updateCmd.Parameters.AddWithValue("@MaximumDiscountedPrice", maximumDiscountedPrice);
                updateCmd.Parameters.AddWithValue("@Budget", DbValue(budget));
                updateCmd.Parameters.AddWithValue("@CompletionDate", DbValue(completionDate));
                updateCmd.Parameters.AddWithValue("@CustomOrder", customOrder);
                updateCmd.Parameters.AddWithValue("@Material", DbNullIfEmpty(material));
                updateCmd.Parameters.AddWithValue("@UsageNotes", request.UsageNotes is null ? DbNullIfEmpty(existing.UsageNotes) : DbNullIfEmpty(request.UsageNotes));
                updateCmd.Parameters.AddWithValue("@PhotosJson", SerializeJsonArray(request.Photos ?? existing.Photos));
                updateCmd.Parameters.AddWithValue("@CustomFieldsJson", SerializeJsonDictionary(request.CustomFields ?? existing.CustomFields));
                updateCmd.Parameters.AddWithValue("@CustomerId", DbValue(customerId));
                updateCmd.Parameters.AddWithValue("@SoldAt", DbValue(soldAt));

                var rows = await updateCmd.ExecuteNonQueryAsync(cancellationToken);
                if (rows <= 0)
                {
                    await tx.RollbackAsync(cancellationToken);
                    return null;
                }
            }

            await EnsureManufacturingPersonExistsAsync(
                conn,
                tx,
                ManufacturingPersonRoles.Designer,
                request.DesignerName ?? existing.DesignerName,
                cancellationToken);
            await EnsureManufacturingPersonExistsAsync(
                conn,
                tx,
                ManufacturingPersonRoles.Craftsman,
                request.CraftsmanName ?? existing.CraftsmanName,
                cancellationToken);

            if (gemstonesForSave is not null)
            {
                await ReplaceProjectGemstonesAsync(conn, tx, projectId, gemstonesForSave, cancellationToken);
            }

            var statusChanged = !string.Equals(existing.Status, status, StringComparison.OrdinalIgnoreCase);
            var hasActivityPhotos = HasAnyText(request.ActivityPhotos);
            if (statusChanged || !string.IsNullOrWhiteSpace(request.ActivityNote) || hasActivityPhotos)
            {
                var activityNote = !string.IsNullOrWhiteSpace(request.ActivityNote)
                    ? request.ActivityNote.Trim()
                    : statusChanged
                        ? $"Status changed from {existing.Status} to {status}"
                        : $"Added step evidence for {status}";

                await InsertActivityLogAsync(
                    conn,
                    tx,
                    projectId,
                    status,
                    request.CraftsmanName ?? existing.CraftsmanName,
                    activityNote,
                    request.ActivityPhotos,
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

    public async Task<IReadOnlyList<ManufacturingPersonResponse>> GetManufacturingPeopleAsync(
        string? role,
        bool activeOnly,
        CancellationToken cancellationToken = default)
    {
        await using var conn = new SqlConnection(_connectionString);
        await conn.OpenAsync(cancellationToken);
        return await GetManufacturingPeopleInternalAsync(conn, null, role, activeOnly, cancellationToken);
    }

    public async Task<ManufacturingPersonResponse> CreateManufacturingPersonAsync(
        ManufacturingPersonUpsertRequest request,
        CancellationToken cancellationToken = default)
    {
        var normalizedRole = NormalizeManufacturingPersonRole(request.Role);
        var normalizedName = NormalizeRequired(request.Name, "Name is required.");
        var isActive = request.IsActive ?? true;

        await using var conn = new SqlConnection(_connectionString);
        await conn.OpenAsync(cancellationToken);

        if (!await TableExistsAsync(conn, "dbo.manufacturing_people", cancellationToken))
        {
            throw new InvalidOperationException("manufacturing_people table not found. Apply the latest migration.");
        }

        const string sql = """
            INSERT INTO dbo.manufacturing_people (
                role,
                name,
                email,
                phone,
                is_active,
                updated_at_utc
            )
            OUTPUT INSERTED.id
            VALUES (
                @Role,
                @Name,
                @Email,
                @Phone,
                @IsActive,
                SYSUTCDATETIME()
            );
            """;

        int createdId;
        await using (var cmd = new SqlCommand(sql, conn))
        {
            cmd.Parameters.AddWithValue("@Role", normalizedRole);
            cmd.Parameters.AddWithValue("@Name", normalizedName);
            cmd.Parameters.AddWithValue("@Email", DbNullIfEmpty(request.Email));
            cmd.Parameters.AddWithValue("@Phone", DbNullIfEmpty(request.Phone));
            cmd.Parameters.AddWithValue("@IsActive", isActive);
            createdId = Convert.ToInt32(await cmd.ExecuteScalarAsync(cancellationToken) ?? 0);
        }

        var created = await GetManufacturingPersonByIdAsync(conn, null, createdId, cancellationToken);
        if (created is null)
        {
            throw new InvalidOperationException("Person was created but could not be loaded.");
        }

        return created;
    }

    public async Task<ManufacturingPersonResponse?> UpdateManufacturingPersonAsync(
        int personId,
        ManufacturingPersonUpsertRequest request,
        CancellationToken cancellationToken = default)
    {
        await using var conn = new SqlConnection(_connectionString);
        await conn.OpenAsync(cancellationToken);

        if (!await TableExistsAsync(conn, "dbo.manufacturing_people", cancellationToken))
        {
            return null;
        }

        var existing = await GetManufacturingPersonByIdAsync(conn, null, personId, cancellationToken);
        if (existing is null)
        {
            return null;
        }

        var role = string.IsNullOrWhiteSpace(request.Role) ? existing.Role : NormalizeManufacturingPersonRole(request.Role);
        var name = string.IsNullOrWhiteSpace(request.Name) ? existing.Name : NormalizeRequired(request.Name, "Name is required.");
        var isActive = request.IsActive ?? existing.IsActive;

        const string sql = """
            UPDATE dbo.manufacturing_people
            SET
                role = @Role,
                name = @Name,
                email = @Email,
                phone = @Phone,
                is_active = @IsActive,
                updated_at_utc = SYSUTCDATETIME()
            WHERE id = @PersonId;
            """;

        await using (var cmd = new SqlCommand(sql, conn))
        {
            cmd.Parameters.AddWithValue("@PersonId", personId);
            cmd.Parameters.AddWithValue("@Role", role);
            cmd.Parameters.AddWithValue("@Name", name);
            cmd.Parameters.AddWithValue("@Email", request.Email is null ? DbNullIfEmpty(existing.Email) : DbNullIfEmpty(request.Email));
            cmd.Parameters.AddWithValue("@Phone", request.Phone is null ? DbNullIfEmpty(existing.Phone) : DbNullIfEmpty(request.Phone));
            cmd.Parameters.AddWithValue("@IsActive", isActive);
            var rows = await cmd.ExecuteNonQueryAsync(cancellationToken);
            if (rows <= 0)
            {
                return null;
            }
        }

        return await GetManufacturingPersonByIdAsync(conn, null, personId, cancellationToken);
    }

    public async Task<bool> DeleteManufacturingPersonAsync(int personId, CancellationToken cancellationToken = default)
    {
        await using var conn = new SqlConnection(_connectionString);
        await conn.OpenAsync(cancellationToken);

        if (!await TableExistsAsync(conn, "dbo.manufacturing_people", cancellationToken))
        {
            return false;
        }

        const string sql = "DELETE FROM dbo.manufacturing_people WHERE id = @PersonId;";
        await using var cmd = new SqlCommand(sql, conn);
        cmd.Parameters.AddWithValue("@PersonId", personId);
        var rows = await cmd.ExecuteNonQueryAsync(cancellationToken);
        return rows > 0;
    }

    public async Task<ManufacturingPersonProfileResponse?> GetManufacturingPersonProfileAsync(
        int personId,
        int limit,
        CancellationToken cancellationToken = default)
    {
        limit = Math.Clamp(limit, 1, 300);

        await using var conn = new SqlConnection(_connectionString);
        await conn.OpenAsync(cancellationToken);

        if (!await TableExistsAsync(conn, "dbo.manufacturing_people", cancellationToken))
        {
            return null;
        }

        var person = await GetManufacturingPersonByIdAsync(conn, null, personId, cancellationToken);
        if (person is null)
        {
            return null;
        }

        var sql = $"""
            SELECT TOP (@Limit)
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
                mp.maximum_discounted_price,
                mp.budget,
                mp.completion_date,
                mp.custom_order,
                mp.material,
                mp.customer_id,
                mp.sold_at,
                mp.created_at_utc,
                mp.updated_at_utc,
                mp.custom_fields_json,
                c.name AS customer_name,
                (
                    SELECT COUNT(*)
                    FROM dbo.manufacturing_project_gemstones mg
                    WHERE mg.project_id = mp.id
                ) AS gemstone_count
            FROM dbo.manufacturing_projects mp
            LEFT JOIN dbo.customers c
                ON c.id = mp.customer_id
            WHERE {(person.Role == ManufacturingPersonRoles.Designer ? "mp.designer_name = @PersonName" : "mp.craftsman_name = @PersonName")}
            ORDER BY mp.updated_at_utc DESC, mp.id DESC;
            """;

        var projects = new List<ManufacturingProjectSummaryResponse>();
        await using var cmd = new SqlCommand(sql, conn);
        cmd.Parameters.AddWithValue("@Limit", limit);
        cmd.Parameters.AddWithValue("@PersonName", person.Name);

        await using var reader = await cmd.ExecuteReaderAsync(cancellationToken);
        while (await reader.ReadAsync(cancellationToken))
        {
            projects.Add(MapManufacturingSummary(reader));
        }

        return new ManufacturingPersonProfileResponse
        {
            Person = person,
            Projects = projects
        };
    }

    public async Task<ManufacturingSettingsResponse> GetManufacturingSettingsAsync(CancellationToken cancellationToken = default)
    {
        const string stepsSql = """
            SELECT
                step_key,
                label,
                sort_order,
                require_photo,
                require_comment,
                is_active
            FROM dbo.manufacturing_process_steps
            ORDER BY sort_order, id;
            """;

        const string fieldsSql = """
            SELECT
                field_key,
                label,
                field_type,
                sort_order,
                is_required,
                is_active,
                is_system,
                options_json
            FROM dbo.manufacturing_custom_fields
            ORDER BY sort_order, id;
            """;

        await using var conn = new SqlConnection(_connectionString);
        await conn.OpenAsync(cancellationToken);

        var designers = await GetManufacturingPeopleInternalAsync(
            conn,
            null,
            ManufacturingPersonRoles.Designer,
            activeOnly: true,
            cancellationToken);
        var craftsmen = await GetManufacturingPeopleInternalAsync(
            conn,
            null,
            ManufacturingPersonRoles.Craftsman,
            activeOnly: true,
            cancellationToken);
        var pieceTypeOptions = await GetOptionSetOptionsAsync(
            conn,
            null,
            "piece_type",
            ManufacturingPieceTypes.Defaults,
            cancellationToken);
        var statusOptions = await GetOptionSetOptionsAsync(
            conn,
            null,
            "status",
            ManufacturingStatuses.Defaults,
            cancellationToken);
        var materialOptions = await GetOptionSetOptionsAsync(
            conn,
            null,
            "material",
            BuildDefaultMaterialOptions(),
            cancellationToken);
        var metalPlatingOptions = await GetOptionSetOptionsAsync(
            conn,
            null,
            "metal_plating",
            BuildDefaultMetalPlatingOptions(),
            cancellationToken);

        if (!await TableExistsAsync(conn, "dbo.manufacturing_process_steps", cancellationToken) ||
            !await TableExistsAsync(conn, "dbo.manufacturing_custom_fields", cancellationToken))
        {
            var defaults = BuildDefaultSettings();
            return new ManufacturingSettingsResponse
            {
                Steps = defaults.Steps,
                Fields = defaults.Fields,
                Designers = designers,
                Craftsmen = craftsmen,
                PieceTypeOptions = pieceTypeOptions,
                StatusOptions = statusOptions,
                MaterialOptions = materialOptions,
                MetalPlatingOptions = metalPlatingOptions
            };
        }

        var steps = new List<ManufacturingProcessStepResponse>();
        await using (var stepsCmd = new SqlCommand(stepsSql, conn))
        {
            await using var reader = await stepsCmd.ExecuteReaderAsync(cancellationToken);
            while (await reader.ReadAsync(cancellationToken))
            {
                steps.Add(new ManufacturingProcessStepResponse
                {
                    StepKey = GetString(reader, "step_key"),
                    Label = GetString(reader, "label"),
                    SortOrder = GetInt32(reader, "sort_order"),
                    RequirePhoto = GetBoolean(reader, "require_photo"),
                    RequireComment = GetBoolean(reader, "require_comment"),
                    IsActive = GetBoolean(reader, "is_active")
                });
            }
        }

        var fields = new List<ManufacturingCustomFieldResponse>();
        await using (var fieldsCmd = new SqlCommand(fieldsSql, conn))
        {
            await using var reader = await fieldsCmd.ExecuteReaderAsync(cancellationToken);
            while (await reader.ReadAsync(cancellationToken))
            {
                fields.Add(new ManufacturingCustomFieldResponse
                {
                    FieldKey = GetString(reader, "field_key"),
                    Label = GetString(reader, "label"),
                    FieldType = NormalizeFieldType(GetNullableString(reader, "field_type")),
                    SortOrder = GetInt32(reader, "sort_order"),
                    IsRequired = GetBoolean(reader, "is_required"),
                    IsActive = GetBoolean(reader, "is_active"),
                    IsSystem = GetBoolean(reader, "is_system"),
                    Options = DeserializeJsonArray(GetNullableString(reader, "options_json"))
                });
            }
        }

        if (steps.Count == 0 && fields.Count == 0)
        {
            var defaults = BuildDefaultSettings();
            return new ManufacturingSettingsResponse
            {
                Steps = defaults.Steps,
                Fields = defaults.Fields,
                Designers = designers,
                Craftsmen = craftsmen,
                PieceTypeOptions = pieceTypeOptions,
                StatusOptions = statusOptions,
                MaterialOptions = materialOptions,
                MetalPlatingOptions = metalPlatingOptions
            };
        }

        return new ManufacturingSettingsResponse
        {
            Steps = steps,
            Fields = fields,
            Designers = designers,
            Craftsmen = craftsmen,
            PieceTypeOptions = pieceTypeOptions,
            StatusOptions = statusOptions,
            MaterialOptions = materialOptions,
            MetalPlatingOptions = metalPlatingOptions
        };
    }

    public async Task<ManufacturingSettingsResponse> SaveManufacturingSettingsAsync(
        ManufacturingSettingsUpdateRequest request,
        CancellationToken cancellationToken = default)
    {
        var normalizedSteps = (request.Steps ?? [])
            .Select((item, index) =>
            {
                var stepKey = NormalizeStepKey(item.StepKey);
                if (string.IsNullOrWhiteSpace(stepKey))
                {
                    return null;
                }

                var label = string.IsNullOrWhiteSpace(item.Label) ? stepKey : item.Label.Trim();
                return new ManufacturingProcessStepResponse
                {
                    StepKey = stepKey,
                    Label = label,
                    SortOrder = item.SortOrder ?? (index + 1),
                    RequirePhoto = item.RequirePhoto,
                    RequireComment = item.RequireComment,
                    IsActive = item.IsActive
                };
            })
            .Where(item => item is not null)
            .Select(item => item!)
            .GroupBy(item => item.StepKey, StringComparer.OrdinalIgnoreCase)
            .Select(group => group.First())
            .OrderBy(item => item.SortOrder)
            .ThenBy(item => item.StepKey, StringComparer.OrdinalIgnoreCase)
            .ToList();

        if (normalizedSteps.Count == 0)
        {
            throw new ArgumentException("At least one production step is required.");
        }

        var normalizedFields = (request.Fields ?? [])
            .Select((item, index) =>
            {
                var fieldKey = NormalizeFieldKey(item.FieldKey);
                if (string.IsNullOrWhiteSpace(fieldKey))
                {
                    return null;
                }

                var label = string.IsNullOrWhiteSpace(item.Label) ? fieldKey : item.Label.Trim();
                var isSystem = IsSystemField(fieldKey);
                return new ManufacturingCustomFieldResponse
                {
                    FieldKey = fieldKey,
                    Label = label,
                    FieldType = NormalizeFieldType(item.FieldType),
                    SortOrder = item.SortOrder ?? (index + 1),
                    IsRequired = item.IsRequired,
                    IsActive = item.IsActive,
                    IsSystem = isSystem,
                    Options = (item.Options ?? [])
                        .Where(value => !string.IsNullOrWhiteSpace(value))
                        .Select(value => value.Trim())
                        .Distinct(StringComparer.OrdinalIgnoreCase)
                        .ToList()
                };
            })
            .Where(item => item is not null)
            .Select(item => item!)
            .GroupBy(item => item.FieldKey, StringComparer.OrdinalIgnoreCase)
            .Select(group => group.First())
            .OrderBy(item => item.SortOrder)
            .ThenBy(item => item.FieldKey, StringComparer.OrdinalIgnoreCase)
            .ToList();

        var normalizedPieceTypeOptions = NormalizeOptionValues(request.PieceTypeOptions, ManufacturingPieceTypes.Defaults);
        var normalizedStatusOptions = NormalizeOptionValues(request.StatusOptions, ManufacturingStatuses.Defaults);
        var normalizedMaterialOptions = NormalizeOptionValues(request.MaterialOptions, BuildDefaultMaterialOptions());
        var normalizedMetalPlatingOptions = NormalizeOptionValues(request.MetalPlatingOptions, BuildDefaultMetalPlatingOptions());

        await using var conn = new SqlConnection(_connectionString);
        await conn.OpenAsync(cancellationToken);
        await using var tx = (SqlTransaction)await conn.BeginTransactionAsync(cancellationToken);

        try
        {
            const string deleteStepsSql = "DELETE FROM dbo.manufacturing_process_steps;";
            await using (var deleteStepsCmd = new SqlCommand(deleteStepsSql, conn, tx))
            {
                await deleteStepsCmd.ExecuteNonQueryAsync(cancellationToken);
            }

            const string insertStepSql = """
                INSERT INTO dbo.manufacturing_process_steps (
                    step_key,
                    label,
                    sort_order,
                    require_photo,
                    require_comment,
                    is_active,
                    updated_at_utc
                )
                VALUES (
                    @StepKey,
                    @Label,
                    @SortOrder,
                    @RequirePhoto,
                    @RequireComment,
                    @IsActive,
                    SYSUTCDATETIME()
                );
                """;

            foreach (var step in normalizedSteps)
            {
                await using var insertStepCmd = new SqlCommand(insertStepSql, conn, tx);
                insertStepCmd.Parameters.AddWithValue("@StepKey", step.StepKey);
                insertStepCmd.Parameters.AddWithValue("@Label", step.Label);
                insertStepCmd.Parameters.AddWithValue("@SortOrder", step.SortOrder);
                insertStepCmd.Parameters.AddWithValue("@RequirePhoto", step.RequirePhoto);
                insertStepCmd.Parameters.AddWithValue("@RequireComment", step.RequireComment);
                insertStepCmd.Parameters.AddWithValue("@IsActive", step.IsActive);
                await insertStepCmd.ExecuteNonQueryAsync(cancellationToken);
            }

            const string deleteFieldsSql = "DELETE FROM dbo.manufacturing_custom_fields;";
            await using (var deleteFieldsCmd = new SqlCommand(deleteFieldsSql, conn, tx))
            {
                await deleteFieldsCmd.ExecuteNonQueryAsync(cancellationToken);
            }

            const string insertFieldSql = """
                INSERT INTO dbo.manufacturing_custom_fields (
                    field_key,
                    label,
                    field_type,
                    sort_order,
                    is_required,
                    is_active,
                    is_system,
                    options_json,
                    updated_at_utc
                )
                VALUES (
                    @FieldKey,
                    @Label,
                    @FieldType,
                    @SortOrder,
                    @IsRequired,
                    @IsActive,
                    @IsSystem,
                    @OptionsJson,
                    SYSUTCDATETIME()
                );
                """;

            foreach (var field in normalizedFields)
            {
                await using var insertFieldCmd = new SqlCommand(insertFieldSql, conn, tx);
                insertFieldCmd.Parameters.AddWithValue("@FieldKey", field.FieldKey);
                insertFieldCmd.Parameters.AddWithValue("@Label", field.Label);
                insertFieldCmd.Parameters.AddWithValue("@FieldType", field.FieldType);
                insertFieldCmd.Parameters.AddWithValue("@SortOrder", field.SortOrder);
                insertFieldCmd.Parameters.AddWithValue("@IsRequired", field.IsRequired);
                insertFieldCmd.Parameters.AddWithValue("@IsActive", field.IsActive);
                insertFieldCmd.Parameters.AddWithValue("@IsSystem", field.IsSystem);
                insertFieldCmd.Parameters.AddWithValue("@OptionsJson", SerializeJsonArray(field.Options));
                await insertFieldCmd.ExecuteNonQueryAsync(cancellationToken);
            }

            await UpsertOptionSetAsync(
                conn,
                tx,
                "piece_type",
                "Piece Type",
                normalizedPieceTypeOptions,
                cancellationToken);
            await UpsertOptionSetAsync(
                conn,
                tx,
                "status",
                "Status",
                normalizedStatusOptions,
                cancellationToken);
            await UpsertOptionSetAsync(
                conn,
                tx,
                "material",
                "Material",
                normalizedMaterialOptions,
                cancellationToken);
            await UpsertOptionSetAsync(
                conn,
                tx,
                "metal_plating",
                "Metal Plating",
                normalizedMetalPlatingOptions,
                cancellationToken);

            await tx.CommitAsync(cancellationToken);
            return await GetManufacturingSettingsAsync(cancellationToken);
        }
        catch
        {
            await tx.RollbackAsync(cancellationToken);
            throw;
        }
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

    private static string BuildSupplierSearchWhereClause(string? search)
    {
        if (string.IsNullOrWhiteSpace(search))
        {
            return string.Empty;
        }

        return "WHERE (s.name LIKE @Search OR s.organization_name LIKE @Search OR s.contact_name LIKE @Search OR s.email LIKE @Search OR s.phone LIKE @Search)";
    }

    private static void ApplySupplierSearchParams(SqlCommand command, string? search)
    {
        if (!string.IsNullOrWhiteSpace(search))
        {
            command.Parameters.AddWithValue("@Search", $"%{search.Trim()}%");
        }
    }

    private static string BuildPlatformActivityWhereClause(string? search, string? category)
    {
        var clauses = new List<string>();

        if (!string.IsNullOrWhiteSpace(search))
        {
            clauses.Add("(events.title LIKE @Search OR events.description LIKE @Search OR events.reference_code LIKE @Search OR events.actor_name LIKE @Search)");
        }

        if (!string.IsNullOrWhiteSpace(category) && !category.Equals("all", StringComparison.OrdinalIgnoreCase))
        {
            clauses.Add("events.category = @Category");
        }

        return clauses.Count == 0 ? string.Empty : "WHERE " + string.Join(" AND ", clauses);
    }

    private static void ApplyPlatformActivityParams(SqlCommand command, string? search, string? category)
    {
        if (!string.IsNullOrWhiteSpace(search))
        {
            command.Parameters.AddWithValue("@Search", $"%{search.Trim()}%");
        }

        if (!string.IsNullOrWhiteSpace(category) && !category.Equals("all", StringComparison.OrdinalIgnoreCase))
        {
            command.Parameters.AddWithValue("@Category", category.Trim().ToLowerInvariant());
        }
    }

    private static string BuildGalleryWhereClause(string? search, string? attachment)
    {
        var clauses = new List<string>();

        if (!string.IsNullOrWhiteSpace(search))
        {
            clauses.Add(
                "("
                + "c.name LIKE @Search "
                + "OR ga.created_by LIKE @Search "
                + "OR mp.manufacturing_code LIKE @Search "
                + "OR CONVERT(NVARCHAR(64), ii.gemstone_number) LIKE @Search "
                + "OR ii.gemstone_number_text LIKE @Search"
                + ")");
        }

        if (!string.IsNullOrWhiteSpace(attachment) && !attachment.Equals("all", StringComparison.OrdinalIgnoreCase))
        {
            clauses.Add("CASE @Attachment WHEN 'unattached' THEN CASE WHEN ga.attached_customer_id IS NULL AND ga.attached_project_id IS NULL AND ga.attached_inventory_item_id IS NULL THEN 1 ELSE 0 END WHEN 'customer' THEN CASE WHEN ga.attached_customer_id IS NOT NULL THEN 1 ELSE 0 END WHEN 'manufacturing' THEN CASE WHEN ga.attached_project_id IS NOT NULL THEN 1 ELSE 0 END WHEN 'gemstone' THEN CASE WHEN ga.attached_inventory_item_id IS NOT NULL THEN 1 ELSE 0 END ELSE 1 END = 1");
        }

        return clauses.Count == 0 ? string.Empty : "WHERE " + string.Join(" AND ", clauses);
    }

    private static void ApplyGalleryParams(SqlCommand command, string? search, string? attachment)
    {
        if (!string.IsNullOrWhiteSpace(search))
        {
            command.Parameters.AddWithValue("@Search", $"%{search.Trim()}%");
        }

        if (!string.IsNullOrWhiteSpace(attachment) && !attachment.Equals("all", StringComparison.OrdinalIgnoreCase))
        {
            command.Parameters.AddWithValue("@Attachment", attachment.Trim().ToLowerInvariant());
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

    private async Task<(bool RequirePhoto, bool RequireComment)> GetStepRequirementAsync(
        SqlConnection conn,
        SqlTransaction tx,
        string status,
        CancellationToken cancellationToken)
    {
        if (!await TableExistsAsync(conn, "dbo.manufacturing_process_steps", cancellationToken, tx))
        {
            return (false, false);
        }

        const string sql = """
            SELECT TOP 1
                require_photo,
                require_comment
            FROM dbo.manufacturing_process_steps
            WHERE step_key = @StepKey
            ORDER BY sort_order, id;
            """;

        await using var cmd = new SqlCommand(sql, conn, tx);
        cmd.Parameters.AddWithValue("@StepKey", ManufacturingStatuses.NormalizeOrDefault(status));
        await using var reader = await cmd.ExecuteReaderAsync(cancellationToken);
        if (!await reader.ReadAsync(cancellationToken))
        {
            return (false, false);
        }

        return (GetBoolean(reader, "require_photo"), GetBoolean(reader, "require_comment"));
    }

    private static void EnsureStepRequirements(
        string status,
        bool requirePhoto,
        bool requireComment,
        bool hasPhotoEvidence,
        string? usageNotes,
        string? activityNote)
    {
        if (requirePhoto && !hasPhotoEvidence)
        {
            throw new ArgumentException($"Status '{status}' requires at least one photo.");
        }

        if (requireComment && string.IsNullOrWhiteSpace(usageNotes) && string.IsNullOrWhiteSpace(activityNote))
        {
            throw new ArgumentException($"Status '{status}' requires a comment or note.");
        }
    }

    private async Task EnsureCurrentStepCompletionBeforeAdvanceAsync(
        SqlConnection conn,
        SqlTransaction tx,
        int projectId,
        string currentStatus,
        string nextStatus,
        string? usageNotes,
        string? pendingActivityNote,
        IReadOnlyList<string>? pendingActivityPhotos,
        CancellationToken cancellationToken)
    {
        if (string.Equals(currentStatus, nextStatus, StringComparison.OrdinalIgnoreCase))
        {
            return;
        }

        var stepOrderLookup = await GetStepOrderLookupAsync(conn, tx, cancellationToken);
        if (!IsStatusProgression(stepOrderLookup, currentStatus, nextStatus))
        {
            return;
        }

        var currentRequirements = await GetStepRequirementAsync(conn, tx, currentStatus, cancellationToken);
        if (!currentRequirements.RequirePhoto && !currentRequirements.RequireComment)
        {
            return;
        }

        var hasPhotoEvidence = !currentRequirements.RequirePhoto || await HasStepPhotoEvidenceAsync(
            conn,
            tx,
            projectId,
            currentStatus,
            projectPhotos: null,
            activityPhotos: pendingActivityPhotos,
            cancellationToken);
        var hasCommentEvidence = !currentRequirements.RequireComment ||
            !string.IsNullOrWhiteSpace(pendingActivityNote) ||
            await HasStepCommentEvidenceAsync(
                conn,
                tx,
                projectId,
                currentStatus,
                usageNotes,
                cancellationToken);

        if (!hasPhotoEvidence || !hasCommentEvidence)
        {
            throw new ArgumentException($"Complete required evidence for '{currentStatus}' before moving to '{nextStatus}'.");
        }
    }

    private async Task EnsureCostInputsForStatusAsync(
        SqlConnection conn,
        SqlTransaction tx,
        string status,
        decimal settingCost,
        decimal diamondCost,
        CancellationToken cancellationToken)
    {
        var stepOrderLookup = await GetStepOrderLookupAsync(conn, tx, cancellationToken);
        if (settingCost > 0m && !HasReachedStep(stepOrderLookup, status, ManufacturingStatuses.SentToCraftsman))
        {
            throw new ArgumentException("Setting cost can be entered only after 'sent_to_craftsman' is reached.");
        }

        if (diamondCost > 0m && !HasReachedStep(stepOrderLookup, status, ManufacturingStatuses.DiamondSorting))
        {
            throw new ArgumentException("Diamond cost can be entered only after 'diamond_sorting' is reached.");
        }
    }

    private static bool HasReachedStep(
        IReadOnlyDictionary<string, int> stepOrderLookup,
        string currentStatus,
        string requiredStatus)
    {
        if (!stepOrderLookup.TryGetValue(ManufacturingStatuses.NormalizeOrDefault(requiredStatus), out var requiredOrder))
        {
            return true;
        }

        if (!stepOrderLookup.TryGetValue(ManufacturingStatuses.NormalizeOrDefault(currentStatus), out var currentOrder))
        {
            return false;
        }

        return currentOrder >= requiredOrder;
    }

    private static bool IsStatusProgression(
        IReadOnlyDictionary<string, int> stepOrderLookup,
        string currentStatus,
        string nextStatus)
    {
        if (!stepOrderLookup.TryGetValue(ManufacturingStatuses.NormalizeOrDefault(currentStatus), out var currentOrder))
        {
            return true;
        }

        if (!stepOrderLookup.TryGetValue(ManufacturingStatuses.NormalizeOrDefault(nextStatus), out var nextOrder))
        {
            return true;
        }

        return nextOrder > currentOrder;
    }

    private async Task<IReadOnlyDictionary<string, int>> GetStepOrderLookupAsync(
        SqlConnection conn,
        SqlTransaction tx,
        CancellationToken cancellationToken)
    {
        if (!await TableExistsAsync(conn, "dbo.manufacturing_process_steps", cancellationToken, tx))
        {
            return ManufacturingStatuses.Defaults
                .Select((step, index) => new { Step = step, Order = index + 1 })
                .ToDictionary(item => item.Step, item => item.Order, StringComparer.OrdinalIgnoreCase);
        }

        const string sql = """
            SELECT step_key, sort_order
            FROM dbo.manufacturing_process_steps
            WHERE is_active = 1
            ORDER BY sort_order, id;
            """;

        var lookup = new Dictionary<string, int>(StringComparer.OrdinalIgnoreCase);
        await using var cmd = new SqlCommand(sql, conn, tx);
        await using var reader = await cmd.ExecuteReaderAsync(cancellationToken);
        while (await reader.ReadAsync(cancellationToken))
        {
            var key = ManufacturingStatuses.NormalizeOrDefault(GetString(reader, "step_key"));
            if (!lookup.ContainsKey(key))
            {
                lookup[key] = GetInt32(reader, "sort_order");
            }
        }

        if (lookup.Count == 0)
        {
            return ManufacturingStatuses.Defaults
                .Select((step, index) => new { Step = step, Order = index + 1 })
                .ToDictionary(item => item.Step, item => item.Order, StringComparer.OrdinalIgnoreCase);
        }

        return lookup;
    }

    private static bool HasAnyText(IReadOnlyList<string>? values)
    {
        return values is not null && values.Any(value => !string.IsNullOrWhiteSpace(value));
    }

    private async Task<bool> HasStepPhotoEvidenceAsync(
        SqlConnection conn,
        SqlTransaction tx,
        int projectId,
        string status,
        IReadOnlyList<string>? projectPhotos,
        IReadOnlyList<string>? activityPhotos,
        CancellationToken cancellationToken)
    {
        if (HasAnyText(activityPhotos) || HasAnyText(projectPhotos))
        {
            return true;
        }

        if (!await TableExistsAsync(conn, "dbo.manufacturing_activity_log", cancellationToken, tx) ||
            !await ColumnExistsAsync(conn, "dbo.manufacturing_activity_log", "photos_json", cancellationToken, tx))
        {
            return false;
        }

        const string sql = """
            SELECT COUNT(*)
            FROM dbo.manufacturing_activity_log
            WHERE project_id = @ProjectId
              AND status = @Status
              AND photos_json IS NOT NULL
              AND LTRIM(RTRIM(photos_json)) NOT IN ('', '[]', 'null');
            """;

        await using var cmd = new SqlCommand(sql, conn, tx);
        cmd.Parameters.AddWithValue("@ProjectId", projectId);
        cmd.Parameters.AddWithValue("@Status", ManufacturingStatuses.NormalizeOrDefault(status));
        var result = Convert.ToInt32(await cmd.ExecuteScalarAsync(cancellationToken) ?? 0);
        return result > 0;
    }

    private static async Task<bool> HasStepCommentEvidenceAsync(
        SqlConnection conn,
        SqlTransaction tx,
        int projectId,
        string status,
        string? usageNotes,
        CancellationToken cancellationToken)
    {
        if (!string.IsNullOrWhiteSpace(usageNotes))
        {
            return true;
        }

        const string sql = """
            SELECT COUNT(*)
            FROM dbo.manufacturing_activity_log
            WHERE project_id = @ProjectId
              AND status = @Status
              AND notes IS NOT NULL
              AND LTRIM(RTRIM(notes)) <> '';
            """;

        await using var cmd = new SqlCommand(sql, conn, tx);
        cmd.Parameters.AddWithValue("@ProjectId", projectId);
        cmd.Parameters.AddWithValue("@Status", ManufacturingStatuses.NormalizeOrDefault(status));
        var result = Convert.ToInt32(await cmd.ExecuteScalarAsync(cancellationToken) ?? 0);
        return result > 0;
    }

    private async Task EnsureManufacturingPersonExistsAsync(
        SqlConnection conn,
        SqlTransaction tx,
        string role,
        string? name,
        CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(name))
        {
            return;
        }

        if (!await TableExistsAsync(conn, "dbo.manufacturing_people", cancellationToken, tx))
        {
            return;
        }

        var normalizedRole = NormalizeManufacturingPersonRole(role);
        var normalizedName = name.Trim();

        const string existsSql = """
            SELECT TOP 1 id
            FROM dbo.manufacturing_people
            WHERE role = @Role
              AND name = @Name;
            """;

        await using (var existsCmd = new SqlCommand(existsSql, conn, tx))
        {
            existsCmd.Parameters.AddWithValue("@Role", normalizedRole);
            existsCmd.Parameters.AddWithValue("@Name", normalizedName);
            var existingId = await existsCmd.ExecuteScalarAsync(cancellationToken);
            if (existingId is not null && existingId != DBNull.Value)
            {
                return;
            }
        }

        const string insertSql = """
            INSERT INTO dbo.manufacturing_people (
                role,
                name,
                email,
                phone,
                is_active,
                updated_at_utc
            )
            VALUES (
                @Role,
                @Name,
                NULL,
                NULL,
                1,
                SYSUTCDATETIME()
            );
            """;

        await using var insertCmd = new SqlCommand(insertSql, conn, tx);
        insertCmd.Parameters.AddWithValue("@Role", normalizedRole);
        insertCmd.Parameters.AddWithValue("@Name", normalizedName);
        await insertCmd.ExecuteNonQueryAsync(cancellationToken);
    }

    private static string NormalizeManufacturingPersonRole(string? value)
    {
        var normalized = ManufacturingPersonRoles.NormalizeOrDefault(value, string.Empty);
        return normalized switch
        {
            ManufacturingPersonRoles.Designer => ManufacturingPersonRoles.Designer,
            ManufacturingPersonRoles.Craftsman => ManufacturingPersonRoles.Craftsman,
            _ => throw new ArgumentException("Role must be either 'designer' or 'craftsman'.")
        };
    }

    private static string? NormalizeManufacturingPersonRoleOrNull(string? value)
    {
        if (string.IsNullOrWhiteSpace(value))
        {
            return null;
        }

        var normalized = value.Trim().ToLowerInvariant();
        if (normalized == "all")
        {
            return null;
        }

        return NormalizeManufacturingPersonRole(normalized);
    }

    private async Task<IReadOnlyList<ManufacturingPersonResponse>> GetManufacturingPeopleInternalAsync(
        SqlConnection conn,
        SqlTransaction? tx,
        string? role,
        bool activeOnly,
        CancellationToken cancellationToken)
    {
        if (!await TableExistsAsync(conn, "dbo.manufacturing_people", cancellationToken, tx))
        {
            return [];
        }

        var normalizedRole = NormalizeManufacturingPersonRoleOrNull(role);
        var filters = new List<string>();
        if (!string.IsNullOrWhiteSpace(normalizedRole))
        {
            filters.Add("role = @Role");
        }
        if (activeOnly)
        {
            filters.Add("is_active = 1");
        }

        var whereClause = filters.Count == 0 ? string.Empty : $"WHERE {string.Join(" AND ", filters)}";
        var sql = $"""
            SELECT
                id,
                role,
                name,
                email,
                phone,
                is_active,
                created_at_utc,
                updated_at_utc
            FROM dbo.manufacturing_people
            {whereClause}
            ORDER BY
                CASE WHEN role = 'designer' THEN 0 ELSE 1 END,
                name ASC,
                id ASC;
            """;

        var items = new List<ManufacturingPersonResponse>();
        await using var cmd = new SqlCommand(sql, conn, tx);
        if (!string.IsNullOrWhiteSpace(normalizedRole))
        {
            cmd.Parameters.AddWithValue("@Role", normalizedRole);
        }

        await using var reader = await cmd.ExecuteReaderAsync(cancellationToken);
        while (await reader.ReadAsync(cancellationToken))
        {
            items.Add(MapManufacturingPerson(reader));
        }

        return items;
    }

    private static async Task<ManufacturingPersonResponse?> GetManufacturingPersonByIdAsync(
        SqlConnection conn,
        SqlTransaction? tx,
        int personId,
        CancellationToken cancellationToken)
    {
        const string sql = """
            SELECT
                id,
                role,
                name,
                email,
                phone,
                is_active,
                created_at_utc,
                updated_at_utc
            FROM dbo.manufacturing_people
            WHERE id = @PersonId;
            """;

        await using var cmd = new SqlCommand(sql, conn, tx);
        cmd.Parameters.AddWithValue("@PersonId", personId);
        await using var reader = await cmd.ExecuteReaderAsync(cancellationToken);
        if (!await reader.ReadAsync(cancellationToken))
        {
            return null;
        }

        return MapManufacturingPerson(reader);
    }

    private static bool IsSystemField(string key)
    {
        return string.Equals(key, "designerName", StringComparison.OrdinalIgnoreCase) ||
               string.Equals(key, "craftsmanName", StringComparison.OrdinalIgnoreCase);
    }

    private static IReadOnlyList<string> BuildDefaultMaterialOptions()
    {
        return ["Silver", "10K Gold", "18K Gold"];
    }

    private static IReadOnlyList<string> BuildDefaultMetalPlatingOptions()
    {
        return ["White Gold", "Gold", "Rose Gold"];
    }

    private static IReadOnlyList<string> NormalizeOptionValues(
        IReadOnlyList<string>? values,
        IReadOnlyList<string> fallback)
    {
        var normalized = values?
            .Where(value => !string.IsNullOrWhiteSpace(value))
            .Select(value => value.Trim())
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .ToList() ?? [];

        if (normalized.Count == 0)
        {
            return fallback;
        }

        return normalized;
    }

    private static IReadOnlyList<string> NormalizeSingleSelection(IReadOnlyList<string>? values)
    {
        var single = values?
            .Where(value => !string.IsNullOrWhiteSpace(value))
            .Select(value => value.Trim())
            .FirstOrDefault();

        return string.IsNullOrWhiteSpace(single) ? [] : [single];
    }

    private async Task<IReadOnlyList<string>> GetOptionSetOptionsAsync(
        SqlConnection conn,
        SqlTransaction? tx,
        string optionKey,
        IReadOnlyList<string> fallback,
        CancellationToken cancellationToken)
    {
        if (!await TableExistsAsync(conn, "dbo.manufacturing_option_sets", cancellationToken, tx))
        {
            return fallback;
        }

        const string sql = """
            SELECT TOP 1 options_json
            FROM dbo.manufacturing_option_sets
            WHERE option_key = @OptionKey;
            """;

        await using var cmd = new SqlCommand(sql, conn, tx);
        cmd.Parameters.AddWithValue("@OptionKey", optionKey);
        var raw = Convert.ToString(await cmd.ExecuteScalarAsync(cancellationToken));
        var normalized = DeserializeJsonArray(raw);
        return normalized.Count > 0 ? normalized : fallback;
    }

    private async Task UpsertOptionSetAsync(
        SqlConnection conn,
        SqlTransaction tx,
        string optionKey,
        string label,
        IReadOnlyList<string> values,
        CancellationToken cancellationToken)
    {
        if (!await TableExistsAsync(conn, "dbo.manufacturing_option_sets", cancellationToken, tx))
        {
            return;
        }

        const string sql = """
            MERGE dbo.manufacturing_option_sets AS target
            USING (
                SELECT
                    @OptionKey AS option_key,
                    @Label AS label,
                    @OptionsJson AS options_json
            ) AS source
            ON target.option_key = source.option_key
            WHEN MATCHED THEN
                UPDATE SET
                    label = source.label,
                    options_json = source.options_json,
                    updated_at_utc = SYSUTCDATETIME()
            WHEN NOT MATCHED THEN
                INSERT (option_key, label, options_json, updated_at_utc)
                VALUES (source.option_key, source.label, source.options_json, SYSUTCDATETIME());
            """;

        await using var cmd = new SqlCommand(sql, conn, tx);
        cmd.Parameters.AddWithValue("@OptionKey", optionKey);
        cmd.Parameters.AddWithValue("@Label", label);
        cmd.Parameters.AddWithValue("@OptionsJson", SerializeJsonArray(values));
        await cmd.ExecuteNonQueryAsync(cancellationToken);
    }

    private static string NormalizeStepKey(string? raw)
    {
        if (string.IsNullOrWhiteSpace(raw))
        {
            return string.Empty;
        }

        var cleaned = raw.Trim().Replace('-', '_').Replace(' ', '_');
        return string.Concat(cleaned.Where(ch => char.IsLetterOrDigit(ch) || ch == '_')).ToLowerInvariant();
    }

    private static string NormalizeFieldKey(string? raw)
    {
        if (string.IsNullOrWhiteSpace(raw))
        {
            return string.Empty;
        }

        var trimmed = raw.Trim();
        if (IsSystemField(trimmed))
        {
            return trimmed;
        }

        var cleaned = trimmed.Replace('-', '_').Replace(' ', '_');
        return string.Concat(cleaned.Where(ch => char.IsLetterOrDigit(ch) || ch == '_'));
    }

    private static string NormalizeFieldType(string? raw)
    {
        var value = string.IsNullOrWhiteSpace(raw) ? "text" : raw.Trim().ToLowerInvariant();
        return value switch
        {
            "text" => "text",
            "textarea" => "textarea",
            "number" => "number",
            "date" => "date",
            "select" => "select",
            _ => "text"
        };
    }

    private static async Task<bool> TableExistsAsync(
        SqlConnection conn,
        string tableName,
        CancellationToken cancellationToken,
        SqlTransaction? tx = null)
    {
        const string sql = "SELECT CASE WHEN OBJECT_ID(@TableName, 'U') IS NULL THEN 0 ELSE 1 END;";
        await using var cmd = new SqlCommand(sql, conn, tx);
        cmd.Parameters.AddWithValue("@TableName", tableName);
        var result = await cmd.ExecuteScalarAsync(cancellationToken);
        return Convert.ToInt32(result ?? 0) == 1;
    }

    private static async Task<bool> ColumnExistsAsync(
        SqlConnection conn,
        string tableName,
        string columnName,
        CancellationToken cancellationToken,
        SqlTransaction? tx = null)
    {
        const string sql = "SELECT CASE WHEN COL_LENGTH(@TableName, @ColumnName) IS NULL THEN 0 ELSE 1 END;";
        await using var cmd = new SqlCommand(sql, conn, tx);
        cmd.Parameters.AddWithValue("@TableName", tableName);
        cmd.Parameters.AddWithValue("@ColumnName", columnName);
        var result = await cmd.ExecuteScalarAsync(cancellationToken);
        return Convert.ToInt32(result ?? 0) == 1;
    }

    private static ManufacturingSettingsResponse BuildDefaultSettings()
    {
        var defaultSteps = ManufacturingStatuses.Defaults
            .Select((value, index) => new ManufacturingProcessStepResponse
            {
                StepKey = value,
                Label = value.Replace('_', ' '),
                SortOrder = index + 1,
                RequirePhoto = false,
                RequireComment = false,
                IsActive = true
            })
            .ToList();

        var defaultFields = new List<ManufacturingCustomFieldResponse>
        {
            new()
            {
                FieldKey = "designerName",
                Label = "Designer",
                FieldType = "text",
                SortOrder = 1,
                IsRequired = false,
                IsActive = true,
                IsSystem = true,
                Options = []
            },
            new()
            {
                FieldKey = "craftsmanName",
                Label = "Craftsman",
                FieldType = "text",
                SortOrder = 2,
                IsRequired = false,
                IsActive = true,
                IsSystem = true,
                Options = []
            }
        };

        return new ManufacturingSettingsResponse
        {
            Steps = defaultSteps,
            Fields = defaultFields,
            PieceTypeOptions = ManufacturingPieceTypes.Defaults,
            StatusOptions = ManufacturingStatuses.Defaults,
            MaterialOptions = BuildDefaultMaterialOptions(),
            MetalPlatingOptions = BuildDefaultMetalPlatingOptions()
        };
    }

    private async Task<IReadOnlyList<ManufacturingGemstoneUpsertRequest>> ResolveGemstonesForPersistenceAsync(
        SqlConnection conn,
        SqlTransaction tx,
        IReadOnlyList<ManufacturingGemstoneUpsertRequest> gemstones,
        CancellationToken cancellationToken)
    {
        if (gemstones.Count == 0)
        {
            return [];
        }

        var pricingById = new Dictionary<int, GemPricingRow>();
        var pricingByCode = new Dictionary<string, GemPricingRow>(StringComparer.OrdinalIgnoreCase);
        var resolved = new List<ManufacturingGemstoneUpsertRequest>();

        foreach (var gemstone in gemstones)
        {
            var piecesUsed = gemstone.PiecesUsed ?? 0m;
            var weightUsedCt = gemstone.WeightUsedCt ?? 0m;
            var normalizedCode = NormalizeGemstoneCode(gemstone.GemstoneCode);

            GemPricingRow? pricing = null;
            if (gemstone.InventoryItemId.HasValue)
            {
                if (!pricingById.TryGetValue(gemstone.InventoryItemId.Value, out pricing))
                {
                    pricing = await GetGemPricingByInventoryItemIdAsync(conn, tx, gemstone.InventoryItemId.Value, cancellationToken);
                    if (pricing is not null)
                    {
                        pricingById[gemstone.InventoryItemId.Value] = pricing;
                        if (!string.IsNullOrWhiteSpace(pricing.NormalizedGemstoneCode))
                        {
                            pricingByCode[pricing.NormalizedGemstoneCode] = pricing;
                        }
                    }
                }
            }

            if (pricing is null && !string.IsNullOrWhiteSpace(normalizedCode))
            {
                if (!pricingByCode.TryGetValue(normalizedCode, out pricing))
                {
                    pricing = await GetGemPricingByCodeAsync(conn, tx, normalizedCode, cancellationToken);
                    if (pricing is not null)
                    {
                        pricingByCode[normalizedCode] = pricing;
                        pricingById[pricing.InventoryItemId] = pricing;
                    }
                }
            }

            var lineCost = gemstone.LineCost ?? 0m;
            if (pricing is not null)
            {
                if (pricing.ParsedPricePerCt > 0m && weightUsedCt > 0m)
                {
                    lineCost = pricing.ParsedPricePerCt * weightUsedCt;
                }
                else if (pricing.ParsedPricePerPiece > 0m && piecesUsed > 0m)
                {
                    lineCost = pricing.ParsedPricePerPiece * piecesUsed;
                }
            }

            lineCost = decimal.Round(lineCost, 2, MidpointRounding.AwayFromZero);

            var resolvedCode = string.IsNullOrWhiteSpace(gemstone.GemstoneCode)
                ? pricing?.GemstoneCode
                : gemstone.GemstoneCode?.Trim();
            var resolvedType = string.IsNullOrWhiteSpace(gemstone.GemstoneType)
                ? pricing?.GemstoneType
                : gemstone.GemstoneType?.Trim();

            resolved.Add(new ManufacturingGemstoneUpsertRequest
            {
                InventoryItemId = gemstone.InventoryItemId ?? pricing?.InventoryItemId,
                GemstoneCode = string.IsNullOrWhiteSpace(resolvedCode) ? null : resolvedCode,
                GemstoneType = string.IsNullOrWhiteSpace(resolvedType) ? null : resolvedType,
                PiecesUsed = piecesUsed > 0m ? piecesUsed : null,
                WeightUsedCt = weightUsedCt > 0m ? weightUsedCt : null,
                LineCost = lineCost > 0m ? lineCost : null,
                Notes = string.IsNullOrWhiteSpace(gemstone.Notes) ? null : gemstone.Notes.Trim()
            });
        }

        return resolved;
    }

    private async Task<GemPricingRow?> GetGemPricingByInventoryItemIdAsync(
        SqlConnection conn,
        SqlTransaction tx,
        int inventoryItemId,
        CancellationToken cancellationToken)
    {
        const string sql = """
            SELECT TOP 1
                id,
                gemstone_number,
                gemstone_number_text,
                gemstone_type,
                parsed_price_per_ct,
                parsed_price_per_piece
            FROM dbo.gem_inventory_items
            WHERE id = @InventoryItemId;
            """;

        await using var cmd = new SqlCommand(sql, conn, tx);
        cmd.Parameters.AddWithValue("@InventoryItemId", inventoryItemId);
        await using var reader = await cmd.ExecuteReaderAsync(cancellationToken);
        if (!await reader.ReadAsync(cancellationToken))
        {
            return null;
        }

        return MapGemPricing(reader);
    }

    private async Task<GemPricingRow?> GetGemPricingByCodeAsync(
        SqlConnection conn,
        SqlTransaction tx,
        string normalizedGemCode,
        CancellationToken cancellationToken)
    {
        const string sql = """
            SELECT TOP 1
                id,
                gemstone_number,
                gemstone_number_text,
                gemstone_type,
                parsed_price_per_ct,
                parsed_price_per_piece
            FROM dbo.gem_inventory_items
            WHERE
                gemstone_number_text = @GemstoneCode
                OR gemstone_number_text = @GemstoneCodeHash
                OR CAST(gemstone_number AS NVARCHAR(64)) = @GemstoneCode
                OR CAST(gemstone_number AS NVARCHAR(64)) = @GemstoneCodeDigits
            ORDER BY id;
            """;

        var codeWithHash = normalizedGemCode.StartsWith("#", StringComparison.Ordinal)
            ? normalizedGemCode
            : $"#{normalizedGemCode}";
        var digitsOnly = new string(normalizedGemCode.Where(char.IsDigit).ToArray());

        await using var cmd = new SqlCommand(sql, conn, tx);
        cmd.Parameters.AddWithValue("@GemstoneCode", normalizedGemCode);
        cmd.Parameters.AddWithValue("@GemstoneCodeHash", codeWithHash);
        cmd.Parameters.AddWithValue("@GemstoneCodeDigits", string.IsNullOrWhiteSpace(digitsOnly) ? normalizedGemCode : digitsOnly);
        await using var reader = await cmd.ExecuteReaderAsync(cancellationToken);
        if (!await reader.ReadAsync(cancellationToken))
        {
            return null;
        }

        return MapGemPricing(reader);
    }

    private static GemPricingRow MapGemPricing(SqlDataReader reader)
    {
        var gemstoneCode = GetNullableString(reader, "gemstone_number_text");
        if (string.IsNullOrWhiteSpace(gemstoneCode))
        {
            var number = GetNullableInt32(reader, "gemstone_number");
            if (number.HasValue)
            {
                gemstoneCode = number.Value.ToString(CultureInfo.InvariantCulture);
            }
        }

        return new GemPricingRow
        {
            InventoryItemId = GetInt32(reader, "id"),
            GemstoneCode = gemstoneCode,
            NormalizedGemstoneCode = NormalizeGemstoneCode(gemstoneCode),
            GemstoneType = GetNullableString(reader, "gemstone_type"),
            ParsedPricePerCt = GetDecimal(reader, "parsed_price_per_ct"),
            ParsedPricePerPiece = GetDecimal(reader, "parsed_price_per_piece")
        };
    }

    private static string NormalizeGemstoneCode(string? raw)
    {
        if (string.IsNullOrWhiteSpace(raw))
        {
            return string.Empty;
        }

        var trimmed = raw.Trim();
        if (trimmed.StartsWith('#'))
        {
            trimmed = trimmed.TrimStart('#');
        }

        return trimmed.ToUpperInvariant();
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

    private async Task InsertActivityLogAsync(
        SqlConnection conn,
        SqlTransaction tx,
        int projectId,
        string status,
        string? craftsmanName,
        string notes,
        IReadOnlyList<string>? photos,
        CancellationToken cancellationToken)
    {
        var hasPhotosColumn = await ColumnExistsAsync(conn, "dbo.manufacturing_activity_log", "photos_json", cancellationToken, tx);
        var sql = hasPhotosColumn
            ? """
                INSERT INTO dbo.manufacturing_activity_log (
                    project_id,
                    status,
                    activity_at_utc,
                    craftsman_name,
                    notes,
                    photos_json
                )
                VALUES (
                    @ProjectId,
                    @Status,
                    SYSUTCDATETIME(),
                    @CraftsmanName,
                    @Notes,
                    @PhotosJson
                );
                """
            : """
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
        if (hasPhotosColumn)
        {
            cmd.Parameters.AddWithValue("@PhotosJson", SerializeJsonArray(photos));
        }

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
            Photos = DeserializeJsonArray(GetNullableString(reader, "photos_json")),
            CustomerSince = GetNullableDateTime(reader, "customer_since"),
            CreatedAtUtc = GetDateTime(reader, "created_at_utc"),
            UpdatedAtUtc = GetDateTime(reader, "updated_at_utc"),
            TotalSpent = GetDecimal(reader, "total_spent"),
            PurchaseCount = GetInt32(reader, "purchase_count"),
        };
    }

    private static SupplierResponse MapSupplier(SqlDataReader reader)
    {
        return new SupplierResponse
        {
            Id = GetGuid(reader, "id"),
            Name = GetString(reader, "name"),
            ContactName = GetNullableString(reader, "contact_name"),
            OrganizationName = GetNullableString(reader, "organization_name"),
            BranchName = GetNullableString(reader, "branch_name"),
            Email = GetNullableString(reader, "email"),
            Phone = GetNullableString(reader, "phone"),
            Address = GetNullableString(reader, "address"),
            TaxId = GetNullableString(reader, "tax_id"),
            SourceChannel = GetNullableString(reader, "source_channel"),
            ShippingAddress = GetNullableString(reader, "shipping_address"),
            ShippingEmail = GetNullableString(reader, "shipping_email"),
            ShippingPhone = GetNullableString(reader, "shipping_phone"),
            Notes = GetNullableString(reader, "notes"),
            CreatedAtUtc = GetDateTime(reader, "created_at_utc"),
            UpdatedAtUtc = GetDateTime(reader, "updated_at_utc"),
            TotalPurchasedAmount = GetDecimal(reader, "total_purchased_amount"),
            PurchaseCount = GetInt32(reader, "purchase_count"),
        };
    }

    private static SupplierPurchaseHistoryResponse MapSupplierPurchaseHistory(SqlDataReader reader)
    {
        return new SupplierPurchaseHistoryResponse
        {
            Id = GetInt64(reader, "id"),
            SupplierId = GetGuid(reader, "supplier_id"),
            PurchaseDate = GetNullableDateTime(reader, "purchase_date"),
            ReferenceNo = GetNullableString(reader, "reference_no"),
            Description = GetNullableString(reader, "description"),
            CurrencyCode = GetString(reader, "currency_code"),
            SubtotalAmount = GetNullableDecimal(reader, "subtotal_amount"),
            TaxAmount = GetNullableDecimal(reader, "tax_amount"),
            TotalAmount = GetNullableDecimal(reader, "total_amount"),
            Status = GetString(reader, "status"),
            Notes = GetNullableString(reader, "notes"),
            AttachmentUrls = DeserializeJsonArray(GetNullableString(reader, "attachment_urls_json")),
            CreatedAtUtc = GetDateTime(reader, "created_at_utc"),
            UpdatedAtUtc = GetDateTime(reader, "updated_at_utc"),
        };
    }

    private static GalleryAssetResponse MapGalleryAsset(SqlDataReader reader)
    {
        return new GalleryAssetResponse
        {
            Id = GetGuid(reader, "id"),
            PhotoUrl = GetString(reader, "photo_url"),
            AttachedCustomerId = GetNullableGuid(reader, "attached_customer_id"),
            AttachedCustomerName = GetNullableString(reader, "attached_customer_name"),
            AttachedProjectId = GetNullableInt32(reader, "attached_project_id"),
            AttachedManufacturingCode = GetNullableString(reader, "attached_manufacturing_code"),
            AttachedInventoryItemId = GetNullableInt32(reader, "attached_inventory_item_id"),
            AttachedGemstoneCode = GetNullableString(reader, "attached_gemstone_code"),
            CreatedBy = GetNullableString(reader, "created_by"),
            CreatedAtUtc = GetDateTime(reader, "created_at_utc"),
            UpdatedAtUtc = GetDateTime(reader, "updated_at_utc")
        };
    }

    private static ManufacturingPersonResponse MapManufacturingPerson(SqlDataReader reader)
    {
        return new ManufacturingPersonResponse
        {
            Id = GetInt32(reader, "id"),
            Role = ManufacturingPersonRoles.NormalizeOrDefault(GetString(reader, "role"), ManufacturingPersonRoles.Designer),
            Name = GetString(reader, "name"),
            Email = GetNullableString(reader, "email"),
            Phone = GetNullableString(reader, "phone"),
            IsActive = GetBoolean(reader, "is_active"),
            CreatedAtUtc = GetDateTime(reader, "created_at_utc"),
            UpdatedAtUtc = GetDateTime(reader, "updated_at_utc")
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
            MaximumDiscountedPrice = GetDecimal(reader, "maximum_discounted_price"),
            Budget = GetNullableDecimal(reader, "budget"),
            CompletionDate = GetNullableDateTime(reader, "completion_date"),
            CustomOrder = GetBoolean(reader, "custom_order"),
            Material = GetNullableString(reader, "material"),
            CustomerId = GetNullableGuid(reader, "customer_id"),
            CustomerName = GetNullableString(reader, "customer_name"),
            SoldAt = GetNullableDateTime(reader, "sold_at"),
            CreatedAtUtc = GetDateTime(reader, "created_at_utc"),
            UpdatedAtUtc = GetDateTime(reader, "updated_at_utc"),
            GemstoneCount = GetInt32(reader, "gemstone_count"),
            CustomFields = DeserializeJsonDictionary(GetNullableString(reader, "custom_fields_json")),
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
            MaximumDiscountedPrice = GetDecimal(reader, "maximum_discounted_price"),
            Budget = GetNullableDecimal(reader, "budget"),
            CompletionDate = GetNullableDateTime(reader, "completion_date"),
            CustomOrder = GetBoolean(reader, "custom_order"),
            Material = GetNullableString(reader, "material"),
            UsageNotes = GetNullableString(reader, "usage_notes"),
            Photos = DeserializeJsonArray(GetNullableString(reader, "photos_json")),
            CustomerId = GetNullableGuid(reader, "customer_id"),
            CustomerName = GetNullableString(reader, "customer_name"),
            SoldAt = GetNullableDateTime(reader, "sold_at"),
            CreatedAtUtc = GetDateTime(reader, "created_at_utc"),
            UpdatedAtUtc = GetDateTime(reader, "updated_at_utc"),
            CustomFields = DeserializeJsonDictionary(GetNullableString(reader, "custom_fields_json")),
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

    private static string SerializeJsonDictionary(IReadOnlyDictionary<string, string?>? values)
    {
        var normalized = values?
            .Where(item => !string.IsNullOrWhiteSpace(item.Key))
            .ToDictionary(
                item => item.Key.Trim(),
                item => string.IsNullOrWhiteSpace(item.Value) ? null : item.Value.Trim(),
                StringComparer.OrdinalIgnoreCase) ?? new Dictionary<string, string?>(StringComparer.OrdinalIgnoreCase);

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

    private static IReadOnlyDictionary<string, string?> DeserializeJsonDictionary(string? raw)
    {
        if (string.IsNullOrWhiteSpace(raw))
        {
            return new Dictionary<string, string?>();
        }

        try
        {
            var values = JsonSerializer.Deserialize<Dictionary<string, string?>>(raw);
            return values?
                .Where(item => !string.IsNullOrWhiteSpace(item.Key))
                .ToDictionary(
                    item => item.Key.Trim(),
                    item => string.IsNullOrWhiteSpace(item.Value) ? null : item.Value.Trim(),
                    StringComparer.OrdinalIgnoreCase) ?? new Dictionary<string, string?>();
        }
        catch
        {
            return new Dictionary<string, string?>();
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

    private static long GetInt64(SqlDataReader reader, string columnName)
    {
        var ordinal = GetOrdinal(reader, columnName);
        if (reader.IsDBNull(ordinal))
        {
            return 0L;
        }

        return Convert.ToInt64(reader.GetValue(ordinal));
    }

    private static bool GetBoolean(SqlDataReader reader, string columnName)
    {
        var ordinal = GetOrdinal(reader, columnName);
        if (reader.IsDBNull(ordinal))
        {
            return false;
        }

        return Convert.ToBoolean(reader.GetValue(ordinal));
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

    private static decimal? GetNullableDecimal(SqlDataReader reader, string columnName)
    {
        var ordinal = GetOrdinal(reader, columnName);
        if (reader.IsDBNull(ordinal))
        {
            return null;
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

    private sealed class GemPricingRow
    {
        public int InventoryItemId { get; init; }
        public string? GemstoneCode { get; init; }
        public string NormalizedGemstoneCode { get; init; } = string.Empty;
        public string? GemstoneType { get; init; }
        public decimal ParsedPricePerCt { get; init; }
        public decimal ParsedPricePerPiece { get; init; }
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
