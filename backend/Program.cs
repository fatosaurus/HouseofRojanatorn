using backend.Middleware;
using backend.Models;
using backend.Services;
using Microsoft.AspNetCore.Identity;
using Microsoft.Azure.Cosmos;
using Microsoft.Azure.Functions.Worker;
using Microsoft.Azure.Functions.Worker.Builder;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;

var builder = FunctionsApplication.CreateBuilder(args);

builder.ConfigureFunctionsWebApplication();

builder.Services.Configure<JwtOptions>(builder.Configuration.GetSection("Jwt"));

static bool IsMissingOrPlaceholder(string? value)
{
    if (string.IsNullOrWhiteSpace(value)) return true;
    var trimmed = value.Trim();
    return trimmed.StartsWith("<") && trimmed.EndsWith(">");
}

var cosmosConnection = builder.Configuration["CosmosConnection"];
if (!IsMissingOrPlaceholder(cosmosConnection))
{
    builder.Services.AddSingleton(_ =>
    {
        var options = new CosmosClientOptions();
        var connectionMode = builder.Configuration["Cosmos:ConnectionMode"];
        if (string.Equals(connectionMode, "Gateway", StringComparison.OrdinalIgnoreCase))
        {
            options.ConnectionMode = ConnectionMode.Gateway;
        }

        return new CosmosClient(cosmosConnection!, options);
    });
    builder.Services.AddSingleton<IUserRepository, CosmosUserRepository>();
}
else
{
    builder.Services.AddSingleton<IUserRepository, InMemoryUserRepository>();
}

builder.Services.AddSingleton<PasswordHasher<UserRecord>>();
builder.Services.AddSingleton<IJwtService, JwtService>();
builder.Services.AddSingleton<JwtValidationMiddleware>();
builder.Services.AddSingleton<CorsMiddleware>();

var sqlConnection = builder.Configuration["SqlConnection"];
if (!IsMissingOrPlaceholder(sqlConnection))
{
    builder.Services.AddSingleton<ISqlDataService, SqlDataService>();
    builder.Services.AddSingleton<IGemInventorySqlService, GemInventorySqlService>();
    builder.Services.AddSingleton<ICustomerManufacturingSqlService, CustomerManufacturingSqlService>();
}
else
{
    builder.Services.AddSingleton<ISqlDataService, NoopSqlDataService>();
    builder.Services.AddSingleton<IGemInventorySqlService, NoopGemInventorySqlService>();
    builder.Services.AddSingleton<ICustomerManufacturingSqlService, NoopCustomerManufacturingSqlService>();
}

builder.UseMiddleware<CorsMiddleware>();
builder.UseMiddleware<JwtValidationMiddleware>();

builder.Build().Run();
