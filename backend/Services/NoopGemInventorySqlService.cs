using backend.Models;

namespace backend.Services;

public sealed class NoopGemInventorySqlService : IGemInventorySqlService
{
    public Task<InventorySummaryResponse> GetSummaryAsync(CancellationToken cancellationToken = default)
        => Task.FromResult(new InventorySummaryResponse());

    public Task<PagedResponse<InventoryItemResponse>> GetInventoryItemsAsync(
        string? search,
        string? type,
        string? status,
        int limit,
        int offset,
        CancellationToken cancellationToken = default)
        => Task.FromResult(new PagedResponse<InventoryItemResponse>([], 0, Math.Clamp(limit, 1, 200), Math.Max(offset, 0)));

    public Task<InventoryItemDetailResponse?> GetInventoryItemByIdAsync(int id, CancellationToken cancellationToken = default)
        => Task.FromResult<InventoryItemDetailResponse?>(null);

    public Task<PagedResponse<UsageBatchResponse>> GetUsageBatchesAsync(
        string? search,
        string? category,
        int limit,
        int offset,
        CancellationToken cancellationToken = default)
        => Task.FromResult(new PagedResponse<UsageBatchResponse>([], 0, Math.Clamp(limit, 1, 200), Math.Max(offset, 0)));

    public Task<UsageBatchDetailResponse?> GetUsageBatchDetailAsync(int batchId, CancellationToken cancellationToken = default)
        => Task.FromResult<UsageBatchDetailResponse?>(null);
}
