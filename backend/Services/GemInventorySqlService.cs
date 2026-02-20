using backend.Models;
using Microsoft.Data.SqlClient;
using System.Data;
using Microsoft.Extensions.Configuration;

namespace backend.Services;

public interface IGemInventorySqlService
{
    Task<InventorySummaryResponse> GetSummaryAsync(CancellationToken cancellationToken = default);
    Task<PagedResponse<InventoryItemResponse>> GetInventoryItemsAsync(
        string? search,
        string? type,
        string? status,
        int limit,
        int offset,
        CancellationToken cancellationToken = default);
    Task<InventoryItemDetailResponse?> GetInventoryItemByIdAsync(int id, CancellationToken cancellationToken = default);
    Task<PagedResponse<UsageBatchResponse>> GetUsageBatchesAsync(
        string? search,
        string? category,
        int limit,
        int offset,
        CancellationToken cancellationToken = default);
    Task<UsageBatchDetailResponse?> GetUsageBatchDetailAsync(int batchId, CancellationToken cancellationToken = default);
}

public sealed class GemInventorySqlService : IGemInventorySqlService
{
    private readonly string _connectionString;

    public GemInventorySqlService(IConfiguration configuration)
    {
        _connectionString = configuration["SqlConnection"]
            ?? throw new InvalidOperationException("Missing SqlConnection configuration value.");
    }

    public async Task<InventorySummaryResponse> GetSummaryAsync(CancellationToken cancellationToken = default)
    {
        const string sql = """
            SELECT
                COUNT(*) AS TotalItems,
                SUM(CASE
                    WHEN (
                        (COALESCE(balance_ct, parsed_weight_ct, 0) > 0 AND COALESCE(balance_ct, parsed_weight_ct, 0) <= 1)
                        OR (
                            COALESCE(balance_ct, parsed_weight_ct, 0) = 0
                            AND COALESCE(balance_pcs, parsed_quantity_pcs, 0) > 0
                            AND COALESCE(balance_pcs, parsed_quantity_pcs, 0) <= 10
                        )
                    ) THEN 1
                    ELSE 0
                END) AS LowStockItems,
                SUM(COALESCE(balance_ct, parsed_weight_ct, 0)) AS TotalBalanceCarats,
                SUM(COALESCE(balance_pcs, parsed_quantity_pcs, 0)) AS TotalBalancePieces,
                SUM(COALESCE(
                    parsed_price_per_piece * COALESCE(balance_pcs, parsed_quantity_pcs, 0),
                    parsed_price_per_ct * COALESCE(balance_ct, parsed_weight_ct, 0),
                    0
                )) AS EstimatedInventoryValue
            FROM dbo.gem_inventory_items;
            """;

        await using var conn = new SqlConnection(_connectionString);
        await conn.OpenAsync(cancellationToken);

        await using var cmd = new SqlCommand(sql, conn);
        await using var reader = await cmd.ExecuteReaderAsync(cancellationToken);
        if (!await reader.ReadAsync(cancellationToken))
        {
            return new InventorySummaryResponse();
        }

        return new InventorySummaryResponse
        {
            TotalItems = GetInt32(reader, "TotalItems"),
            LowStockItems = GetInt32(reader, "LowStockItems"),
            TotalBalanceCarats = GetDecimal(reader, "TotalBalanceCarats"),
            TotalBalancePieces = GetDecimal(reader, "TotalBalancePieces"),
            EstimatedInventoryValue = GetDecimal(reader, "EstimatedInventoryValue"),
        };
    }

    public async Task<PagedResponse<InventoryItemResponse>> GetInventoryItemsAsync(
        string? search,
        string? type,
        string? status,
        int limit,
        int offset,
        CancellationToken cancellationToken = default)
    {
        (limit, offset) = NormalizePaging(limit, offset);
        var clauses = BuildInventoryWhereClauses(search, type, status);
        var whereSql = clauses.Count == 0 ? string.Empty : "WHERE " + string.Join(" AND ", clauses);

        var countSql = $"SELECT COUNT(*) AS TotalCount FROM dbo.gem_inventory_items {whereSql};";
        var listSql = $"""
            SELECT
                id,
                gemstone_number,
                gemstone_number_text,
                gemstone_type,
                shape,
                weight_pcs_raw,
                price_per_ct_raw,
                price_per_piece_raw,
                buying_date,
                owner_name,
                balance_pcs,
                balance_ct,
                parsed_weight_ct,
                parsed_quantity_pcs,
                parsed_price_per_ct,
                parsed_price_per_piece,
                COALESCE(balance_pcs, parsed_quantity_pcs, 0) AS effective_balance_pcs,
                COALESCE(balance_ct, parsed_weight_ct, 0) AS effective_balance_ct
            FROM dbo.gem_inventory_items
            {whereSql}
            ORDER BY COALESCE(gemstone_number, 2147483647), id
            OFFSET @Offset ROWS FETCH NEXT @Limit ROWS ONLY;
            """;

        await using var conn = new SqlConnection(_connectionString);
        await conn.OpenAsync(cancellationToken);

        int totalCount;
        await using (var countCmd = new SqlCommand(countSql, conn))
        {
            ApplyInventoryParameters(countCmd, search, type, status);
            totalCount = Convert.ToInt32(await countCmd.ExecuteScalarAsync(cancellationToken) ?? 0);
        }

        var items = new List<InventoryItemResponse>();
        await using (var listCmd = new SqlCommand(listSql, conn))
        {
            ApplyInventoryParameters(listCmd, search, type, status);
            listCmd.Parameters.AddWithValue("@Offset", offset);
            listCmd.Parameters.AddWithValue("@Limit", limit);

            await using var reader = await listCmd.ExecuteReaderAsync(cancellationToken);
            while (await reader.ReadAsync(cancellationToken))
            {
                items.Add(new InventoryItemResponse
                {
                    Id = GetInt32(reader, "id"),
                    GemstoneNumber = GetNullableInt32(reader, "gemstone_number"),
                    GemstoneNumberText = GetNullableString(reader, "gemstone_number_text"),
                    GemstoneType = GetNullableString(reader, "gemstone_type"),
                    Shape = GetNullableString(reader, "shape"),
                    WeightPcsRaw = GetNullableString(reader, "weight_pcs_raw"),
                    PricePerCtRaw = GetNullableString(reader, "price_per_ct_raw"),
                    PricePerPieceRaw = GetNullableString(reader, "price_per_piece_raw"),
                    BuyingDate = GetNullableDateTime(reader, "buying_date"),
                    OwnerName = GetNullableString(reader, "owner_name"),
                    BalancePcs = GetNullableDecimal(reader, "balance_pcs"),
                    BalanceCt = GetNullableDecimal(reader, "balance_ct"),
                    ParsedWeightCt = GetNullableDecimal(reader, "parsed_weight_ct"),
                    ParsedQuantityPcs = GetNullableDecimal(reader, "parsed_quantity_pcs"),
                    ParsedPricePerCt = GetNullableDecimal(reader, "parsed_price_per_ct"),
                    ParsedPricePerPiece = GetNullableDecimal(reader, "parsed_price_per_piece"),
                    EffectiveBalancePcs = GetDecimal(reader, "effective_balance_pcs"),
                    EffectiveBalanceCt = GetDecimal(reader, "effective_balance_ct"),
                });
            }
        }

        return new PagedResponse<InventoryItemResponse>(items, totalCount, limit, offset);
    }

    public async Task<InventoryItemDetailResponse?> GetInventoryItemByIdAsync(int id, CancellationToken cancellationToken = default)
    {
        const string itemSql = """
            SELECT
                id,
                gemstone_number,
                gemstone_number_text,
                gemstone_type,
                shape,
                weight_pcs_raw,
                price_per_ct_raw,
                price_per_piece_raw,
                buying_date,
                owner_name,
                balance_pcs,
                balance_ct,
                parsed_weight_ct,
                parsed_quantity_pcs,
                parsed_price_per_ct,
                parsed_price_per_piece,
                COALESCE(balance_pcs, parsed_quantity_pcs, 0) AS effective_balance_pcs,
                COALESCE(balance_ct, parsed_weight_ct, 0) AS effective_balance_ct
            FROM dbo.gem_inventory_items
            WHERE id = @Id;
            """;

        const string usageActivitySql = """
            SELECT
                l.id AS line_id,
                b.id AS batch_id,
                b.transaction_date,
                b.product_code,
                b.product_category,
                COALESCE(l.requester_name, b.requester_name) AS requester_name,
                l.used_pcs,
                l.used_weight_ct,
                l.line_amount,
                l.balance_pcs_after,
                l.balance_ct_after
            FROM dbo.gem_usage_lines l
            INNER JOIN dbo.gem_usage_batches b
                ON b.id = l.batch_id
            WHERE @GemstoneNumber IS NOT NULL
              AND l.gemstone_number = @GemstoneNumber
            ORDER BY b.transaction_date DESC, b.id DESC, l.id DESC;
            """;

        const string manufacturingActivitySql = """
            WITH linked AS (
                SELECT
                    project_id,
                    SUM(pieces_used) AS pieces_used,
                    SUM(weight_used_ct) AS weight_used_ct,
                    SUM(line_cost) AS line_cost
                FROM dbo.manufacturing_project_gemstones
                WHERE inventory_item_id = @InventoryItemId
                GROUP BY project_id
            )
            SELECT
                mp.id AS project_id,
                mp.manufacturing_code,
                mp.piece_name,
                mp.piece_type,
                COALESCE(mal.status, mp.status) AS status,
                COALESCE(mal.activity_at_utc, mp.updated_at_utc) AS activity_at_utc,
                COALESCE(mal.craftsman_name, mp.craftsman_name) AS craftsman_name,
                COALESCE(mal.notes, mp.usage_notes) AS notes,
                linked.pieces_used,
                linked.weight_used_ct,
                linked.line_cost
            FROM linked
            INNER JOIN dbo.manufacturing_projects mp
                ON mp.id = linked.project_id
            LEFT JOIN dbo.manufacturing_activity_log mal
                ON mal.project_id = mp.id
            ORDER BY COALESCE(mal.activity_at_utc, mp.updated_at_utc) DESC, mp.id DESC, mal.id DESC;
            """;

        await using var conn = new SqlConnection(_connectionString);
        await conn.OpenAsync(cancellationToken);

        InventoryItemDetailResponse item;
        await using (var cmd = new SqlCommand(itemSql, conn))
        {
            cmd.Parameters.AddWithValue("@Id", id);
            await using var reader = await cmd.ExecuteReaderAsync(cancellationToken);
            if (!await reader.ReadAsync(cancellationToken))
            {
                return null;
            }

            item = new InventoryItemDetailResponse
            {
                Id = GetInt32(reader, "id"),
                GemstoneNumber = GetNullableInt32(reader, "gemstone_number"),
                GemstoneNumberText = GetNullableString(reader, "gemstone_number_text"),
                GemstoneType = GetNullableString(reader, "gemstone_type"),
                Shape = GetNullableString(reader, "shape"),
                WeightPcsRaw = GetNullableString(reader, "weight_pcs_raw"),
                PricePerCtRaw = GetNullableString(reader, "price_per_ct_raw"),
                PricePerPieceRaw = GetNullableString(reader, "price_per_piece_raw"),
                BuyingDate = GetNullableDateTime(reader, "buying_date"),
                OwnerName = GetNullableString(reader, "owner_name"),
                BalancePcs = GetNullableDecimal(reader, "balance_pcs"),
                BalanceCt = GetNullableDecimal(reader, "balance_ct"),
                ParsedWeightCt = GetNullableDecimal(reader, "parsed_weight_ct"),
                ParsedQuantityPcs = GetNullableDecimal(reader, "parsed_quantity_pcs"),
                ParsedPricePerCt = GetNullableDecimal(reader, "parsed_price_per_ct"),
                ParsedPricePerPiece = GetNullableDecimal(reader, "parsed_price_per_piece"),
                EffectiveBalancePcs = GetDecimal(reader, "effective_balance_pcs"),
                EffectiveBalanceCt = GetDecimal(reader, "effective_balance_ct"),
            };
        }

        var usageActivities = new List<InventoryUsageActivityResponse>();
        await using (var usageCmd = new SqlCommand(usageActivitySql, conn))
        {
            var gemstoneNumberParam = usageCmd.Parameters.Add("@GemstoneNumber", SqlDbType.Int);
            gemstoneNumberParam.Value = item.GemstoneNumber is null ? DBNull.Value : item.GemstoneNumber.Value;
            await using var usageReader = await usageCmd.ExecuteReaderAsync(cancellationToken);
            while (await usageReader.ReadAsync(cancellationToken))
            {
                usageActivities.Add(new InventoryUsageActivityResponse
                {
                    LineId = GetInt32(usageReader, "line_id"),
                    BatchId = GetInt32(usageReader, "batch_id"),
                    TransactionDate = GetNullableDateTime(usageReader, "transaction_date"),
                    ProductCode = GetNullableString(usageReader, "product_code"),
                    ProductCategory = GetString(usageReader, "product_category"),
                    RequesterName = GetNullableString(usageReader, "requester_name"),
                    UsedPcs = GetNullableDecimal(usageReader, "used_pcs"),
                    UsedWeightCt = GetNullableDecimal(usageReader, "used_weight_ct"),
                    LineAmount = GetNullableDecimal(usageReader, "line_amount"),
                    BalancePcsAfter = GetNullableDecimal(usageReader, "balance_pcs_after"),
                    BalanceCtAfter = GetNullableDecimal(usageReader, "balance_ct_after"),
                });
            }
        }

        var manufacturingActivities = new List<InventoryManufacturingActivityResponse>();
        await using (var manufacturingCmd = new SqlCommand(manufacturingActivitySql, conn))
        {
            manufacturingCmd.Parameters.AddWithValue("@InventoryItemId", id);
            await using var manufacturingReader = await manufacturingCmd.ExecuteReaderAsync(cancellationToken);
            while (await manufacturingReader.ReadAsync(cancellationToken))
            {
                manufacturingActivities.Add(new InventoryManufacturingActivityResponse
                {
                    ProjectId = GetInt32(manufacturingReader, "project_id"),
                    ManufacturingCode = GetString(manufacturingReader, "manufacturing_code"),
                    PieceName = GetString(manufacturingReader, "piece_name"),
                    PieceType = GetNullableString(manufacturingReader, "piece_type"),
                    Status = GetString(manufacturingReader, "status"),
                    ActivityAtUtc = GetNullableDateTime(manufacturingReader, "activity_at_utc"),
                    CraftsmanName = GetNullableString(manufacturingReader, "craftsman_name"),
                    Notes = GetNullableString(manufacturingReader, "notes"),
                    PiecesUsed = GetDecimal(manufacturingReader, "pieces_used"),
                    WeightUsedCt = GetDecimal(manufacturingReader, "weight_used_ct"),
                    LineCost = GetDecimal(manufacturingReader, "line_cost"),
                });
            }
        }

        return new InventoryItemDetailResponse
        {
            Id = item.Id,
            GemstoneNumber = item.GemstoneNumber,
            GemstoneNumberText = item.GemstoneNumberText,
            GemstoneType = item.GemstoneType,
            Shape = item.Shape,
            WeightPcsRaw = item.WeightPcsRaw,
            PricePerCtRaw = item.PricePerCtRaw,
            PricePerPieceRaw = item.PricePerPieceRaw,
            BuyingDate = item.BuyingDate,
            OwnerName = item.OwnerName,
            BalancePcs = item.BalancePcs,
            BalanceCt = item.BalanceCt,
            ParsedWeightCt = item.ParsedWeightCt,
            ParsedQuantityPcs = item.ParsedQuantityPcs,
            ParsedPricePerCt = item.ParsedPricePerCt,
            ParsedPricePerPiece = item.ParsedPricePerPiece,
            EffectiveBalancePcs = item.EffectiveBalancePcs,
            EffectiveBalanceCt = item.EffectiveBalanceCt,
            UsageActivities = usageActivities,
            ManufacturingActivities = manufacturingActivities,
        };
    }

    public async Task<PagedResponse<UsageBatchResponse>> GetUsageBatchesAsync(
        string? search,
        string? category,
        int limit,
        int offset,
        CancellationToken cancellationToken = default)
    {
        (limit, offset) = NormalizePaging(limit, offset);
        var clauses = BuildUsageWhereClauses(search, category);
        var whereSql = clauses.Count == 0 ? string.Empty : "WHERE " + string.Join(" AND ", clauses);

        var countSql = $"SELECT COUNT(*) AS TotalCount FROM dbo.gem_usage_batches {whereSql};";
        var listSql = $"""
            SELECT
                b.id,
                b.product_category,
                b.transaction_date,
                b.requester_name,
                b.product_code,
                b.total_amount,
                (
                    SELECT COUNT(*)
                    FROM dbo.gem_usage_lines l
                    WHERE l.batch_id = b.id
                ) AS line_count
            FROM dbo.gem_usage_batches b
            {whereSql}
            ORDER BY b.transaction_date DESC, b.id DESC
            OFFSET @Offset ROWS FETCH NEXT @Limit ROWS ONLY;
            """;

        await using var conn = new SqlConnection(_connectionString);
        await conn.OpenAsync(cancellationToken);

        int totalCount;
        await using (var countCmd = new SqlCommand(countSql, conn))
        {
            ApplyUsageParameters(countCmd, search, category);
            totalCount = Convert.ToInt32(await countCmd.ExecuteScalarAsync(cancellationToken) ?? 0);
        }

        var items = new List<UsageBatchResponse>();
        await using (var listCmd = new SqlCommand(listSql, conn))
        {
            ApplyUsageParameters(listCmd, search, category);
            listCmd.Parameters.AddWithValue("@Offset", offset);
            listCmd.Parameters.AddWithValue("@Limit", limit);

            await using var reader = await listCmd.ExecuteReaderAsync(cancellationToken);
            while (await reader.ReadAsync(cancellationToken))
            {
                items.Add(new UsageBatchResponse
                {
                    Id = GetInt32(reader, "id"),
                    ProductCategory = GetString(reader, "product_category"),
                    TransactionDate = GetNullableDateTime(reader, "transaction_date"),
                    RequesterName = GetNullableString(reader, "requester_name"),
                    ProductCode = GetNullableString(reader, "product_code"),
                    TotalAmount = GetNullableDecimal(reader, "total_amount"),
                    LineCount = GetInt32(reader, "line_count"),
                });
            }
        }

        return new PagedResponse<UsageBatchResponse>(items, totalCount, limit, offset);
    }

    public async Task<UsageBatchDetailResponse?> GetUsageBatchDetailAsync(int batchId, CancellationToken cancellationToken = default)
    {
        const string batchSql = """
            SELECT
                id,
                source_sheet,
                source_row,
                product_category,
                transaction_date,
                requester_name,
                product_code,
                total_amount
            FROM dbo.gem_usage_batches
            WHERE id = @Id;
            """;

        const string linesSql = """
            SELECT
                id,
                gemstone_number,
                gemstone_name,
                used_pcs,
                used_weight_ct,
                unit_price_raw,
                line_amount,
                balance_pcs_after,
                balance_ct_after,
                requester_name
            FROM dbo.gem_usage_lines
            WHERE batch_id = @Id
            ORDER BY id;
            """;

        await using var conn = new SqlConnection(_connectionString);
        await conn.OpenAsync(cancellationToken);

        UsageBatchDetailResponse? batch;
        await using (var batchCmd = new SqlCommand(batchSql, conn))
        {
            batchCmd.Parameters.AddWithValue("@Id", batchId);
            await using var reader = await batchCmd.ExecuteReaderAsync(cancellationToken);
            if (!await reader.ReadAsync(cancellationToken))
            {
                return null;
            }

            batch = new UsageBatchDetailResponse
            {
                Id = GetInt32(reader, "id"),
                SourceSheet = GetString(reader, "source_sheet"),
                SourceRow = GetNullableInt32(reader, "source_row"),
                ProductCategory = GetString(reader, "product_category"),
                TransactionDate = GetNullableDateTime(reader, "transaction_date"),
                RequesterName = GetNullableString(reader, "requester_name"),
                ProductCode = GetNullableString(reader, "product_code"),
                TotalAmount = GetNullableDecimal(reader, "total_amount"),
            };
        }

        var lines = new List<UsageLineResponse>();
        await using (var linesCmd = new SqlCommand(linesSql, conn))
        {
            linesCmd.Parameters.AddWithValue("@Id", batchId);
            await using var reader = await linesCmd.ExecuteReaderAsync(cancellationToken);
            while (await reader.ReadAsync(cancellationToken))
            {
                lines.Add(new UsageLineResponse
                {
                    Id = GetInt32(reader, "id"),
                    GemstoneNumber = GetNullableInt32(reader, "gemstone_number"),
                    GemstoneName = GetNullableString(reader, "gemstone_name"),
                    UsedPcs = GetNullableDecimal(reader, "used_pcs"),
                    UsedWeightCt = GetNullableDecimal(reader, "used_weight_ct"),
                    UnitPriceRaw = GetNullableString(reader, "unit_price_raw"),
                    LineAmount = GetNullableDecimal(reader, "line_amount"),
                    BalancePcsAfter = GetNullableDecimal(reader, "balance_pcs_after"),
                    BalanceCtAfter = GetNullableDecimal(reader, "balance_ct_after"),
                    RequesterName = GetNullableString(reader, "requester_name"),
                });
            }
        }

        return batch with { Lines = lines };
    }

    private static List<string> BuildInventoryWhereClauses(string? search, string? type, string? status)
    {
        var clauses = new List<string>();

        if (!string.IsNullOrWhiteSpace(search))
        {
            clauses.Add(
                "(gemstone_type LIKE @Search OR shape LIKE @Search OR owner_name LIKE @Search OR gemstone_number_text LIKE @Search)"
            );
        }

        if (!string.IsNullOrWhiteSpace(type) && !type.Equals("all", StringComparison.OrdinalIgnoreCase))
        {
            clauses.Add("gemstone_type LIKE @TypeFilter");
        }

        if (!string.IsNullOrWhiteSpace(status) && !status.Equals("all", StringComparison.OrdinalIgnoreCase))
        {
            if (status.Equals("available", StringComparison.OrdinalIgnoreCase))
            {
                clauses.Add("(COALESCE(balance_ct, parsed_weight_ct, 0) > 0 OR COALESCE(balance_pcs, parsed_quantity_pcs, 0) > 0)");
            }
            else if (status.Equals("low-stock", StringComparison.OrdinalIgnoreCase))
            {
                clauses.Add(
                    "(" +
                    "(COALESCE(balance_ct, parsed_weight_ct, 0) > 0 AND COALESCE(balance_ct, parsed_weight_ct, 0) <= 1) " +
                    "OR (" +
                    "COALESCE(balance_ct, parsed_weight_ct, 0) = 0 " +
                    "AND COALESCE(balance_pcs, parsed_quantity_pcs, 0) > 0 " +
                    "AND COALESCE(balance_pcs, parsed_quantity_pcs, 0) <= 10" +
                    ")" +
                    ")"
                );
            }
            else if (status.Equals("out-of-stock", StringComparison.OrdinalIgnoreCase))
            {
                clauses.Add("(COALESCE(balance_ct, parsed_weight_ct, 0) <= 0 AND COALESCE(balance_pcs, parsed_quantity_pcs, 0) <= 0)");
            }
        }

        return clauses;
    }

    private static void ApplyInventoryParameters(SqlCommand command, string? search, string? type, string? status)
    {
        if (!string.IsNullOrWhiteSpace(search))
        {
            command.Parameters.AddWithValue("@Search", $"%{search.Trim()}%");
        }
        if (!string.IsNullOrWhiteSpace(type) && !type.Equals("all", StringComparison.OrdinalIgnoreCase))
        {
            command.Parameters.AddWithValue("@TypeFilter", $"%{type.Trim()}%");
        }

        if (!string.IsNullOrWhiteSpace(status) && !status.Equals("all", StringComparison.OrdinalIgnoreCase))
        {
            command.Parameters.AddWithValue("@StatusFilter", status.Trim());
        }
    }

    private static List<string> BuildUsageWhereClauses(string? search, string? category)
    {
        var clauses = new List<string>();
        if (!string.IsNullOrWhiteSpace(search))
        {
            clauses.Add("(b.product_code LIKE @Search OR b.requester_name LIKE @Search OR b.source_sheet LIKE @Search)");
        }

        if (!string.IsNullOrWhiteSpace(category) && !category.Equals("all", StringComparison.OrdinalIgnoreCase))
        {
            clauses.Add("b.product_category = @Category");
        }

        return clauses;
    }

    private static void ApplyUsageParameters(SqlCommand command, string? search, string? category)
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

    private static (int Limit, int Offset) NormalizePaging(int limit, int offset)
    {
        var safeLimit = Math.Clamp(limit, 1, 200);
        var safeOffset = Math.Max(offset, 0);
        return (safeLimit, safeOffset);
    }

    private static int GetOrdinal(SqlDataReader reader, string columnName) => reader.GetOrdinal(columnName);

    private static string GetString(SqlDataReader reader, string columnName)
    {
        var ordinal = GetOrdinal(reader, columnName);
        return reader.IsDBNull(ordinal) ? string.Empty : reader.GetString(ordinal);
    }

    private static string? GetNullableString(SqlDataReader reader, string columnName)
    {
        var ordinal = GetOrdinal(reader, columnName);
        return reader.IsDBNull(ordinal) ? null : reader.GetString(ordinal);
    }

    private static int GetInt32(SqlDataReader reader, string columnName)
    {
        var ordinal = GetOrdinal(reader, columnName);
        if (reader.IsDBNull(ordinal)) return 0;
        return Convert.ToInt32(reader.GetValue(ordinal));
    }

    private static int? GetNullableInt32(SqlDataReader reader, string columnName)
    {
        var ordinal = GetOrdinal(reader, columnName);
        if (reader.IsDBNull(ordinal)) return null;
        return Convert.ToInt32(reader.GetValue(ordinal));
    }

    private static decimal GetDecimal(SqlDataReader reader, string columnName)
    {
        var ordinal = GetOrdinal(reader, columnName);
        if (reader.IsDBNull(ordinal)) return 0m;
        return Convert.ToDecimal(reader.GetValue(ordinal));
    }

    private static decimal? GetNullableDecimal(SqlDataReader reader, string columnName)
    {
        var ordinal = GetOrdinal(reader, columnName);
        if (reader.IsDBNull(ordinal)) return null;
        return Convert.ToDecimal(reader.GetValue(ordinal));
    }

    private static DateTime? GetNullableDateTime(SqlDataReader reader, string columnName)
    {
        var ordinal = GetOrdinal(reader, columnName);
        if (reader.IsDBNull(ordinal)) return null;
        return Convert.ToDateTime(reader.GetValue(ordinal));
    }
}
