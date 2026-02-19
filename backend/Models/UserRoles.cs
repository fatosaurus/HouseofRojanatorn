namespace backend.Models;

public static class UserRoles
{
    public const string Member = "member";
    public const string Admin = "admin";

    private static readonly HashSet<string> AllowedRoles = new(StringComparer.OrdinalIgnoreCase)
    {
        Member,
        Admin
    };

    public static string Normalize(string? role)
    {
        if (string.IsNullOrWhiteSpace(role))
        {
            return Member;
        }

        var normalized = role.Trim().ToLowerInvariant();
        return AllowedRoles.Contains(normalized) ? normalized : Member;
    }
}
