using System.IdentityModel.Tokens.Jwt;
using System.Net;
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
        var createRequest = await JsonSerializer.DeserializeAsync<CreateUserRequest>(req.Body, new JsonSerializerOptions
        {
            PropertyNameCaseInsensitive = true
        });

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
            Role = UserRoles.Normalize(createRequest.Role)
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
        var loginRequest = await JsonSerializer.DeserializeAsync<LoginRequest>(req.Body, new JsonSerializerOptions
        {
            PropertyNameCaseInsensitive = true
        });

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

        var verification = _passwordHasher.VerifyHashedPassword(user, user.PasswordHash, loginRequest.Password);
        if (verification == PasswordVerificationResult.Failed)
        {
            var unauthorized = req.CreateResponse(HttpStatusCode.Unauthorized);
            await unauthorized.WriteStringAsync("Invalid credentials.");
            return unauthorized;
        }

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
}
