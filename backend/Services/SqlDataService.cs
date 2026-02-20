using backend.Models;
using Microsoft.Data.SqlClient;
using Microsoft.Extensions.Configuration;

namespace backend.Services;

public interface ISqlDataService
{
    Task<SqlHealthResponse> PingAsync(CancellationToken cancellationToken = default);
}

public sealed class SqlDataService : ISqlDataService
{
    private readonly string _connectionString;

    public SqlDataService(IConfiguration configuration)
    {
        _connectionString = configuration["SqlConnection"]
            ?? throw new InvalidOperationException("Missing SqlConnection configuration value.");
    }

    public async Task<SqlHealthResponse> PingAsync(CancellationToken cancellationToken = default)
    {
        await using var conn = new SqlConnection(_connectionString);
        await conn.OpenAsync(cancellationToken);
        await using var cmd = new SqlCommand("SELECT 1", conn);
        await cmd.ExecuteScalarAsync(cancellationToken);

        return new SqlHealthResponse(
            IsConfigured: true,
            IsReachable: true,
            Message: "SQL connection successful.",
            CheckedAtUtc: DateTime.UtcNow);
    }
}
