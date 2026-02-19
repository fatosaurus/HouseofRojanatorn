namespace backend.Models;

public sealed record SqlHealthResponse(
    bool IsConfigured,
    bool IsReachable,
    string Message,
    DateTime CheckedAtUtc);
