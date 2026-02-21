using System.Net;
using backend.Models;
using Microsoft.Azure.Cosmos;
using Microsoft.Extensions.Configuration;

namespace backend.Services;

public interface IUserRepository
{
    Task<UserRecord?> GetByEmailAsync(string email, CancellationToken cancellationToken = default);
    Task<UserRecord?> GetByIdAsync(string id, CancellationToken cancellationToken = default);
    Task<UserRecord?> GetByInviteTokenAsync(string token, CancellationToken cancellationToken = default);
    Task CreateAsync(UserRecord user, CancellationToken cancellationToken = default);
    Task UpsertAsync(UserRecord user, CancellationToken cancellationToken = default);
    Task UpdatePasswordAsync(string userId, string newPasswordHash, CancellationToken cancellationToken = default);
    Task<bool> DeleteAsync(string userId, CancellationToken cancellationToken = default);
    Task<int> CountAsync(CancellationToken cancellationToken = default);
    Task<UserListResponse> ListAsync(int limit, string? continuationToken, CancellationToken cancellationToken = default);
}

public class CosmosUserRepository : IUserRepository
{
    private const string ContainerName = "users";
    private readonly CosmosClient _client;
    private readonly string _databaseName;
    private readonly Lazy<Task<Container>> _containerFactory;

    public CosmosUserRepository(CosmosClient client, IConfiguration configuration)
    {
        _client = client;
        _databaseName = configuration["CosmosDatabaseName"] ?? "appdb";
        _containerFactory = new Lazy<Task<Container>>(EnsureContainerAsync);
    }

    public async Task<UserRecord?> GetByEmailAsync(string email, CancellationToken cancellationToken = default)
    {
        var container = await _containerFactory.Value;
        var normalizedEmail = email.Trim().ToLowerInvariant();
        var query = new QueryDefinition("SELECT * FROM c WHERE LOWER(c.Email) = @email").WithParameter("@email", normalizedEmail);
        var iterator = container.GetItemQueryIterator<UserRecord>(query);

        while (iterator.HasMoreResults)
        {
            var response = await iterator.ReadNextAsync(cancellationToken);
            var match = response.FirstOrDefault();
            if (match != null)
            {
                NormalizeUser(match);
                return match;
            }
        }

        return null;
    }

    public async Task<UserRecord?> GetByIdAsync(string id, CancellationToken cancellationToken = default)
    {
        var container = await _containerFactory.Value;
        try
        {
            var response = await container.ReadItemAsync<UserRecord>(id, new PartitionKey(id), cancellationToken: cancellationToken);
            var user = response.Resource;
            NormalizeUser(user);
            return user;
        }
        catch (CosmosException ex) when (ex.StatusCode == HttpStatusCode.NotFound)
        {
            return null;
        }
    }

    public async Task<UserRecord?> GetByInviteTokenAsync(string token, CancellationToken cancellationToken = default)
    {
        if (string.IsNullOrWhiteSpace(token))
        {
            return null;
        }

        var container = await _containerFactory.Value;
        var normalizedToken = token.Trim();
        var query = new QueryDefinition("SELECT * FROM c WHERE c.InviteToken = @token")
            .WithParameter("@token", normalizedToken);
        var iterator = container.GetItemQueryIterator<UserRecord>(query);

        while (iterator.HasMoreResults)
        {
            var response = await iterator.ReadNextAsync(cancellationToken);
            var match = response.FirstOrDefault();
            if (match != null)
            {
                NormalizeUser(match);
                return match;
            }
        }

        return null;
    }

    public async Task CreateAsync(UserRecord user, CancellationToken cancellationToken = default)
    {
        var container = await _containerFactory.Value;
        NormalizeUser(user);
        if (user.CreatedAtUtc == default)
        {
            user.CreatedAtUtc = DateTime.UtcNow;
        }

        await container.CreateItemAsync(user, new PartitionKey(user.id), cancellationToken: cancellationToken);
    }

    public async Task UpsertAsync(UserRecord user, CancellationToken cancellationToken = default)
    {
        var container = await _containerFactory.Value;
        NormalizeUser(user);
        if (user.CreatedAtUtc == default)
        {
            user.CreatedAtUtc = DateTime.UtcNow;
        }

        await container.UpsertItemAsync(user, new PartitionKey(user.id), cancellationToken: cancellationToken);
    }

    public async Task UpdatePasswordAsync(string userId, string newPasswordHash, CancellationToken cancellationToken = default)
    {
        var container = await _containerFactory.Value;
        var user = await GetByIdAsync(userId, cancellationToken);
        if (user == null)
        {
            throw new InvalidOperationException("User not found.");
        }

        user.PasswordHash = newPasswordHash;
        user.Role = UserRoles.Normalize(user.Role);
        user.InviteToken = null;
        user.InviteExpiresAtUtc = null;
        user.ActivatedAtUtc ??= DateTime.UtcNow;
        await container.UpsertItemAsync(user, new PartitionKey(user.id), cancellationToken: cancellationToken);
    }

    public async Task<bool> DeleteAsync(string userId, CancellationToken cancellationToken = default)
    {
        var container = await _containerFactory.Value;
        try
        {
            await container.DeleteItemAsync<UserRecord>(userId, new PartitionKey(userId), cancellationToken: cancellationToken);
            return true;
        }
        catch (CosmosException ex) when (ex.StatusCode == HttpStatusCode.NotFound)
        {
            return false;
        }
    }

    public async Task<int> CountAsync(CancellationToken cancellationToken = default)
    {
        var container = await _containerFactory.Value;
        var query = new QueryDefinition("SELECT VALUE COUNT(1) FROM c");
        var iterator = container.GetItemQueryIterator<int>(query);
        if (!iterator.HasMoreResults)
        {
            return 0;
        }

        var page = await iterator.ReadNextAsync(cancellationToken);
        return page.FirstOrDefault();
    }

    public async Task<UserListResponse> ListAsync(int limit, string? continuationToken, CancellationToken cancellationToken = default)
    {
        var container = await _containerFactory.Value;
        var query = new QueryDefinition("SELECT * FROM c");
        var options = new QueryRequestOptions
        {
            MaxItemCount = Math.Clamp(limit, 1, 200)
        };

        var iterator = container.GetItemQueryIterator<UserRecord>(query, continuationToken, options);
        var page = await iterator.ReadNextAsync(cancellationToken);

        var items = page
            .Select(item =>
            {
                NormalizeUser(item);
                var now = DateTime.UtcNow;
                var isInvited = string.IsNullOrWhiteSpace(item.PasswordHash);
                var inviteNotExpired = item.InviteExpiresAtUtc is null || item.InviteExpiresAtUtc > now;
                var status = isInvited && inviteNotExpired ? "invited" : "active";

                return new UserSummary
                {
                    id = item.id,
                    Email = item.Email,
                    Role = item.Role,
                    Status = status,
                    CreatedAtUtc = item.CreatedAtUtc,
                    ActivatedAtUtc = item.ActivatedAtUtc,
                    LastLoginAtUtc = item.LastLoginAtUtc,
                    InviteExpiresAtUtc = item.InviteExpiresAtUtc,
                };
            })
            .OrderBy(item => item.Email, StringComparer.OrdinalIgnoreCase)
            .ToList();

        return new UserListResponse
        {
            Items = items,
            ContinuationToken = page.ContinuationToken
        };
    }

    private async Task<Container> EnsureContainerAsync()
    {
        var database = await _client.CreateDatabaseIfNotExistsAsync(_databaseName);
        var containerResponse = await database.Database.CreateContainerIfNotExistsAsync(new ContainerProperties
        {
            Id = ContainerName,
            PartitionKeyPath = "/id"
        });

        return containerResponse.Container;
    }

    private static void NormalizeUser(UserRecord user)
    {
        user.Email = user.Email.Trim().ToLowerInvariant();
        user.Role = UserRoles.Normalize(user.Role);
        user.InviteToken = string.IsNullOrWhiteSpace(user.InviteToken) ? null : user.InviteToken.Trim();
    }
}
