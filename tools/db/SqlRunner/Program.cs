using Microsoft.Data.SqlClient;
using System.Text;

var argsList = args.ToList();
var fileArg = GetArg(argsList, "--file");
var queryArg = GetArg(argsList, "--query");

if (string.IsNullOrWhiteSpace(fileArg) && string.IsNullOrWhiteSpace(queryArg))
{
    Console.Error.WriteLine("Usage: --file <path> or --query <sql>");
    return 1;
}

var connectionString = BuildConnectionString();
await using var conn = new SqlConnection(connectionString);
await conn.OpenAsync();

if (!string.IsNullOrWhiteSpace(fileArg))
{
    var sql = await File.ReadAllTextAsync(fileArg, Encoding.UTF8);
    foreach (var batch in SplitBatches(sql))
    {
        await using var cmd = new SqlCommand(batch, conn);
        await cmd.ExecuteNonQueryAsync();
    }
    Console.WriteLine($"Executed file: {fileArg}");
}

if (!string.IsNullOrWhiteSpace(queryArg))
{
    await using var cmd = new SqlCommand(queryArg, conn);
    await using var reader = await cmd.ExecuteReaderAsync();

    var columnCount = reader.FieldCount;
    if (columnCount > 0)
    {
        for (var i = 0; i < columnCount; i++)
        {
            if (i > 0) Console.Write(" | ");
            Console.Write(reader.GetName(i));
        }
        Console.WriteLine();
    }

    while (await reader.ReadAsync())
    {
        for (var i = 0; i < columnCount; i++)
        {
            if (i > 0) Console.Write(" | ");
            Console.Write(reader.IsDBNull(i) ? "" : reader.GetValue(i));
        }
        Console.WriteLine();
    }
}

return 0;

static string? GetArg(List<string> args, string name)
{
    var index = args.FindIndex(item => string.Equals(item, name, StringComparison.OrdinalIgnoreCase));
    if (index < 0 || index + 1 >= args.Count)
    {
        return null;
    }

    return args[index + 1];
}

static IEnumerable<string> SplitBatches(string sql)
{
    return System.Text.RegularExpressions.Regex
        .Split(sql, "^\\s*GO\\s*$", System.Text.RegularExpressions.RegexOptions.Multiline | System.Text.RegularExpressions.RegexOptions.IgnoreCase)
        .Select(chunk => chunk.Trim())
        .Where(chunk => chunk.Length > 0);
}

static string BuildConnectionString()
{
    var server = Environment.GetEnvironmentVariable("AZURE_SQL_SERVER") ?? "";
    var database = Environment.GetEnvironmentVariable("AZURE_SQL_DB") ?? "";
    var user = Environment.GetEnvironmentVariable("AZURE_SQL_USER") ?? "";
    var password = Environment.GetEnvironmentVariable("AZURE_SQL_PASSWORD") ?? "";

    if (string.IsNullOrWhiteSpace(server) || string.IsNullOrWhiteSpace(database) || string.IsNullOrWhiteSpace(user) || string.IsNullOrWhiteSpace(password))
    {
        throw new InvalidOperationException("Missing AZURE_SQL_SERVER, AZURE_SQL_DB, AZURE_SQL_USER, or AZURE_SQL_PASSWORD.");
    }

    return $"Server=tcp:{server},1433;Initial Catalog={database};Persist Security Info=False;User ID={user};Password={password};MultipleActiveResultSets=False;Encrypt=True;TrustServerCertificate=False;Connection Timeout=30;";
}
