using System.Net;
using backend.Models;
using Microsoft.Azure.Cosmos;
using Microsoft.Extensions.Configuration;

namespace backend.Services;

public interface IUserRepository
{
    Task<UserRecord?> GetByEmailAsync(string email, CancellationToken cancellationToken = default);
    Task<UserRecord?> GetByIdAsync(string id, CancellationToken cancellationToken = default);
    Task CreateAsync(UserRecord user, CancellationToken cancellationToken = default);
    Task UpdatePasswordAsync(string userId, string newPasswordHash, CancellationToken cancellationToken = default);
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

    public async Task CreateAsync(UserRecord user, CancellationToken cancellationToken = default)
    {
        var container = await _containerFactory.Value;
        user.Email = user.Email.Trim().ToLowerInvariant();
        user.Role = UserRoles.Normalize(user.Role);
        await container.CreateItemAsync(user, new PartitionKey(user.id), cancellationToken: cancellationToken);
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
        await container.UpsertItemAsync(user, new PartitionKey(user.id), cancellationToken: cancellationToken);
    }

    public async Task<UserListResponse> ListAsync(int limit, string? continuationToken, CancellationToken cancellationToken = default)
    {
        var container = await _containerFactory.Value;
        var query = new QueryDefinition("SELECT c.id, c.Email, c.Role FROM c");
        var options = new QueryRequestOptions
        {
            MaxItemCount = Math.Clamp(limit, 1, 200)
        };

        var iterator = container.GetItemQueryIterator<UserSummary>(query, continuationToken, options);
        var page = await iterator.ReadNextAsync(cancellationToken);

        return new UserListResponse
        {
            Items = page
                .Select(item =>
                {
                    item.Role = UserRoles.Normalize(item.Role);
                    return item;
                })
                .ToList(),
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
    }
}
