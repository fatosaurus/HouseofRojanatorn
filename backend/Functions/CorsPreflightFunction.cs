using System.Net;
using Microsoft.Azure.Functions.Worker;
using Microsoft.Azure.Functions.Worker.Http;
using Microsoft.Extensions.Configuration;

namespace backend.Functions;

public sealed class CorsPreflightFunction
{
    private readonly HashSet<string> _allowedOrigins;

    public CorsPreflightFunction(IConfiguration configuration)
    {
        _allowedOrigins = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
        var configured = configuration["Cors:AllowedOrigins"];
        if (!string.IsNullOrWhiteSpace(configured))
        {
            foreach (var origin in configured.Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries))
            {
                _allowedOrigins.Add(origin);
            }
        }
    }

    [Function("CorsPreflight")]
    public HttpResponseData Run(
        [HttpTrigger(AuthorizationLevel.Anonymous, "options", Route = "{*path}")] HttpRequestData req)
    {
        var response = req.CreateResponse(HttpStatusCode.NoContent);
        var origin = req.Headers.TryGetValues("Origin", out var values)
            ? values.FirstOrDefault()
            : null;

        var allowOrigin = GetAllowedOrigin(origin);
        if (!string.IsNullOrWhiteSpace(allowOrigin))
        {
            response.Headers.Add("Access-Control-Allow-Origin", allowOrigin);
            response.Headers.Add("Vary", "Origin");
        }

        response.Headers.Add("Access-Control-Allow-Methods", "GET,POST,PUT,PATCH,DELETE,OPTIONS");
        response.Headers.Add("Access-Control-Allow-Headers", "Authorization,Content-Type");
        response.Headers.Add("Access-Control-Max-Age", "86400");
        return response;
    }

    private string? GetAllowedOrigin(string? origin)
    {
        if (string.IsNullOrWhiteSpace(origin))
        {
            return _allowedOrigins.Count == 1 ? _allowedOrigins.First() : "*";
        }

        if (_allowedOrigins.Count == 0)
        {
            return origin;
        }

        return _allowedOrigins.Contains(origin) ? origin : null;
    }
}
