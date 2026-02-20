using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;
using backend.Models;
using Microsoft.Extensions.Options;
using Microsoft.IdentityModel.Tokens;

namespace backend.Services;

public interface IJwtService
{
    AuthResponse GenerateToken(UserRecord user);
    ClaimsPrincipal? ValidateToken(string token);
}

public class JwtService : IJwtService
{
    private readonly JwtOptions _options;
    private readonly SigningCredentials _signingCredentials;
    private readonly TokenValidationParameters _validationParameters;

    public JwtService(IOptions<JwtOptions> options)
    {
        _options = options.Value;
        if (string.IsNullOrWhiteSpace(_options.SigningKey))
        {
            throw new InvalidOperationException("JWT SigningKey configuration is required.");
        }

        var securityKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(_options.SigningKey));
        _signingCredentials = new SigningCredentials(securityKey, SecurityAlgorithms.HmacSha256);
        _validationParameters = new TokenValidationParameters
        {
            ValidateIssuer = true,
            ValidIssuer = _options.Issuer,
            ValidateAudience = true,
            ValidAudience = _options.Audience,
            ValidateIssuerSigningKey = true,
            IssuerSigningKey = securityKey,
            ValidateLifetime = true,
            ClockSkew = TimeSpan.FromMinutes(1)
        };
    }

    public AuthResponse GenerateToken(UserRecord user)
    {
        var handler = new JwtSecurityTokenHandler();
        var expires = DateTime.UtcNow.AddMinutes(_options.ExpiryMinutes);

        var token = handler.CreateJwtSecurityToken(
            issuer: _options.Issuer,
            audience: _options.Audience,
            subject: new ClaimsIdentity(new[]
            {
                new Claim(JwtRegisteredClaimNames.Sub, user.id),
                new Claim(JwtRegisteredClaimNames.Email, user.Email),
                new Claim(ClaimTypes.Role, UserRoles.Normalize(user.Role))
            }),
            notBefore: DateTime.UtcNow,
            expires: expires,
            signingCredentials: _signingCredentials);

        return new AuthResponse(handler.WriteToken(token), expires, UserRoles.Normalize(user.Role));
    }

    public ClaimsPrincipal? ValidateToken(string token)
    {
        var handler = new JwtSecurityTokenHandler();
        try
        {
            return handler.ValidateToken(token, _validationParameters, out _);
        }
        catch
        {
            return null;
        }
    }
}
