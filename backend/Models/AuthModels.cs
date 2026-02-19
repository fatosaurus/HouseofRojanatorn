using System.ComponentModel.DataAnnotations;

namespace backend.Models;

public record CreateUserRequest(
    [property: Required, EmailAddress] string Email,
    [property: Required, MinLength(8)] string Password,
    string? Role = null);

public record LoginRequest(
    [property: Required, EmailAddress] string Email,
    [property: Required] string Password);

public record UpdatePasswordRequest(
    [property: Required, MinLength(8)] string CurrentPassword,
    [property: Required, MinLength(8)] string NewPassword);

public record AuthResponse(string Token, DateTime ExpiresAtUtc, string Role);

public sealed class UserSummary
{
    public string id { get; set; } = string.Empty;
    public string Email { get; set; } = string.Empty;
    public string Role { get; set; } = UserRoles.Member;
}

public sealed class UserListResponse
{
    public required IReadOnlyList<UserSummary> Items { get; init; }
    public string? ContinuationToken { get; init; }
}

public sealed record MeProfileResponse(string UserId, string Email, string Role);

public sealed record LookupsResponse(IReadOnlyList<string> Roles);
