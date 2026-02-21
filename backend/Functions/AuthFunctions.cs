using System.IdentityModel.Tokens.Jwt;
using System.Net;
using System.Security.Cryptography;
using System.Security.Claims;
using System.Text.Json;
using backend.Models;
using backend.Services;
using Microsoft.AspNetCore.Identity;
using Microsoft.Azure.Functions.Worker;
using Microsoft.Azure.Functions.Worker.Http;

namespace backend.Functions;

public class AuthFunctions
{
    private static readonly JsonSerializerOptions JsonOptions = new()
    {
        PropertyNameCaseInsensitive = true
    };

    private readonly IUserRepository _repository;
    private readonly PasswordHasher<UserRecord> _passwordHasher;
    private readonly IJwtService _jwtService;

    public AuthFunctions(IUserRepository repository, PasswordHasher<UserRecord> passwordHasher, IJwtService jwtService)
    {
        _repository = repository;
        _passwordHasher = passwordHasher;
        _jwtService = jwtService;
    }

    [Function("CreateUser")]
    public async Task<HttpResponseData> CreateUser(
        [HttpTrigger(AuthorizationLevel.Anonymous, "post", Route = "users")] HttpRequestData req)
    {
        var totalUsers = await _repository.CountAsync(req.FunctionContext.CancellationToken);
        if (totalUsers > 0)
        {
            return await ForbiddenAsync(req, "Direct user creation is disabled. Use admin invite flow.");
        }

        var createRequest = await JsonSerializer.DeserializeAsync<CreateUserRequest>(req.Body, JsonOptions);

        if (createRequest is null || string.IsNullOrWhiteSpace(createRequest.Email) || string.IsNullOrWhiteSpace(createRequest.Password))
        {
            var bad = req.CreateResponse(HttpStatusCode.BadRequest);
            await bad.WriteStringAsync("Email and password are required.");
            return bad;
        }

        var normalizedEmail = createRequest.Email.Trim().ToLowerInvariant();
        var existing = await _repository.GetByEmailAsync(normalizedEmail);
        if (existing != null)
        {
            var conflict = req.CreateResponse(HttpStatusCode.Conflict);
            await conflict.WriteStringAsync("User already exists.");
            return conflict;
        }

        var newUser = new UserRecord
        {
            Email = normalizedEmail,
            Role = UserRoles.Normalize(createRequest.Role),
            CreatedAtUtc = DateTime.UtcNow,
            ActivatedAtUtc = DateTime.UtcNow
        };

        newUser.PasswordHash = _passwordHasher.HashPassword(newUser, createRequest.Password);

        await _repository.CreateAsync(newUser);
        var auth = _jwtService.GenerateToken(newUser);

        var response = req.CreateResponse(HttpStatusCode.Created);
        await response.WriteAsJsonAsync(auth);
        return response;
    }

    [Function("Login")]
    public async Task<HttpResponseData> Login(
        [HttpTrigger(AuthorizationLevel.Anonymous, "post", Route = "login")] HttpRequestData req)
    {
        var loginRequest = await JsonSerializer.DeserializeAsync<LoginRequest>(req.Body, JsonOptions);

        if (loginRequest is null)
        {
            var bad = req.CreateResponse(HttpStatusCode.BadRequest);
            await bad.WriteStringAsync("Invalid request payload.");
            return bad;
        }

        var user = await _repository.GetByEmailAsync(loginRequest.Email.Trim().ToLowerInvariant());
        if (user is null)
        {
            var unauthorized = req.CreateResponse(HttpStatusCode.Unauthorized);
            await unauthorized.WriteStringAsync("Invalid credentials.");
            return unauthorized;
        }

        if (string.IsNullOrWhiteSpace(user.PasswordHash))
        {
            var unauthorized = req.CreateResponse(HttpStatusCode.Unauthorized);
            await unauthorized.WriteStringAsync("Invite has not been accepted yet.");
            return unauthorized;
        }

        var verification = _passwordHasher.VerifyHashedPassword(user, user.PasswordHash, loginRequest.Password);
        if (verification == PasswordVerificationResult.Failed)
        {
            var unauthorized = req.CreateResponse(HttpStatusCode.Unauthorized);
            await unauthorized.WriteStringAsync("Invalid credentials.");
            return unauthorized;
        }

        user.LastLoginAtUtc = DateTime.UtcNow;
        await _repository.UpsertAsync(user);

        var auth = _jwtService.GenerateToken(user);
        var response = req.CreateResponse(HttpStatusCode.OK);
        await response.WriteAsJsonAsync(auth);
        return response;
    }

    [Function("GetUsers")]
    public async Task<HttpResponseData> GetUsers(
        [HttpTrigger(AuthorizationLevel.Anonymous, "get", Route = "users")] HttpRequestData req,
        FunctionContext executionContext)
    {
        var principal = GetPrincipal(executionContext);
        if (!IsAdmin(principal))
        {
            return await ForbiddenAsync(req, "Admin role required.");
        }

        var query = System.Web.HttpUtility.ParseQueryString(req.Url.Query);
        var limit = ParseInt(query["limit"], 100);
        var continuationToken = query["continuationToken"];

        var users = await _repository.ListAsync(limit, continuationToken, req.FunctionContext.CancellationToken);
        var response = req.CreateResponse(HttpStatusCode.OK);
        await response.WriteAsJsonAsync(users);
        return response;
    }

    [Function("DeleteUser")]
    public async Task<HttpResponseData> DeleteUser(
        [HttpTrigger(AuthorizationLevel.Anonymous, "delete", Route = "users/{id}")] HttpRequestData req,
        FunctionContext executionContext,
        string id)
    {
        var principal = GetPrincipal(executionContext);
        if (!IsAdmin(principal))
        {
            return await ForbiddenAsync(req, "Admin role required.");
        }

        var currentUserId = principal?.FindFirstValue(ClaimTypes.NameIdentifier) ?? principal?.FindFirstValue(JwtRegisteredClaimNames.Sub);
        if (!string.IsNullOrWhiteSpace(currentUserId) && string.Equals(currentUserId, id, StringComparison.Ordinal))
        {
            return await BadRequestAsync(req, "You cannot delete your own account.");
        }

        var user = await _repository.GetByIdAsync(id, req.FunctionContext.CancellationToken);
        if (user is null)
        {
            return await NotFoundAsync(req, "User not found.");
        }

        if (string.Equals(UserRoles.Normalize(user.Role), UserRoles.Admin, StringComparison.Ordinal))
        {
            var listed = await _repository.ListAsync(200, null, req.FunctionContext.CancellationToken);
            var adminCount = listed.Items.Count(item => string.Equals(item.Role, UserRoles.Admin, StringComparison.Ordinal));
            if (adminCount <= 1)
            {
                return await BadRequestAsync(req, "At least one admin account is required.");
            }
        }

        var deleted = await _repository.DeleteAsync(id, req.FunctionContext.CancellationToken);
        if (!deleted)
        {
            return await NotFoundAsync(req, "User not found.");
        }

        var response = req.CreateResponse(HttpStatusCode.OK);
        await response.WriteAsJsonAsync(new { success = true });
        return response;
    }

    [Function("InviteUser")]
    public async Task<HttpResponseData> InviteUser(
        [HttpTrigger(AuthorizationLevel.Anonymous, "post", Route = "users/invite")] HttpRequestData req,
        FunctionContext executionContext)
    {
        var principal = GetPrincipal(executionContext);
        if (!IsAdmin(principal))
        {
            return await ForbiddenAsync(req, "Admin role required.");
        }

        var inviteRequest = await JsonSerializer.DeserializeAsync<InviteUserRequest>(req.Body, JsonOptions);
        if (inviteRequest is null || string.IsNullOrWhiteSpace(inviteRequest.Email))
        {
            return await BadRequestAsync(req, "Email is required.");
        }

        var normalizedEmail = inviteRequest.Email.Trim().ToLowerInvariant();
        var role = UserRoles.Normalize(inviteRequest.Role);
        var expiresInDays = Math.Clamp(inviteRequest.ExpiresInDays ?? 7, 1, 30);
        var expiresAtUtc = DateTime.UtcNow.AddDays(expiresInDays);
        var token = GenerateInviteToken();

        var existing = await _repository.GetByEmailAsync(normalizedEmail, req.FunctionContext.CancellationToken);
        if (existing is not null && !string.IsNullOrWhiteSpace(existing.PasswordHash))
        {
            return await ConflictAsync(req, "Active user already exists.");
        }

        if (existing is null)
        {
            var invited = new UserRecord
            {
                Email = normalizedEmail,
                Role = role,
                PasswordHash = string.Empty,
                InviteToken = token,
                InviteExpiresAtUtc = expiresAtUtc,
                CreatedAtUtc = DateTime.UtcNow
            };

            await _repository.CreateAsync(invited, req.FunctionContext.CancellationToken);
        }
        else
        {
            existing.Role = role;
            existing.InviteToken = token;
            existing.InviteExpiresAtUtc = expiresAtUtc;
            existing.PasswordHash = string.Empty;
            existing.ActivatedAtUtc = null;
            await _repository.UpsertAsync(existing, req.FunctionContext.CancellationToken);
        }

        var response = req.CreateResponse(HttpStatusCode.Created);
        await response.WriteAsJsonAsync(new InviteResponse(normalizedEmail, role, token, expiresAtUtc));
        return response;
    }

    [Function("GetInviteDetails")]
    public async Task<HttpResponseData> GetInviteDetails(
        [HttpTrigger(AuthorizationLevel.Anonymous, "get", Route = "users/invite/{token}")] HttpRequestData req,
        string token)
    {
        var user = await _repository.GetByInviteTokenAsync(token, req.FunctionContext.CancellationToken);
        if (user is null || user.InviteExpiresAtUtc is null || user.InviteExpiresAtUtc <= DateTime.UtcNow)
        {
            return await NotFoundAsync(req, "Invite is invalid or has expired.");
        }

        var response = req.CreateResponse(HttpStatusCode.OK);
        await response.WriteAsJsonAsync(new InviteDetailsResponse(user.Email, UserRoles.Normalize(user.Role), user.InviteExpiresAtUtc.Value));
        return response;
    }

    [Function("AcceptInvite")]
    public async Task<HttpResponseData> AcceptInvite(
        [HttpTrigger(AuthorizationLevel.Anonymous, "post", Route = "users/invite/accept")] HttpRequestData req)
    {
        var acceptRequest = await JsonSerializer.DeserializeAsync<AcceptInviteRequest>(req.Body, JsonOptions);
        if (acceptRequest is null || string.IsNullOrWhiteSpace(acceptRequest.Token) || string.IsNullOrWhiteSpace(acceptRequest.Password))
        {
            return await BadRequestAsync(req, "Token and password are required.");
        }

        var user = await _repository.GetByInviteTokenAsync(acceptRequest.Token.Trim(), req.FunctionContext.CancellationToken);
        if (user is null)
        {
            return await NotFoundAsync(req, "Invite not found.");
        }

        if (user.InviteExpiresAtUtc is null || user.InviteExpiresAtUtc <= DateTime.UtcNow)
        {
            return await BadRequestAsync(req, "Invite has expired.");
        }

        user.PasswordHash = _passwordHasher.HashPassword(user, acceptRequest.Password);
        user.InviteToken = null;
        user.InviteExpiresAtUtc = null;
        user.ActivatedAtUtc = DateTime.UtcNow;
        user.LastLoginAtUtc = DateTime.UtcNow;
        await _repository.UpsertAsync(user, req.FunctionContext.CancellationToken);

        var auth = _jwtService.GenerateToken(user);
        var response = req.CreateResponse(HttpStatusCode.OK);
        await response.WriteAsJsonAsync(auth);
        return response;
    }

    [Function("MeProfile")]
    public async Task<HttpResponseData> MeProfile(
        [HttpTrigger(AuthorizationLevel.Anonymous, "get", Route = "me/profile")] HttpRequestData req,
        FunctionContext executionContext)
    {
        var principal = executionContext.Items.TryGetValue("UserPrincipal", out var value) ? value as ClaimsPrincipal : null;
        var userId = principal?.FindFirstValue(ClaimTypes.NameIdentifier) ?? principal?.FindFirstValue(JwtRegisteredClaimNames.Sub);
        var email = principal?.FindFirstValue(ClaimTypes.Email) ?? principal?.FindFirstValue(JwtRegisteredClaimNames.Email) ?? string.Empty;
        var role = UserRoles.Normalize(principal?.FindFirstValue(ClaimTypes.Role));

        var response = req.CreateResponse(HttpStatusCode.OK);
        await response.WriteAsJsonAsync(new MeProfileResponse(userId ?? string.Empty, email, role));
        return response;
    }

    [Function("GetLookups")]
    public async Task<HttpResponseData> GetLookups(
        [HttpTrigger(AuthorizationLevel.Anonymous, "get", Route = "lookups")] HttpRequestData req)
    {
        var response = req.CreateResponse(HttpStatusCode.OK);
        await response.WriteAsJsonAsync(new LookupsResponse(new[] { UserRoles.Member, UserRoles.Admin }));
        return response;
    }

    private static ClaimsPrincipal? GetPrincipal(FunctionContext context)
    {
        return context.Items.TryGetValue("UserPrincipal", out var value) ? value as ClaimsPrincipal : null;
    }

    private static bool IsAdmin(ClaimsPrincipal? principal)
    {
        var role = principal?.FindFirstValue(ClaimTypes.Role);
        return string.Equals(UserRoles.Normalize(role), UserRoles.Admin, StringComparison.Ordinal);
    }

    private static string GenerateInviteToken()
    {
        var bytes = RandomNumberGenerator.GetBytes(24);
        return Convert.ToBase64String(bytes)
            .TrimEnd('=')
            .Replace('+', '-')
            .Replace('/', '_');
    }

    private static int ParseInt(string? value, int fallback)
    {
        if (int.TryParse(value, out var parsed))
        {
            return parsed;
        }

        return fallback;
    }

    private static async Task<HttpResponseData> BadRequestAsync(HttpRequestData req, string message)
    {
        var response = req.CreateResponse(HttpStatusCode.BadRequest);
        await response.WriteAsJsonAsync(new { error = message });
        return response;
    }

    private static async Task<HttpResponseData> ConflictAsync(HttpRequestData req, string message)
    {
        var response = req.CreateResponse(HttpStatusCode.Conflict);
        await response.WriteAsJsonAsync(new { error = message });
        return response;
    }

    private static async Task<HttpResponseData> ForbiddenAsync(HttpRequestData req, string message)
    {
        var response = req.CreateResponse(HttpStatusCode.Forbidden);
        await response.WriteAsJsonAsync(new { error = message });
        return response;
    }

    private static async Task<HttpResponseData> NotFoundAsync(HttpRequestData req, string message)
    {
        var response = req.CreateResponse(HttpStatusCode.NotFound);
        await response.WriteAsJsonAsync(new { error = message });
        return response;
    }
}
