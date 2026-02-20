using System.Net;
using Microsoft.Azure.Functions.Worker;
using Microsoft.Azure.Functions.Worker.Http;
using Microsoft.Azure.Functions.Worker.Middleware;
using Microsoft.Extensions.Configuration;

namespace backend.Middleware;

public sealed class CorsMiddleware : IFunctionsWorkerMiddleware
{
    private readonly HashSet<string> _allowedOrigins;

    public CorsMiddleware(IConfiguration configuration)
    {
        var configured = configuration["Cors:AllowedOrigins"];
        _allowedOrigins = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
        if (!string.IsNullOrWhiteSpace(configured))
        {
            foreach (var origin in configured.Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries))
            {
                _allowedOrigins.Add(origin);
            }
        }
    }

    public async Task Invoke(FunctionContext context, FunctionExecutionDelegate next)
    {
        var request = await context.GetHttpRequestDataAsync();
        if (request is null)
        {
            await next(context);
            return;
        }

        var origin = request.Headers.TryGetValues("Origin", out var values)
            ? values.FirstOrDefault()
            : null;

        if (string.Equals(request.Method, "OPTIONS", StringComparison.OrdinalIgnoreCase))
        {
            var response = request.CreateResponse(HttpStatusCode.NoContent);
            AddCorsHeaders(response, origin);
            context.GetInvocationResult().Value = response;
            return;
        }

        await next(context);

        if (context.GetInvocationResult().Value is HttpResponseData responseData)
        {
            AddCorsHeaders(responseData, origin);
        }
    }

    private void AddCorsHeaders(HttpResponseData response, string? origin)
    {
        var allowOrigin = GetAllowedOrigin(origin);
        if (!string.IsNullOrWhiteSpace(allowOrigin))
        {
            response.Headers.Add("Access-Control-Allow-Origin", allowOrigin);
            response.Headers.Add("Vary", "Origin");
        }

        response.Headers.Add("Access-Control-Allow-Methods", "GET,POST,PUT,PATCH,DELETE,OPTIONS");
        response.Headers.Add("Access-Control-Allow-Headers", "Authorization,Content-Type");
        response.Headers.Add("Access-Control-Max-Age", "86400");
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
