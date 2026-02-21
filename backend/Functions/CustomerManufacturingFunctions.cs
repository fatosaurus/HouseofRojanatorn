using System.Net;
using System.Security.Claims;
using System.Text.Json;
using System.Text.RegularExpressions;
using backend.Models;
using backend.Services;
using Microsoft.Azure.Functions.Worker;
using Microsoft.Azure.Functions.Worker.Http;

namespace backend.Functions;

public sealed class CustomerManufacturingFunctions
{
    private static readonly JsonSerializerOptions JsonOptions = new()
    {
        PropertyNameCaseInsensitive = true,
    };

    private readonly ICustomerManufacturingSqlService _service;

    public CustomerManufacturingFunctions(ICustomerManufacturingSqlService service)
    {
        _service = service;
    }

    [Function("GetCustomers")]
    public async Task<HttpResponseData> GetCustomers(
        [HttpTrigger(AuthorizationLevel.Anonymous, "get", Route = "customers")] HttpRequestData req)
    {
        var query = System.Web.HttpUtility.ParseQueryString(req.Url.Query);
        var search = query["search"];
        var limit = ParseInt(query["limit"], 100);
        var offset = ParseInt(query["offset"], 0);

        var customers = await _service.GetCustomersAsync(search, limit, offset, req.FunctionContext.CancellationToken);
        var response = req.CreateResponse(HttpStatusCode.OK);
        await response.WriteAsJsonAsync(customers);
        return response;
    }

    [Function("CreateCustomer")]
    public async Task<HttpResponseData> CreateCustomer(
        [HttpTrigger(AuthorizationLevel.Anonymous, "post", Route = "customers")] HttpRequestData req)
    {
        var body = await DeserializeBodyAsync<CustomerUpsertRequest>(req);
        if (body is null)
        {
            return await BadRequestAsync(req, "Invalid customer payload.");
        }

        try
        {
            var created = await _service.CreateCustomerAsync(body, req.FunctionContext.CancellationToken);
            var response = req.CreateResponse(HttpStatusCode.Created);
            await response.WriteAsJsonAsync(created);
            return response;
        }
        catch (ArgumentException ex)
        {
            return await BadRequestAsync(req, ex.Message);
        }
    }

    [Function("GetCustomerById")]
    public async Task<HttpResponseData> GetCustomerById(
        [HttpTrigger(AuthorizationLevel.Anonymous, "get", Route = "customers/{id:guid}")] HttpRequestData req,
        Guid id)
    {
        var customer = await _service.GetCustomerByIdAsync(id, req.FunctionContext.CancellationToken);
        if (customer is null)
        {
            return await NotFoundAsync(req, "Customer not found.");
        }

        var response = req.CreateResponse(HttpStatusCode.OK);
        await response.WriteAsJsonAsync(customer);
        return response;
    }

    [Function("UpdateCustomer")]
    public async Task<HttpResponseData> UpdateCustomer(
        [HttpTrigger(AuthorizationLevel.Anonymous, "put", Route = "customers/{id:guid}")] HttpRequestData req,
        Guid id)
    {
        var body = await DeserializeBodyAsync<CustomerUpsertRequest>(req);
        if (body is null)
        {
            return await BadRequestAsync(req, "Invalid customer payload.");
        }

        try
        {
            var updated = await _service.UpdateCustomerAsync(id, body, req.FunctionContext.CancellationToken);
            if (updated is null)
            {
                return await NotFoundAsync(req, "Customer not found.");
            }

            var response = req.CreateResponse(HttpStatusCode.OK);
            await response.WriteAsJsonAsync(updated);
            return response;
        }
        catch (ArgumentException ex)
        {
            return await BadRequestAsync(req, ex.Message);
        }
    }

    [Function("DeleteCustomer")]
    public async Task<HttpResponseData> DeleteCustomer(
        [HttpTrigger(AuthorizationLevel.Anonymous, "delete", Route = "customers/{id:guid}")] HttpRequestData req,
        Guid id)
    {
        var deleted = await _service.DeleteCustomerAsync(id, req.FunctionContext.CancellationToken);
        if (!deleted)
        {
            return await NotFoundAsync(req, "Customer not found.");
        }

        var response = req.CreateResponse(HttpStatusCode.OK);
        await response.WriteAsJsonAsync(new { success = true });
        return response;
    }

    [Function("AddCustomerNote")]
    public async Task<HttpResponseData> AddCustomerNote(
        [HttpTrigger(AuthorizationLevel.Anonymous, "post", Route = "customers/{id:guid}/notes")] HttpRequestData req,
        Guid id)
    {
        var body = await DeserializeBodyAsync<CustomerNoteRequest>(req);
        if (body is null || string.IsNullOrWhiteSpace(body.Note))
        {
            return await BadRequestAsync(req, "Note content is required.");
        }

        var appended = await _service.AppendCustomerNoteAsync(id, body.Note, req.FunctionContext.CancellationToken);
        if (!appended)
        {
            return await NotFoundAsync(req, "Customer not found.");
        }

        var customer = await _service.GetCustomerByIdAsync(id, req.FunctionContext.CancellationToken);
        var response = req.CreateResponse(HttpStatusCode.OK);
        await response.WriteAsJsonAsync(new
        {
            success = true,
            customer,
        });
        return response;
    }

    [Function("GetCustomerActivity")]
    public async Task<HttpResponseData> GetCustomerActivity(
        [HttpTrigger(AuthorizationLevel.Anonymous, "get", Route = "customers/{id:guid}/activity")] HttpRequestData req,
        Guid id)
    {
        var query = System.Web.HttpUtility.ParseQueryString(req.Url.Query);
        var limit = ParseInt(query["limit"], 100);

        var customer = await _service.GetCustomerByIdAsync(id, req.FunctionContext.CancellationToken);
        if (customer is null)
        {
            return await NotFoundAsync(req, "Customer not found.");
        }

        var activity = await _service.GetCustomerActivityAsync(id, limit, req.FunctionContext.CancellationToken);
        var response = req.CreateResponse(HttpStatusCode.OK);
        await response.WriteAsJsonAsync(activity);
        return response;
    }

    [Function("GetManufacturingProjects")]
    public async Task<HttpResponseData> GetManufacturingProjects(
        [HttpTrigger(AuthorizationLevel.Anonymous, "get", Route = "manufacturing")] HttpRequestData req)
    {
        var query = System.Web.HttpUtility.ParseQueryString(req.Url.Query);
        var search = query["search"];
        var status = query["status"];
        var limit = ParseInt(query["limit"], 100);
        var offset = ParseInt(query["offset"], 0);

        Guid? customerId = null;
        if (!string.IsNullOrWhiteSpace(query["customer_id"]))
        {
            if (!Guid.TryParse(query["customer_id"], out var parsedCustomerId))
            {
                return await BadRequestAsync(req, "Invalid customer_id query value.");
            }

            customerId = parsedCustomerId;
        }

        var records = await _service.GetManufacturingProjectsAsync(
            search,
            status,
            customerId,
            limit,
            offset,
            req.FunctionContext.CancellationToken);

        var response = req.CreateResponse(HttpStatusCode.OK);
        await response.WriteAsJsonAsync(records);
        return response;
    }

    [Function("CreateManufacturingProject")]
    public async Task<HttpResponseData> CreateManufacturingProject(
        [HttpTrigger(AuthorizationLevel.Anonymous, "post", Route = "manufacturing")] HttpRequestData req)
    {
        var body = await DeserializeBodyAsync<ManufacturingProjectUpsertRequest>(req);
        if (body is null)
        {
            return await BadRequestAsync(req, "Invalid manufacturing payload.");
        }

        try
        {
            var created = await _service.CreateManufacturingProjectAsync(body, req.FunctionContext.CancellationToken);
            var response = req.CreateResponse(HttpStatusCode.Created);
            await response.WriteAsJsonAsync(created);
            return response;
        }
        catch (ArgumentException ex)
        {
            return await BadRequestAsync(req, ex.Message);
        }
    }

    [Function("GetManufacturingProjectById")]
    public async Task<HttpResponseData> GetManufacturingProjectById(
        [HttpTrigger(AuthorizationLevel.Anonymous, "get", Route = "manufacturing/{id:int}")] HttpRequestData req,
        int id)
    {
        var record = await _service.GetManufacturingProjectByIdAsync(id, req.FunctionContext.CancellationToken);
        if (record is null)
        {
            return await NotFoundAsync(req, "Manufacturing project not found.");
        }

        var response = req.CreateResponse(HttpStatusCode.OK);
        await response.WriteAsJsonAsync(record);
        return response;
    }

    [Function("UpdateManufacturingProject")]
    public async Task<HttpResponseData> UpdateManufacturingProject(
        [HttpTrigger(AuthorizationLevel.Anonymous, "put", Route = "manufacturing/{id:int}")] HttpRequestData req,
        int id)
    {
        var body = await DeserializeBodyAsync<ManufacturingProjectUpsertRequest>(req);
        if (body is null)
        {
            return await BadRequestAsync(req, "Invalid manufacturing payload.");
        }

        try
        {
            var updated = await _service.UpdateManufacturingProjectAsync(id, body, req.FunctionContext.CancellationToken);
            if (updated is null)
            {
                return await NotFoundAsync(req, "Manufacturing project not found.");
            }

            var response = req.CreateResponse(HttpStatusCode.OK);
            await response.WriteAsJsonAsync(updated);
            return response;
        }
        catch (ArgumentException ex)
        {
            return await BadRequestAsync(req, ex.Message);
        }
    }

    [Function("DeleteManufacturingProject")]
    public async Task<HttpResponseData> DeleteManufacturingProject(
        [HttpTrigger(AuthorizationLevel.Anonymous, "delete", Route = "manufacturing/{id:int}")] HttpRequestData req,
        int id)
    {
        var deleted = await _service.DeleteManufacturingProjectAsync(id, req.FunctionContext.CancellationToken);
        if (!deleted)
        {
            return await NotFoundAsync(req, "Manufacturing project not found.");
        }

        var response = req.CreateResponse(HttpStatusCode.OK);
        await response.WriteAsJsonAsync(new { success = true });
        return response;
    }

    [Function("GetBusinessAnalytics")]
    public async Task<HttpResponseData> GetBusinessAnalytics(
        [HttpTrigger(AuthorizationLevel.Anonymous, "get", Route = "analytics")] HttpRequestData req)
    {
        var analytics = await _service.GetAnalyticsAsync(req.FunctionContext.CancellationToken);
        var response = req.CreateResponse(HttpStatusCode.OK);
        await response.WriteAsJsonAsync(analytics);
        return response;
    }

    [Function("GetManufacturingSettings")]
    public async Task<HttpResponseData> GetManufacturingSettings(
        [HttpTrigger(AuthorizationLevel.Anonymous, "get", Route = "manufacturing/settings")] HttpRequestData req)
    {
        var settings = await _service.GetManufacturingSettingsAsync(req.FunctionContext.CancellationToken);
        var response = req.CreateResponse(HttpStatusCode.OK);
        await response.WriteAsJsonAsync(settings);
        return response;
    }

    [Function("UpdateManufacturingSettings")]
    public async Task<HttpResponseData> UpdateManufacturingSettings(
        [HttpTrigger(AuthorizationLevel.Anonymous, "put", Route = "manufacturing/settings")] HttpRequestData req,
        FunctionContext executionContext)
    {
        var principal = GetPrincipal(executionContext);
        if (!IsAdmin(principal))
        {
            return await ForbiddenAsync(req, "Admin role required.");
        }

        var body = await DeserializeBodyAsync<ManufacturingSettingsUpdateRequest>(req);
        if (body is null)
        {
            return await BadRequestAsync(req, "Invalid settings payload.");
        }

        try
        {
            var saved = await _service.SaveManufacturingSettingsAsync(body, req.FunctionContext.CancellationToken);
            var response = req.CreateResponse(HttpStatusCode.OK);
            await response.WriteAsJsonAsync(saved);
            return response;
        }
        catch (ArgumentException ex)
        {
            return await BadRequestAsync(req, ex.Message);
        }
    }

    [Function("ParseManufacturingNote")]
    public async Task<HttpResponseData> ParseManufacturingNote(
        [HttpTrigger(AuthorizationLevel.Anonymous, "post", Route = "manufacturing/ai/parse-note")] HttpRequestData req)
    {
        var body = await DeserializeBodyAsync<ManufacturingNoteParseRequest>(req);
        if (body is null || string.IsNullOrWhiteSpace(body.NoteText))
        {
            return await BadRequestAsync(req, "Note text is required.");
        }

        var settings = await _service.GetManufacturingSettingsAsync(req.FunctionContext.CancellationToken);
        var defaultStatus = settings.Steps
            .Where(step => step.IsActive)
            .OrderBy(step => step.SortOrder)
            .Select(step => step.StepKey)
            .FirstOrDefault() ?? ManufacturingStatuses.Approved;

        var parsed = ParseDraftFromNote(body.NoteText, defaultStatus);
        var response = req.CreateResponse(HttpStatusCode.OK);
        await response.WriteAsJsonAsync(parsed);
        return response;
    }

    private static async Task<T?> DeserializeBodyAsync<T>(HttpRequestData req)
    {
        try
        {
            return await JsonSerializer.DeserializeAsync<T>(req.Body, JsonOptions);
        }
        catch
        {
            return default;
        }
    }

    private static async Task<HttpResponseData> BadRequestAsync(HttpRequestData req, string message)
    {
        var response = req.CreateResponse(HttpStatusCode.BadRequest);
        await response.WriteAsJsonAsync(new { error = message });
        return response;
    }

    private static async Task<HttpResponseData> NotFoundAsync(HttpRequestData req, string message)
    {
        var response = req.CreateResponse(HttpStatusCode.NotFound);
        await response.WriteAsJsonAsync(new { error = message });
        return response;
    }

    private static async Task<HttpResponseData> ForbiddenAsync(HttpRequestData req, string message)
    {
        var response = req.CreateResponse(HttpStatusCode.Forbidden);
        await response.WriteAsJsonAsync(new { error = message });
        return response;
    }

    private static int ParseInt(string? value, int fallback)
    {
        if (int.TryParse(value, out var parsed))
        {
            return parsed;
        }

        return fallback;
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

    private static ManufacturingNoteParseResponse ParseDraftFromNote(string noteText, string defaultStatus)
    {
        var normalized = noteText.Trim();
        var lines = normalized
            .Split(['\r', '\n'], StringSplitOptions.RemoveEmptyEntries)
            .Select(line => line.Trim())
            .Where(line => line.Length > 0)
            .ToList();

        var manufacturingCode = Regex.Match(normalized, @"\b[A-Z]{1,4}\d{5,}\b").Value;
        if (string.IsNullOrWhiteSpace(manufacturingCode))
        {
            manufacturingCode = Regex.Match(normalized, @"\b[A-Z]{2}\d{4,}\b").Value;
        }

        var designerName = FindLabeledValue(lines, ["designer", "design by", "designer name"]);
        var craftsmanName = FindLabeledValue(lines, ["craftsman", "maker", "craft by"]);
        var pieceName = FindLabeledValue(lines, ["piece", "item", "product"]);
        var pieceType = DetectPieceType(normalized);

        if (string.IsNullOrWhiteSpace(pieceName))
        {
            pieceName = pieceType is null ? "New Piece From Note" : $"{pieceType} from note";
        }

        decimal? sellingPrice = TryExtractMoney(normalized, ["selling", "sale", "sell"]);
        decimal? totalCost = TryExtractMoney(normalized, ["total cost", "cost"]);

        var gemstones = ParseGemstoneLines(lines);

        return new ManufacturingNoteParseResponse
        {
            ManufacturingCode = string.IsNullOrWhiteSpace(manufacturingCode) ? null : manufacturingCode,
            PieceName = pieceName,
            PieceType = pieceType,
            Status = ManufacturingStatuses.NormalizeOrDefault(defaultStatus),
            DesignerName = designerName,
            CraftsmanName = craftsmanName,
            UsageNotes = normalized,
            TotalCost = totalCost,
            SellingPrice = sellingPrice,
            Gemstones = gemstones
        };
    }

    private static string? FindLabeledValue(IEnumerable<string> lines, IEnumerable<string> labels)
    {
        foreach (var line in lines)
        {
            foreach (var label in labels)
            {
                var pattern = $"^{Regex.Escape(label)}\\s*[:\\-]\\s*(.+)$";
                var match = Regex.Match(line, pattern, RegexOptions.IgnoreCase);
                if (match.Success)
                {
                    return match.Groups[1].Value.Trim();
                }
            }
        }

        return null;
    }

    private static string? DetectPieceType(string text)
    {
        var mapping = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase)
        {
            ["earring"] = "earrings",
            ["earrings"] = "earrings",
            ["bracelet"] = "bracelet",
            ["choker"] = "choker",
            ["necklace"] = "necklace",
            ["brooch"] = "brooch",
            ["ring"] = "ring",
            ["pendant"] = "pendant"
        };

        foreach (var pair in mapping)
        {
            if (Regex.IsMatch(text, $"\\b{Regex.Escape(pair.Key)}\\b", RegexOptions.IgnoreCase))
            {
                return pair.Value;
            }
        }

        return null;
    }

    private static decimal? TryExtractMoney(string text, IEnumerable<string> labels)
    {
        foreach (var label in labels)
        {
            var match = Regex.Match(text, $"{Regex.Escape(label)}\\s*[:\\-]?\\s*([\\d,]+(?:\\.\\d+)?)", RegexOptions.IgnoreCase);
            if (match.Success && decimal.TryParse(match.Groups[1].Value.Replace(",", ""), out var value))
            {
                return value;
            }
        }

        return null;
    }

    private static IReadOnlyList<ManufacturingGemstoneUpsertRequest> ParseGemstoneLines(IEnumerable<string> lines)
    {
        var results = new List<ManufacturingGemstoneUpsertRequest>();
        var regex = new Regex(
            @"^(?<code>[A-Z0-9\-#]{2,})?(?:\s+)?(?<type>[A-Za-z][A-Za-z0-9\s\-]{1,40})?(?:\s+)?(?:(?<pcs>\d+(?:\.\d+)?)\s*pcs?)?(?:\s+)?(?:(?<ct>\d+(?:\.\d+)?)\s*ct)?(?:\s+)?(?:(?<cost>\d+(?:,\d{3})*(?:\.\d+)?)\s*(?:thb|baht)?)?$",
            RegexOptions.IgnoreCase);

        foreach (var line in lines)
        {
            if (line.Length < 3)
            {
                continue;
            }

            var match = regex.Match(line);
            if (!match.Success)
            {
                continue;
            }

            var code = match.Groups["code"].Value.Trim();
            var type = match.Groups["type"].Value.Trim();

            if (string.IsNullOrWhiteSpace(code) && string.IsNullOrWhiteSpace(type))
            {
                continue;
            }

            _ = decimal.TryParse(match.Groups["pcs"].Value, out var pcs);
            _ = decimal.TryParse(match.Groups["ct"].Value, out var ct);
            _ = decimal.TryParse(match.Groups["cost"].Value.Replace(",", ""), out var cost);

            results.Add(new ManufacturingGemstoneUpsertRequest
            {
                GemstoneCode = string.IsNullOrWhiteSpace(code) ? null : code,
                GemstoneType = string.IsNullOrWhiteSpace(type) ? null : type,
                PiecesUsed = pcs > 0 ? pcs : null,
                WeightUsedCt = ct > 0 ? ct : null,
                LineCost = cost > 0 ? cost : null
            });
        }

        return results;
    }
}
