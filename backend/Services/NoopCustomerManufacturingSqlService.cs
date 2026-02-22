using backend.Models;

namespace backend.Services;

public sealed class NoopCustomerManufacturingSqlService : ICustomerManufacturingSqlService
{
    public Task<PagedResponse<CustomerResponse>> GetCustomersAsync(string? search, int limit, int offset, CancellationToken cancellationToken = default)
        => Task.FromResult(new PagedResponse<CustomerResponse>([], 0, Math.Clamp(limit, 1, 200), Math.Max(offset, 0)));

    public Task<CustomerResponse?> GetCustomerByIdAsync(Guid customerId, CancellationToken cancellationToken = default)
        => Task.FromResult<CustomerResponse?>(null);

    public Task<CustomerResponse> CreateCustomerAsync(CustomerUpsertRequest request, CancellationToken cancellationToken = default)
        => Task.FromException<CustomerResponse>(new InvalidOperationException("SQL connection is not configured."));

    public Task<CustomerResponse?> UpdateCustomerAsync(Guid customerId, CustomerUpsertRequest request, CancellationToken cancellationToken = default)
        => Task.FromResult<CustomerResponse?>(null);

    public Task<bool> DeleteCustomerAsync(Guid customerId, CancellationToken cancellationToken = default)
        => Task.FromResult(false);

    public Task<bool> AppendCustomerNoteAsync(Guid customerId, string note, CancellationToken cancellationToken = default)
        => Task.FromResult(false);

    public Task<IReadOnlyList<CustomerActivityResponse>> GetCustomerActivityAsync(Guid customerId, int limit, CancellationToken cancellationToken = default)
        => Task.FromResult<IReadOnlyList<CustomerActivityResponse>>([]);

    public Task<PagedResponse<ManufacturingProjectSummaryResponse>> GetManufacturingProjectsAsync(
        string? search,
        string? status,
        Guid? customerId,
        int limit,
        int offset,
        CancellationToken cancellationToken = default)
        => Task.FromResult(new PagedResponse<ManufacturingProjectSummaryResponse>([], 0, Math.Clamp(limit, 1, 200), Math.Max(offset, 0)));

    public Task<ManufacturingProjectDetailResponse?> GetManufacturingProjectByIdAsync(int projectId, CancellationToken cancellationToken = default)
        => Task.FromResult<ManufacturingProjectDetailResponse?>(null);

    public Task<ManufacturingProjectDetailResponse> CreateManufacturingProjectAsync(
        ManufacturingProjectUpsertRequest request,
        CancellationToken cancellationToken = default)
        => Task.FromException<ManufacturingProjectDetailResponse>(new InvalidOperationException("SQL connection is not configured."));

    public Task<ManufacturingProjectDetailResponse?> UpdateManufacturingProjectAsync(
        int projectId,
        ManufacturingProjectUpsertRequest request,
        CancellationToken cancellationToken = default)
        => Task.FromResult<ManufacturingProjectDetailResponse?>(null);

    public Task<bool> DeleteManufacturingProjectAsync(int projectId, CancellationToken cancellationToken = default)
        => Task.FromResult(false);

    public Task<IReadOnlyList<ManufacturingPersonResponse>> GetManufacturingPeopleAsync(
        string? role,
        bool activeOnly,
        CancellationToken cancellationToken = default)
        => Task.FromResult<IReadOnlyList<ManufacturingPersonResponse>>([]);

    public Task<ManufacturingPersonResponse> CreateManufacturingPersonAsync(
        ManufacturingPersonUpsertRequest request,
        CancellationToken cancellationToken = default)
        => Task.FromException<ManufacturingPersonResponse>(new InvalidOperationException("SQL connection is not configured."));

    public Task<ManufacturingPersonResponse?> UpdateManufacturingPersonAsync(
        int personId,
        ManufacturingPersonUpsertRequest request,
        CancellationToken cancellationToken = default)
        => Task.FromResult<ManufacturingPersonResponse?>(null);

    public Task<bool> DeleteManufacturingPersonAsync(int personId, CancellationToken cancellationToken = default)
        => Task.FromResult(false);

    public Task<ManufacturingPersonProfileResponse?> GetManufacturingPersonProfileAsync(
        int personId,
        int limit,
        CancellationToken cancellationToken = default)
        => Task.FromResult<ManufacturingPersonProfileResponse?>(null);

    public Task<ManufacturingSettingsResponse> GetManufacturingSettingsAsync(CancellationToken cancellationToken = default)
        => Task.FromResult(new ManufacturingSettingsResponse
        {
            Steps = ManufacturingStatuses.Defaults
                .Select((step, index) => new ManufacturingProcessStepResponse
                {
                    StepKey = step,
                    Label = step.Replace('_', ' '),
                    SortOrder = index + 1,
                    IsActive = true
                })
                .ToList(),
            Fields =
            [
                new ManufacturingCustomFieldResponse
                {
                    FieldKey = "designerName",
                    Label = "Designer",
                    FieldType = "text",
                    SortOrder = 1,
                    IsActive = true,
                    IsSystem = true
                },
                new ManufacturingCustomFieldResponse
                {
                    FieldKey = "craftsmanName",
                    Label = "Craftsman",
                    FieldType = "text",
                    SortOrder = 2,
                    IsActive = true,
                    IsSystem = true
                }
            ]
        });

    public Task<ManufacturingSettingsResponse> SaveManufacturingSettingsAsync(
        ManufacturingSettingsUpdateRequest request,
        CancellationToken cancellationToken = default)
        => GetManufacturingSettingsAsync(cancellationToken);

    public Task<AnalyticsOverviewResponse> GetAnalyticsAsync(CancellationToken cancellationToken = default)
        => Task.FromResult(new AnalyticsOverviewResponse
        {
            CurrentMonth = new AnalyticsCurrentMonthResponse
            {
                StartDateUtc = new DateTime(DateTime.UtcNow.Year, DateTime.UtcNow.Month, 1, 0, 0, 0, DateTimeKind.Utc)
            }
        });
}
