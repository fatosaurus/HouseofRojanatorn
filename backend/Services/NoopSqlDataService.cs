using backend.Models;

namespace backend.Services;

public sealed class NoopSqlDataService : ISqlDataService
{
    public Task<SqlHealthResponse> PingAsync(CancellationToken cancellationToken = default)
        => Task.FromResult(new SqlHealthResponse(
            IsConfigured: false,
            IsReachable: false,
            Message: "SQL connection is not configured.",
            CheckedAtUtc: DateTime.UtcNow));
}
