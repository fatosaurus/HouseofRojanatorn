namespace backend.Models;

public static class ManufacturingStatuses
{
    public const string Approved = "approved";
    public const string SentToCraftsman = "sent_to_craftsman";
    public const string InternalSettingQc = "internal_setting_qc";
    public const string DiamondSorting = "diamond_sorting";
    public const string StoneSetting = "stone_setting";
    public const string Plating = "plating";
    public const string FinalPieceQc = "final_piece_qc";
    public const string CompletePiece = "complete_piece";
    public const string ReadyForSale = "ready_for_sale";
    public const string Sold = "sold";

    public static readonly IReadOnlyList<string> Defaults = new[]
    {
        Approved,
        SentToCraftsman,
        InternalSettingQc,
        DiamondSorting,
        StoneSetting,
        Plating,
        FinalPieceQc,
        CompletePiece,
        ReadyForSale,
        Sold,
    };

    public static string NormalizeOrDefault(string? value, string fallback = Approved)
    {
        if (string.IsNullOrWhiteSpace(value))
        {
            return fallback;
        }

        var normalized = value
            .Trim()
            .ToLowerInvariant()
            .Replace('-', '_')
            .Replace(' ', '_');

        return string.IsNullOrWhiteSpace(normalized) ? fallback : normalized;
    }
}

public static class ManufacturingPieceTypes
{
    public static readonly IReadOnlySet<string> Allowed = new HashSet<string>(StringComparer.OrdinalIgnoreCase)
    {
        "earrings",
        "bracelet",
        "choker",
        "necklace",
        "brooch",
        "ring",
        "pendant",
        "other",
    };

    public static string? NormalizeOrNull(string? value)
    {
        if (string.IsNullOrWhiteSpace(value))
        {
            return null;
        }

        var normalized = value.Trim().ToLowerInvariant();
        return Allowed.Contains(normalized) ? normalized : null;
    }
}

public sealed class CustomerResponse
{
    public Guid Id { get; init; }
    public string Name { get; init; } = string.Empty;
    public string? Nickname { get; init; }
    public string? Email { get; init; }
    public string? Phone { get; init; }
    public string? Address { get; init; }
    public string? Notes { get; init; }
    public string? PhotoUrl { get; init; }
    public DateTime? CustomerSince { get; init; }
    public DateTime CreatedAtUtc { get; init; }
    public DateTime UpdatedAtUtc { get; init; }
    public decimal TotalSpent { get; init; }
    public int PurchaseCount { get; init; }
}

public sealed class CustomerUpsertRequest
{
    public string? Name { get; init; }
    public string? Nickname { get; init; }
    public string? Email { get; init; }
    public string? Phone { get; init; }
    public string? Address { get; init; }
    public string? Notes { get; init; }
    public string? PhotoUrl { get; init; }
    public DateTime? CustomerSince { get; init; }
}

public sealed class CustomerNoteRequest
{
    public string? Note { get; init; }
}

public sealed class CustomerActivityResponse
{
    public int Id { get; init; }
    public int ProjectId { get; init; }
    public string ManufacturingCode { get; init; } = string.Empty;
    public string PieceName { get; init; } = string.Empty;
    public string Status { get; init; } = string.Empty;
    public DateTime ActivityAtUtc { get; init; }
    public string? CraftsmanName { get; init; }
    public string? Notes { get; init; }
}

public sealed class ManufacturingGemstoneResponse
{
    public int Id { get; init; }
    public int? InventoryItemId { get; init; }
    public string? GemstoneCode { get; init; }
    public string? GemstoneType { get; init; }
    public decimal PiecesUsed { get; init; }
    public decimal WeightUsedCt { get; init; }
    public decimal LineCost { get; init; }
    public string? Notes { get; init; }
}

public sealed class ManufacturingActivityLogResponse
{
    public int Id { get; init; }
    public string Status { get; init; } = string.Empty;
    public DateTime ActivityAtUtc { get; init; }
    public string? CraftsmanName { get; init; }
    public string? Notes { get; init; }
}

public sealed class ManufacturingProjectSummaryResponse
{
    public int Id { get; init; }
    public string ManufacturingCode { get; init; } = string.Empty;
    public string PieceName { get; init; } = string.Empty;
    public string? PieceType { get; init; }
    public DateTime? DesignDate { get; init; }
    public string? DesignerName { get; init; }
    public string Status { get; init; } = ManufacturingStatuses.Approved;
    public string? CraftsmanName { get; init; }
    public IReadOnlyList<string> MetalPlating { get; init; } = [];
    public decimal SettingCost { get; init; }
    public decimal DiamondCost { get; init; }
    public decimal GemstoneCost { get; init; }
    public decimal TotalCost { get; init; }
    public decimal SellingPrice { get; init; }
    public DateTime? CompletionDate { get; init; }
    public Guid? CustomerId { get; init; }
    public string? CustomerName { get; init; }
    public DateTime? SoldAt { get; init; }
    public DateTime CreatedAtUtc { get; init; }
    public DateTime UpdatedAtUtc { get; init; }
    public int GemstoneCount { get; init; }
    public IReadOnlyDictionary<string, string?> CustomFields { get; init; } = new Dictionary<string, string?>();
}

public sealed class ManufacturingProjectDetailResponse
{
    public int Id { get; init; }
    public string ManufacturingCode { get; init; } = string.Empty;
    public string PieceName { get; init; } = string.Empty;
    public string? PieceType { get; init; }
    public DateTime? DesignDate { get; init; }
    public string? DesignerName { get; init; }
    public string Status { get; init; } = ManufacturingStatuses.Approved;
    public string? CraftsmanName { get; init; }
    public IReadOnlyList<string> MetalPlating { get; init; } = [];
    public string? MetalPlatingNotes { get; init; }
    public decimal SettingCost { get; init; }
    public decimal DiamondCost { get; init; }
    public decimal GemstoneCost { get; init; }
    public decimal TotalCost { get; init; }
    public decimal SellingPrice { get; init; }
    public DateTime? CompletionDate { get; init; }
    public string? UsageNotes { get; init; }
    public IReadOnlyList<string> Photos { get; init; } = [];
    public Guid? CustomerId { get; init; }
    public string? CustomerName { get; init; }
    public DateTime? SoldAt { get; init; }
    public DateTime CreatedAtUtc { get; init; }
    public DateTime UpdatedAtUtc { get; init; }
    public IReadOnlyList<ManufacturingGemstoneResponse> Gemstones { get; init; } = [];
    public IReadOnlyList<ManufacturingActivityLogResponse> ActivityLog { get; init; } = [];
    public IReadOnlyDictionary<string, string?> CustomFields { get; init; } = new Dictionary<string, string?>();
}

public sealed class ManufacturingGemstoneUpsertRequest
{
    public int? InventoryItemId { get; init; }
    public string? GemstoneCode { get; init; }
    public string? GemstoneType { get; init; }
    public decimal? PiecesUsed { get; init; }
    public decimal? WeightUsedCt { get; init; }
    public decimal? LineCost { get; init; }
    public string? Notes { get; init; }
}

public sealed class ManufacturingProjectUpsertRequest
{
    public string? ManufacturingCode { get; init; }
    public string? PieceName { get; init; }
    public string? PieceType { get; init; }
    public DateTime? DesignDate { get; init; }
    public string? DesignerName { get; init; }
    public string? Status { get; init; }
    public string? CraftsmanName { get; init; }
    public IReadOnlyList<string>? MetalPlating { get; init; }
    public string? MetalPlatingNotes { get; init; }
    public decimal? SettingCost { get; init; }
    public decimal? DiamondCost { get; init; }
    public decimal? GemstoneCost { get; init; }
    public decimal? TotalCost { get; init; }
    public decimal? SellingPrice { get; init; }
    public DateTime? CompletionDate { get; init; }
    public string? UsageNotes { get; init; }
    public IReadOnlyList<string>? Photos { get; init; }
    public Guid? CustomerId { get; init; }
    public DateTime? SoldAt { get; init; }
    public IReadOnlyList<ManufacturingGemstoneUpsertRequest>? Gemstones { get; init; }
    public string? ActivityNote { get; init; }
    public IReadOnlyDictionary<string, string?>? CustomFields { get; init; }
}

public sealed class ManufacturingProcessStepResponse
{
    public string StepKey { get; init; } = string.Empty;
    public string Label { get; init; } = string.Empty;
    public int SortOrder { get; init; }
    public bool RequirePhoto { get; init; }
    public bool RequireComment { get; init; }
    public bool IsActive { get; init; }
}

public sealed class ManufacturingCustomFieldResponse
{
    public string FieldKey { get; init; } = string.Empty;
    public string Label { get; init; } = string.Empty;
    public string FieldType { get; init; } = "text";
    public int SortOrder { get; init; }
    public bool IsRequired { get; init; }
    public bool IsActive { get; init; }
    public bool IsSystem { get; init; }
    public IReadOnlyList<string> Options { get; init; } = [];
}

public sealed class ManufacturingSettingsResponse
{
    public IReadOnlyList<ManufacturingProcessStepResponse> Steps { get; init; } = [];
    public IReadOnlyList<ManufacturingCustomFieldResponse> Fields { get; init; } = [];
}

public sealed class ManufacturingProcessStepUpsertRequest
{
    public string? StepKey { get; init; }
    public string? Label { get; init; }
    public int? SortOrder { get; init; }
    public bool RequirePhoto { get; init; }
    public bool RequireComment { get; init; }
    public bool IsActive { get; init; } = true;
}

public sealed class ManufacturingCustomFieldUpsertRequest
{
    public string? FieldKey { get; init; }
    public string? Label { get; init; }
    public string? FieldType { get; init; }
    public int? SortOrder { get; init; }
    public bool IsRequired { get; init; }
    public bool IsActive { get; init; } = true;
    public IReadOnlyList<string>? Options { get; init; }
}

public sealed class ManufacturingSettingsUpdateRequest
{
    public IReadOnlyList<ManufacturingProcessStepUpsertRequest>? Steps { get; init; }
    public IReadOnlyList<ManufacturingCustomFieldUpsertRequest>? Fields { get; init; }
}

public sealed class ManufacturingNoteParseRequest
{
    public string? NoteText { get; init; }
}

public sealed class ManufacturingNoteParseResponse
{
    public string? ManufacturingCode { get; init; }
    public string? PieceName { get; init; }
    public string? PieceType { get; init; }
    public string Status { get; init; } = ManufacturingStatuses.Approved;
    public string? DesignerName { get; init; }
    public string? CraftsmanName { get; init; }
    public string? UsageNotes { get; init; }
    public decimal? TotalCost { get; init; }
    public decimal? SellingPrice { get; init; }
    public IReadOnlyDictionary<string, string?> CustomFields { get; init; } = new Dictionary<string, string?>();
    public IReadOnlyList<ManufacturingGemstoneUpsertRequest> Gemstones { get; init; } = [];
}

public sealed class AnalyticsCurrentMonthResponse
{
    public decimal Revenue { get; init; }
    public int Transactions { get; init; }
    public DateTime StartDateUtc { get; init; }
}

public sealed class AnalyticsTotalsResponse
{
    public decimal Revenue { get; init; }
    public int Orders { get; init; }
    public decimal AvgOrderValue { get; init; }
    public int Customers { get; init; }
    public int CustomersWithPurchases { get; init; }
}

public sealed class AnalyticsMonthlyRevenuePoint
{
    public string Month { get; init; } = string.Empty;
    public decimal Revenue { get; init; }
    public int Customers { get; init; }
    public int Orders { get; init; }
}

public sealed class AnalyticsTopCustomerPoint
{
    public Guid CustomerId { get; init; }
    public string CustomerName { get; init; } = string.Empty;
    public decimal TotalSpent { get; init; }
    public int Purchases { get; init; }
    public DateTime LastPurchaseUtc { get; init; }
}

public sealed class AnalyticsOverviewResponse
{
    public AnalyticsCurrentMonthResponse CurrentMonth { get; init; } = new();
    public AnalyticsTotalsResponse Totals { get; init; } = new();
    public IReadOnlyList<AnalyticsMonthlyRevenuePoint> MonthlyRevenue { get; init; } = [];
    public IReadOnlyList<AnalyticsTopCustomerPoint> TopCustomers { get; init; } = [];
}
