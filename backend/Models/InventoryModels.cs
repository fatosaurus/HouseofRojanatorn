namespace backend.Models;

public sealed record PagedResponse<T>(
    IReadOnlyList<T> Items,
    int TotalCount,
    int Limit,
    int Offset);

public sealed class InventorySummaryResponse
{
    public int TotalItems { get; init; }
    public int LowStockItems { get; init; }
    public decimal TotalBalanceCarats { get; init; }
    public decimal TotalBalancePieces { get; init; }
    public decimal EstimatedInventoryValue { get; init; }
}

public class InventoryItemResponse
{
    public int Id { get; init; }
    public int? GemstoneNumber { get; init; }
    public string? GemstoneNumberText { get; init; }
    public string? GemstoneType { get; init; }
    public string? Shape { get; init; }
    public string? WeightPcsRaw { get; init; }
    public string? PricePerCtRaw { get; init; }
    public string? PricePerPieceRaw { get; init; }
    public DateTime? BuyingDate { get; init; }
    public string? OwnerName { get; init; }
    public decimal? BalancePcs { get; init; }
    public decimal? BalanceCt { get; init; }
    public decimal? ParsedWeightCt { get; init; }
    public decimal? ParsedQuantityPcs { get; init; }
    public decimal? ParsedPricePerCt { get; init; }
    public decimal? ParsedPricePerPiece { get; init; }
    public decimal EffectiveBalancePcs { get; init; }
    public decimal EffectiveBalanceCt { get; init; }
}

public sealed class InventoryUsageActivityResponse
{
    public int LineId { get; init; }
    public int BatchId { get; init; }
    public DateTime? TransactionDate { get; init; }
    public string? ProductCode { get; init; }
    public string ProductCategory { get; init; } = string.Empty;
    public string? RequesterName { get; init; }
    public decimal? UsedPcs { get; init; }
    public decimal? UsedWeightCt { get; init; }
    public decimal? LineAmount { get; init; }
    public decimal? BalancePcsAfter { get; init; }
    public decimal? BalanceCtAfter { get; init; }
}

public sealed class InventoryManufacturingActivityResponse
{
    public int ProjectId { get; init; }
    public string ManufacturingCode { get; init; } = string.Empty;
    public string PieceName { get; init; } = string.Empty;
    public string? PieceType { get; init; }
    public string Status { get; init; } = string.Empty;
    public DateTime? ActivityAtUtc { get; init; }
    public string? CraftsmanName { get; init; }
    public string? Notes { get; init; }
    public decimal PiecesUsed { get; init; }
    public decimal WeightUsedCt { get; init; }
    public decimal LineCost { get; init; }
}

public sealed class InventoryItemDetailResponse : InventoryItemResponse
{
    public IReadOnlyList<InventoryUsageActivityResponse> UsageActivities { get; init; } = [];
    public IReadOnlyList<InventoryManufacturingActivityResponse> ManufacturingActivities { get; init; } = [];
}

public sealed class UsageBatchResponse
{
    public int Id { get; init; }
    public string ProductCategory { get; init; } = string.Empty;
    public DateTime? TransactionDate { get; init; }
    public string? RequesterName { get; init; }
    public string? ProductCode { get; init; }
    public decimal? TotalAmount { get; init; }
    public int LineCount { get; init; }
}

public sealed class UsageLineResponse
{
    public int Id { get; init; }
    public int? GemstoneNumber { get; init; }
    public string? GemstoneName { get; init; }
    public decimal? UsedPcs { get; init; }
    public decimal? UsedWeightCt { get; init; }
    public string? UnitPriceRaw { get; init; }
    public decimal? LineAmount { get; init; }
    public decimal? BalancePcsAfter { get; init; }
    public decimal? BalanceCtAfter { get; init; }
    public string? RequesterName { get; init; }
}

public sealed record UsageBatchDetailResponse
{
    public int Id { get; init; }
    public string ProductCategory { get; init; } = string.Empty;
    public DateTime? TransactionDate { get; init; }
    public string? RequesterName { get; init; }
    public string? ProductCode { get; init; }
    public decimal? TotalAmount { get; init; }
    public string SourceSheet { get; init; } = string.Empty;
    public int? SourceRow { get; init; }
    public IReadOnlyList<UsageLineResponse> Lines { get; init; } = [];
}
