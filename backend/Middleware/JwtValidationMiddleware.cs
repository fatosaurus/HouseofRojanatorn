using System.Net;
using backend.Services;
using Microsoft.Azure.Functions.Worker;
using Microsoft.Azure.Functions.Worker.Http;
using Microsoft.Azure.Functions.Worker.Middleware;

namespace backend.Middleware;

public class JwtValidationMiddleware : IFunctionsWorkerMiddleware
{
    private static readonly HashSet<string> AnonymousFunctions =
    [
        "CreateUser",
        "Login",
        "GetInviteDetails",
        "AcceptInvite",
        "CorsPreflight",
        "GetHealth"
    ];

    private readonly IJwtService _jwtService;

    public JwtValidationMiddleware(IJwtService jwtService)
    {
        _jwtService = jwtService;
    }

    public async Task Invoke(FunctionContext context, FunctionExecutionDelegate next)
    {
        if (AnonymousFunctions.Contains(context.FunctionDefinition.Name))
        {
            await next(context);
            return;
        }

        var request = await context.GetHttpRequestDataAsync();
        if (request is null)
        {
            await next(context);
            return;
        }

        if (string.Equals(request.Method, "OPTIONS", StringComparison.OrdinalIgnoreCase))
        {
            await next(context);
            return;
        }

        if (!request.Headers.TryGetValues("Authorization", out var authHeaders))
        {
            await WriteUnauthorizedAsync(context, request, "Missing Authorization header.");
            return;
        }

        var bearer = authHeaders.FirstOrDefault()?.Split(' ', 2, StringSplitOptions.RemoveEmptyEntries);
        var token = bearer?.Length == 2 && bearer[0].Equals("Bearer", StringComparison.OrdinalIgnoreCase)
            ? bearer[1]
            : null;

        if (string.IsNullOrWhiteSpace(token))
        {
            await WriteUnauthorizedAsync(context, request, "Invalid Authorization header.");
            return;
        }

        var principal = _jwtService.ValidateToken(token);
        if (principal == null)
        {
            await WriteUnauthorizedAsync(context, request, "Token validation failed.");
            return;
        }

        context.Items["UserPrincipal"] = principal;
        await next(context);
    }

    private static async Task WriteUnauthorizedAsync(FunctionContext context, HttpRequestData request, string message)
    {
        var response = request.CreateResponse(HttpStatusCode.Unauthorized);
        await response.WriteAsJsonAsync(new { error = message });
        context.GetInvocationResult().Value = response;
    }
}
