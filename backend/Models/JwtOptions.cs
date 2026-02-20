namespace backend.Models;

public sealed class JwtOptions
{
    public string Issuer { get; set; } = "houseofrojanatorn";
    public string Audience { get; set; } = "houseofrojanatorn-clients";
    public string SigningKey { get; set; } = string.Empty;
    public int ExpiryMinutes { get; set; } = 1440;
}
