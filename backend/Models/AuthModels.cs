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

public record InviteUserRequest(
    [property: Required, EmailAddress] string Email,
    string? Role = null,
    int? ExpiresInDays = null);

public record AcceptInviteRequest(
    [property: Required] string Token,
    [property: Required, MinLength(8)] string Password);

public sealed class UserSummary
{
    public string id { get; set; } = string.Empty;
    public string Email { get; set; } = string.Empty;
    public string Role { get; set; } = UserRoles.Member;
    public string Status { get; set; } = "active";
    public DateTime CreatedAtUtc { get; set; }
    public DateTime? ActivatedAtUtc { get; set; }
    public DateTime? LastLoginAtUtc { get; set; }
    public DateTime? InviteExpiresAtUtc { get; set; }
}

public sealed class UserListResponse
{
    public required IReadOnlyList<UserSummary> Items { get; init; }
    public string? ContinuationToken { get; init; }
}

public sealed record InviteResponse(string Email, string Role, string Token, DateTime ExpiresAtUtc);
public sealed record InviteDetailsResponse(string Email, string Role, DateTime ExpiresAtUtc);

public sealed record MeProfileResponse(string UserId, string Email, string Role);

public sealed record LookupsResponse(IReadOnlyList<string> Roles);
