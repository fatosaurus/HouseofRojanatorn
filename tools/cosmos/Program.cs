using Microsoft.AspNetCore.Identity;
using Microsoft.Azure.Cosmos;

static void ShowUsage()
{
    Console.WriteLine("Usage:");
    Console.WriteLine("  dotnet run --project tools/cosmos -- upsert --database <name> --container <name> [--partition-key </path>] [--throughput <ru>]");
    Console.WriteLine("  dotnet run --project tools/cosmos -- ensure-defaults --database <name>");
    Console.WriteLine("  dotnet run --project tools/cosmos -- seed-user --database <name> --email <email> --password <password>");
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
        if (!options.TryGetValue("database", out var database) || string.IsNullOrWhiteSpace(database))
        {
            Console.Error.WriteLine("--database is required");
            return;
        }

        if (!options.TryGetValue("container", out var container) || string.IsNullOrWhiteSpace(container))
        {
            Console.Error.WriteLine("--container is required");
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
        if (!options.TryGetValue("database", out var database) || string.IsNullOrWhiteSpace(database))
        {
            Console.Error.WriteLine("--database is required");
            return;
        }

        await EnsureContainerAsync(client, database, "users", "/id", null);
        Console.WriteLine("Default containers ensured: users");
        return;
    }

    if (command == "seed-user")
    {
        if (!options.TryGetValue("database", out var database) || string.IsNullOrWhiteSpace(database))
        {
            Console.Error.WriteLine("--database is required");
            return;
        }

        if (!options.TryGetValue("email", out var email) || string.IsNullOrWhiteSpace(email))
        {
            Console.Error.WriteLine("--email is required");
            return;
        }

        if (!options.TryGetValue("password", out var password) || string.IsNullOrWhiteSpace(password))
        {
            Console.Error.WriteLine("--password is required");
            return;
        }

        var container = await EnsureContainerAsync(client, database, "users", "/id", null);
        var user = await GetUserByEmailAsync(container, email);
        if (user == null)
        {
            user = new UserRecord { Email = email };
        }

        var hasher = new PasswordHasher<UserRecord>();
        user.PasswordHash = hasher.HashPassword(user, password);

        await container.UpsertItemAsync(user, new PartitionKey(user.id));
        Console.WriteLine($"Seeded user '{email}' with id '{user.id}'.");
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
    var query = new QueryDefinition("SELECT * FROM c WHERE c.Email = @email")
        .WithParameter("@email", email.Trim().ToLowerInvariant());
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
}
