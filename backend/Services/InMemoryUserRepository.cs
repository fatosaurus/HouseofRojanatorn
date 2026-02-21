using System.Collections.Concurrent;
using backend.Models;

namespace backend.Services;

public sealed class InMemoryUserRepository : IUserRepository
{
    private readonly ConcurrentDictionary<string, UserRecord> _byId = new();
    private readonly ConcurrentDictionary<string, string> _idByEmail = new(StringComparer.OrdinalIgnoreCase);

    public Task<UserRecord?> GetByEmailAsync(string email, CancellationToken cancellationToken = default)
    {
        if (string.IsNullOrWhiteSpace(email))
        {
            return Task.FromResult<UserRecord?>(null);
        }

        var normalizedEmail = email.Trim().ToLowerInvariant();
        if (_idByEmail.TryGetValue(normalizedEmail, out var id) && _byId.TryGetValue(id, out var user))
        {
            user.Role = UserRoles.Normalize(user.Role);
            return Task.FromResult<UserRecord?>(user);
        }

        return Task.FromResult<UserRecord?>(null);
    }

    public Task<UserRecord?> GetByIdAsync(string id, CancellationToken cancellationToken = default)
    {
        if (string.IsNullOrWhiteSpace(id))
        {
            return Task.FromResult<UserRecord?>(null);
        }

        if (_byId.TryGetValue(id, out var user))
        {
            user.Role = UserRoles.Normalize(user.Role);
            return Task.FromResult<UserRecord?>(user);
        }

        return Task.FromResult<UserRecord?>(null);
    }

    public Task<UserRecord?> GetByInviteTokenAsync(string token, CancellationToken cancellationToken = default)
    {
        if (string.IsNullOrWhiteSpace(token))
        {
            return Task.FromResult<UserRecord?>(null);
        }

        var match = _byId.Values.FirstOrDefault(user =>
            !string.IsNullOrWhiteSpace(user.InviteToken) &&
            string.Equals(user.InviteToken, token.Trim(), StringComparison.Ordinal));

        if (match is not null)
        {
            match.Role = UserRoles.Normalize(match.Role);
        }

        return Task.FromResult<UserRecord?>(match);
    }

    public Task CreateAsync(UserRecord user, CancellationToken cancellationToken = default)
    {
        user.Email = user.Email.Trim().ToLowerInvariant();
        user.Role = UserRoles.Normalize(user.Role);
        if (user.CreatedAtUtc == default)
        {
            user.CreatedAtUtc = DateTime.UtcNow;
        }

        _byId[user.id] = user;
        _idByEmail[user.Email] = user.id;
        return Task.CompletedTask;
    }

    public Task UpsertAsync(UserRecord user, CancellationToken cancellationToken = default)
    {
        user.Email = user.Email.Trim().ToLowerInvariant();
        user.Role = UserRoles.Normalize(user.Role);
        if (user.CreatedAtUtc == default)
        {
            user.CreatedAtUtc = DateTime.UtcNow;
        }

        _byId[user.id] = user;
        _idByEmail[user.Email] = user.id;
        return Task.CompletedTask;
    }

    public Task UpdatePasswordAsync(string userId, string newPasswordHash, CancellationToken cancellationToken = default)
    {
        if (!_byId.TryGetValue(userId, out var user))
        {
            throw new InvalidOperationException("User not found.");
        }

        user.PasswordHash = newPasswordHash;
        user.Role = UserRoles.Normalize(user.Role);
        user.InviteToken = null;
        user.InviteExpiresAtUtc = null;
        user.ActivatedAtUtc ??= DateTime.UtcNow;
        return Task.CompletedTask;
    }

    public Task<bool> DeleteAsync(string userId, CancellationToken cancellationToken = default)
    {
        if (!_byId.TryRemove(userId, out var existing))
        {
            return Task.FromResult(false);
        }

        _idByEmail.TryRemove(existing.Email, out _);
        return Task.FromResult(true);
    }

    public Task<int> CountAsync(CancellationToken cancellationToken = default)
        => Task.FromResult(_byId.Count);

    public Task<UserListResponse> ListAsync(int limit, string? continuationToken, CancellationToken cancellationToken = default)
    {
        var now = DateTime.UtcNow;
        var items = _byId.Values
            .OrderBy(user => user.Email, StringComparer.OrdinalIgnoreCase)
            .Take(Math.Clamp(limit, 1, 200))
            .Select(user => new UserSummary
            {
                id = user.id,
                Email = user.Email,
                Role = UserRoles.Normalize(user.Role),
                Status = string.IsNullOrWhiteSpace(user.PasswordHash) && (user.InviteExpiresAtUtc is null || user.InviteExpiresAtUtc > now)
                    ? "invited"
                    : "active",
                CreatedAtUtc = user.CreatedAtUtc,
                ActivatedAtUtc = user.ActivatedAtUtc,
                LastLoginAtUtc = user.LastLoginAtUtc,
                InviteExpiresAtUtc = user.InviteExpiresAtUtc
            })
            .ToList();

        return Task.FromResult(new UserListResponse
        {
            Items = items,
            ContinuationToken = null
        });
    }
}
