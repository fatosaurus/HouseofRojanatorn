using Microsoft.AspNetCore.Identity;
using Microsoft.Azure.Cosmos;

static void ShowUsage()
{
    Console.WriteLine("Usage:");
    Console.WriteLine("  dotnet run --project tools/cosmos -- upsert --database <name> --container <name> [--partition-key </path>] [--throughput <ru>]");
    Console.WriteLine("  dotnet run --project tools/cosmos -- ensure-defaults --database <name>");
    Console.WriteLine("  dotnet run --project tools/cosmos -- seed-user --database <name> --email <email> --password <password> [--role <admin|member>]");
    Console.WriteLine("  dotnet run --project tools/cosmos -- list-users --database <name>");
    Console.WriteLine("  dotnet run --project tools/cosmos -- prune-users --database <name> --keep-emails <comma-separated-emails>");
}

if (args.Length == 0)
{
    ShowUsage();
    return;
}

var command = args[0].ToLowerInvariant();
var options = ParseOptions(args.Skip(1).ToArray());

try
{
    var connectionString = Environment.GetEnvironmentVariable("COSMOS_CONNECTION_STRING");
    if (string.IsNullOrWhiteSpace(connectionString))
    {
        Console.Error.WriteLine("COSMOS_CONNECTION_STRING environment variable is not set.");
        Environment.ExitCode = 1;
        return;
    }

    using var client = new CosmosClient(connectionString);

    if (command == "upsert")
    {
        if (!TryGetRequiredOption(options, "database", out var database) || !TryGetRequiredOption(options, "container", out var container))
        {
            return;
        }

        options.TryGetValue("partition-key", out var partitionKey);
        if (string.IsNullOrWhiteSpace(partitionKey))
        {
            partitionKey = "/id";
        }

        int? throughput = null;
        if (options.TryGetValue("throughput", out var throughputValue) && int.TryParse(throughputValue, out var throughputInt))
        {
            throughput = throughputInt;
        }

        await EnsureContainerAsync(client, database, container, partitionKey, throughput);
        Console.WriteLine("Cosmos resources ensured.");
        return;
    }

    if (command == "ensure-defaults")
    {
        if (!TryGetRequiredOption(options, "database", out var database))
        {
            return;
        }

        await EnsureContainerAsync(client, database, "users", "/id", null);
        Console.WriteLine("Default containers ensured: users");
        return;
    }

    if (command == "seed-user")
    {
        if (!TryGetRequiredOption(options, "database", out var database) ||
            !TryGetRequiredOption(options, "email", out var email) ||
            !TryGetRequiredOption(options, "password", out var password))
        {
            return;
        }

        var container = await EnsureContainerAsync(client, database, "users", "/id", null);
        var user = await GetUserByEmailAsync(container, email);
        if (user == null)
        {
            user = new UserRecord
            {
                Email = NormalizeEmail(email),
                Role = NormalizeRole(options.TryGetValue("role", out var roleValue) ? roleValue : null),
                CreatedAtUtc = DateTime.UtcNow
            };
        }
        else
        {
            user.Email = NormalizeEmail(email);
            user.Role = NormalizeRole(options.TryGetValue("role", out var roleValue) ? roleValue : user.Role);
        }

        var hasher = new PasswordHasher<UserRecord>();
        user.PasswordHash = hasher.HashPassword(user, password);
        user.InviteToken = null;
        user.InviteExpiresAtUtc = null;
        user.ActivatedAtUtc ??= DateTime.UtcNow;

        await container.UpsertItemAsync(user, new PartitionKey(user.id));
        Console.WriteLine($"Seeded user '{user.Email}' with id '{user.id}' and role '{user.Role}'.");
        return;
    }

    if (command == "list-users")
    {
        if (!TryGetRequiredOption(options, "database", out var database))
        {
            return;
        }

        var container = await EnsureContainerAsync(client, database, "users", "/id", null);
        var users = await GetAllUsersAsync(container);

        Console.WriteLine("id | email | role | status");
        foreach (var user in users.OrderBy(item => NormalizeEmail(item.Email), StringComparer.OrdinalIgnoreCase))
        {
            var status = string.IsNullOrWhiteSpace(user.PasswordHash) ? "invited" : "active";
            Console.WriteLine($"{user.id} | {NormalizeEmail(user.Email)} | {NormalizeRole(user.Role)} | {status}");
        }

        Console.WriteLine($"Total users: {users.Count}");
        return;
    }

    if (command == "prune-users")
    {
        if (!TryGetRequiredOption(options, "database", out var database) ||
            !TryGetRequiredOption(options, "keep-emails", out var keepEmailsArg))
        {
            return;
        }

        var keepEmails = keepEmailsArg
            .Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
            .Select(NormalizeEmail)
            .Where(email => email.Length > 0)
            .ToHashSet(StringComparer.OrdinalIgnoreCase);

        if (keepEmails.Count == 0)
        {
            Console.Error.WriteLine("At least one email is required in --keep-emails.");
            Environment.ExitCode = 1;
            return;
        }

        var container = await EnsureContainerAsync(client, database, "users", "/id", null);
        var users = await GetAllUsersAsync(container);
        var deleted = 0;
        var kept = 0;

        foreach (var user in users)
        {
            var email = NormalizeEmail(user.Email);
            if (keepEmails.Contains(email))
            {
                kept++;
                continue;
            }

            await container.DeleteItemAsync<UserRecord>(user.id, new PartitionKey(user.id));
            deleted++;
        }

        Console.WriteLine($"Prune completed. Deleted: {deleted}, kept: {kept}.");
        return;
    }

    Console.Error.WriteLine($"Unknown command '{command}'.");
    ShowUsage();
}
catch (Exception ex)
{
    Console.Error.WriteLine($"Error: {ex.Message}");
    Environment.ExitCode = 1;
}

static bool TryGetRequiredOption(IReadOnlyDictionary<string, string> options, string key, out string value)
{
    if (options.TryGetValue(key, out var rawValue) && !string.IsNullOrWhiteSpace(rawValue))
    {
        value = rawValue;
        return true;
    }

    Console.Error.WriteLine($"--{key} is required");
    value = string.Empty;
    Environment.ExitCode = 1;
    return false;
}

static async Task<Container> EnsureContainerAsync(CosmosClient client, string databaseName, string containerName, string partitionKey, int? throughput)
{
    var databaseResponse = await client.CreateDatabaseIfNotExistsAsync(databaseName);
    var database = databaseResponse.Database;

    var properties = new ContainerProperties(containerName, partitionKey);
    ContainerResponse containerResponse;
    if (throughput.HasValue)
    {
        containerResponse = await database.CreateContainerIfNotExistsAsync(properties, throughput.Value);
    }
    else
    {
        containerResponse = await database.CreateContainerIfNotExistsAsync(properties);
    }

    return containerResponse.Container;
}

static async Task<UserRecord?> GetUserByEmailAsync(Container container, string email)
{
    var normalizedEmail = NormalizeEmail(email);
    var query = new QueryDefinition("SELECT * FROM c WHERE LOWER(c.Email) = @email")
        .WithParameter("@email", normalizedEmail);
    var iterator = container.GetItemQueryIterator<UserRecord>(query);
    while (iterator.HasMoreResults)
    {
        var response = await iterator.ReadNextAsync();
        var match = response.FirstOrDefault();
        if (match != null)
        {
            return match;
        }
    }

    return null;
}

static async Task<List<UserRecord>> GetAllUsersAsync(Container container)
{
    var users = new List<UserRecord>();
    var iterator = container.GetItemQueryIterator<UserRecord>(new QueryDefinition("SELECT * FROM c"));
    while (iterator.HasMoreResults)
    {
        var page = await iterator.ReadNextAsync();
        users.AddRange(page);
    }

    return users;
}

static string NormalizeEmail(string? email)
{
    return string.IsNullOrWhiteSpace(email) ? string.Empty : email.Trim().ToLowerInvariant();
}

static string NormalizeRole(string? role)
{
    return string.Equals(role?.Trim(), "admin", StringComparison.OrdinalIgnoreCase)
        ? "admin"
        : "member";
}

static Dictionary<string, string> ParseOptions(string[] args)
{
    var options = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);
    for (var i = 0; i < args.Length; i++)
    {
        var arg = args[i];
        if (!arg.StartsWith("--", StringComparison.Ordinal))
        {
            continue;
        }

        var key = arg[2..];
        var value = i + 1 < args.Length && !args[i + 1].StartsWith("--", StringComparison.Ordinal)
            ? args[++i]
            : string.Empty;
        options[key] = value;
    }

    return options;
}

internal sealed class UserRecord
{
    public string id { get; set; } = Guid.NewGuid().ToString();
    public string Email { get; set; } = string.Empty;
    public string PasswordHash { get; set; } = string.Empty;
    public string Role { get; set; } = "member";
    public string? InviteToken { get; set; }
    public DateTime? InviteExpiresAtUtc { get; set; }
    public DateTime CreatedAtUtc { get; set; } = DateTime.UtcNow;
    public DateTime? ActivatedAtUtc { get; set; }
    public DateTime? LastLoginAtUtc { get; set; }
}
