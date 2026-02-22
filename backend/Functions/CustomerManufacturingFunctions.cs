using System.Net;
using System.Security.Claims;
using System.Globalization;
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
        var gemstones = ParseGemstoneLines(lines, out var gemstoneLineIndexes);
        var usageNotes = BuildUsageNotes(lines, gemstoneLineIndexes);

        if (string.IsNullOrWhiteSpace(pieceName))
        {
            pieceName = GuessPieceName(lines, manufacturingCode, pieceType);
        }

        if (string.IsNullOrWhiteSpace(pieceName))
        {
            pieceName = pieceType is null ? "New Piece From Note" : $"{pieceType} from note";
        }

        decimal? sellingPrice = TryExtractMoney(normalized, ["selling", "sale", "sell"]);
        decimal? totalCost = TryExtractMoney(normalized, ["total cost", "cost", "budget"]);
        if (!totalCost.HasValue && gemstones.Count > 0)
        {
            totalCost = gemstones.Sum(item => item.LineCost ?? 0m);
        }

        return new ManufacturingNoteParseResponse
        {
            ManufacturingCode = string.IsNullOrWhiteSpace(manufacturingCode) ? null : manufacturingCode,
            PieceName = pieceName,
            PieceType = pieceType,
            Status = ManufacturingStatuses.NormalizeOrDefault(defaultStatus),
            DesignerName = designerName,
            CraftsmanName = craftsmanName,
            UsageNotes = usageNotes,
            TotalCost = totalCost,
            SellingPrice = sellingPrice,
            Gemstones = gemstones
        };
    }

    private static string? GuessPieceName(IReadOnlyList<string> lines, string manufacturingCode, string? pieceType)
    {
        foreach (var line in lines)
        {
            if (line.Length < 6)
            {
                continue;
            }

            if (!string.IsNullOrWhiteSpace(manufacturingCode) &&
                line.Contains(manufacturingCode, StringComparison.OrdinalIgnoreCase))
            {
                continue;
            }

            if (LooksLikeGemstoneRow(line))
            {
                continue;
            }

            if (IsNonGemHeaderLine(line) ||
                Regex.IsMatch(line, @"^gem\s*(use|usage)\b", RegexOptions.IgnoreCase) ||
                Regex.IsMatch(line, @"^(total|code|price|qty|amount|budget)\b", RegexOptions.IgnoreCase))
            {
                continue;
            }

            if (!Regex.IsMatch(line, @"[A-Za-z]", RegexOptions.CultureInvariant))
            {
                continue;
            }

            return line;
        }

        return pieceType is null ? null : $"{pieceType} from note";
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
            var match = Regex.Match(
                text,
                $@"\b{Regex.Escape(label)}\b\s*[:\-]?\s*(?<value>[\d,]+(?:\.\d+)?)",
                RegexOptions.IgnoreCase);
            if (match.Success)
            {
                var parsed = ParseDecimal(match.Groups["value"].Value);
                if (parsed.HasValue)
                {
                    return parsed;
                }
            }
        }

        return null;
    }

    private static IReadOnlyList<ManufacturingGemstoneUpsertRequest> ParseGemstoneLines(
        IReadOnlyList<string> lines,
        out HashSet<int> matchedLineIndexes)
    {
        matchedLineIndexes = [];
        var results = new List<ManufacturingGemstoneUpsertRequest>();
        for (var index = 0; index < lines.Count; index++)
        {
            var line = NormalizeNoteLine(lines[index]);
            if (line.Length < 3 || IsNonGemHeaderLine(line))
            {
                continue;
            }

            if (!LooksLikeGemstoneRow(line))
            {
                continue;
            }

            var candidate = line;
            var consumedNextLine = false;
            if (!HasGemstoneSignals(candidate) && index + 1 < lines.Count)
            {
                var nextLine = NormalizeNoteLine(lines[index + 1]);
                if (!LooksLikeGemstoneRow(nextLine) && !IsNonGemHeaderLine(nextLine) && nextLine.Length > 0)
                {
                    var merged = $"{candidate} {nextLine}";
                    if (HasGemstoneSignals(merged))
                    {
                        candidate = merged;
                        consumedNextLine = true;
                    }
                }
            }

            var parsedRow = ParseGemstoneRow(candidate);
            if (parsedRow is null)
            {
                continue;
            }

            results.Add(parsedRow);
            matchedLineIndexes.Add(index);
            if (consumedNextLine)
            {
                matchedLineIndexes.Add(index + 1);
                index++;
            }
        }

        return results;
    }

    private static ManufacturingGemstoneUpsertRequest? ParseGemstoneRow(string normalizedLine)
    {
        var codeMatch = Regex.Match(normalizedLine, @"^\s*#?(?<code>[A-Z]{0,3}\d{3,8}[A-Z]?)\b", RegexOptions.IgnoreCase);
        if (!codeMatch.Success)
        {
            return null;
        }

        var code = codeMatch.Groups["code"].Value.Trim();
        var remainder = normalizedLine[codeMatch.Length..].Trim();
        if (remainder.Length == 0 || !HasGemstoneSignals(remainder))
        {
            return null;
        }

        var priceMatch = Regex.Match(
            remainder,
            @"(?<value>\d+(?:\.\d+)?)\s*/\s*(?<unit>ct|carat|pcs?|pc|piece)\b",
            RegexOptions.IgnoreCase);
        var pricePerUnit = ParseDecimal(priceMatch.Groups["value"].Value);
        var priceUnit = priceMatch.Groups["unit"].Value.Trim().ToLowerInvariant();

        decimal? pieces = ParseDecimal(Regex.Match(remainder, @"\((?<value>\d+(?:\.\d+)?)\)").Groups["value"].Value);
        if (!pieces.HasValue)
        {
            pieces = ParseDecimal(Regex.Match(remainder, @"(?<value>\d+(?:\.\d+)?)\s*pcs?\b", RegexOptions.IgnoreCase).Groups["value"].Value);
        }

        decimal? weightCt = ParseDecimal(
            Regex.Match(
                remainder,
                @"\d+(?:\.\d+)?\s*[-–]\s*\d+(?:\.\d+)?\s*=\s*(?<value>\d+(?:\.\d+)?)\s*ct?\b",
                RegexOptions.IgnoreCase).Groups["value"].Value);
        if (!weightCt.HasValue)
        {
            weightCt = ParseDecimal(Regex.Match(remainder, @"=\s*(?<value>\d+(?:\.\d+)?)\s*ct?\b", RegexOptions.IgnoreCase).Groups["value"].Value);
        }

        if (!weightCt.HasValue)
        {
            var ctMatches = Regex.Matches(remainder, @"(?<value>\d+(?:\.\d+)?)\s*ct\b", RegexOptions.IgnoreCase);
            if (ctMatches.Count > 0)
            {
                weightCt = ParseDecimal(ctMatches[^1].Groups["value"].Value);
            }
        }

        var multiplicationMatch = Regex.Match(
            remainder,
            @"(?<qty>\d+(?:\.\d+)?)\s*[x*×]\s*(?<rate>\d+(?:\.\d+)?)\s*=\s*(?<value>\d+(?:\.\d+)?)",
            RegexOptions.IgnoreCase);

        decimal? lineCost = ParseDecimal(multiplicationMatch.Groups["value"].Value);
        if (!lineCost.HasValue)
        {
            lineCost = ParseDecimal(Regex.Match(remainder, @"=\s*(?<value>\d+(?:\.\d+)?)\s*$").Groups["value"].Value);
        }

        if (!lineCost.HasValue && pricePerUnit.HasValue)
        {
            if ((priceUnit.StartsWith("ct", StringComparison.OrdinalIgnoreCase) || priceUnit.StartsWith("carat", StringComparison.OrdinalIgnoreCase)) && weightCt.HasValue)
            {
                lineCost = decimal.Round(pricePerUnit.Value * weightCt.Value, 2, MidpointRounding.AwayFromZero);
            }
            else if (
                (priceUnit.StartsWith("pc", StringComparison.OrdinalIgnoreCase) || priceUnit.StartsWith("piece", StringComparison.OrdinalIgnoreCase)) &&
                pieces.HasValue)
            {
                lineCost = decimal.Round(pricePerUnit.Value * pieces.Value, 2, MidpointRounding.AwayFromZero);
            }
        }

        if (!pieces.HasValue && multiplicationMatch.Success && priceUnit.StartsWith("pc", StringComparison.OrdinalIgnoreCase))
        {
            pieces = ParseDecimal(multiplicationMatch.Groups["qty"].Value);
        }

        if (!weightCt.HasValue && multiplicationMatch.Success &&
            (priceUnit.StartsWith("ct", StringComparison.OrdinalIgnoreCase) || priceUnit.StartsWith("carat", StringComparison.OrdinalIgnoreCase)))
        {
            weightCt = ParseDecimal(multiplicationMatch.Groups["qty"].Value);
        }

        var typeText = remainder;
        if (priceMatch.Success)
        {
            typeText = remainder[..priceMatch.Index].Trim();
        }
        else if (multiplicationMatch.Success)
        {
            typeText = remainder[..multiplicationMatch.Index].Trim();
        }

        typeText = Regex.Replace(typeText, @"\s+", " ").Trim('-', ':', '|', ' ');
        if (string.IsNullOrWhiteSpace(typeText))
        {
            typeText = null;
        }

        if (!pieces.HasValue && !weightCt.HasValue && !lineCost.HasValue && string.IsNullOrWhiteSpace(typeText))
        {
            return null;
        }

        return new ManufacturingGemstoneUpsertRequest
        {
            GemstoneCode = string.IsNullOrWhiteSpace(code) ? null : code,
            GemstoneType = typeText,
            PiecesUsed = pieces > 0 ? pieces : null,
            WeightUsedCt = weightCt > 0 ? weightCt : null,
            LineCost = lineCost > 0 ? lineCost : null
        };
    }

    private static string? BuildUsageNotes(IReadOnlyList<string> lines, ISet<int> gemstoneLineIndexes)
    {
        var noteLines = new List<string>();
        for (var index = 0; index < lines.Count; index++)
        {
            if (gemstoneLineIndexes.Contains(index))
            {
                continue;
            }

            var line = lines[index].Trim();
            if (line.Length == 0)
            {
                continue;
            }

            if (IsNonGemHeaderLine(line) ||
                Regex.IsMatch(line, @"^(total|sum|code|price)\b", RegexOptions.IgnoreCase))
            {
                continue;
            }

            if (LooksLikeGemstoneRow(line) && HasGemstoneSignals(line))
            {
                continue;
            }

            noteLines.Add(line);
        }

        if (noteLines.Count == 0)
        {
            return null;
        }

        return string.Join(" | ", noteLines.Take(5));
    }

    private static bool IsNonGemHeaderLine(string line)
    {
        var normalized = NormalizeNoteLine(line);
        if (normalized.Length == 0)
        {
            return true;
        }

        return Regex.IsMatch(
            normalized,
            @"^(gem\s*(use|usage)|code\b|price\b|qty\b|quantity\b|unit\b|amount\b|description\b|total\b|grand total\b)",
            RegexOptions.IgnoreCase);
    }

    private static bool LooksLikeGemstoneRow(string line)
    {
        var normalized = NormalizeNoteLine(line);
        return Regex.IsMatch(normalized, @"^\s*#?[A-Z]{0,3}\d{3,8}[A-Z]?\b", RegexOptions.IgnoreCase);
    }

    private static bool HasGemstoneSignals(string line)
    {
        return Regex.IsMatch(line, @"\bct\b|\bcarat\b|\bpcs?\b|\bpiece\b|/\s*(ct|carat|pcs?|pc|piece)\b", RegexOptions.IgnoreCase) ||
            Regex.IsMatch(line, @"\d+(?:\.\d+)?\s*[-–]\s*\d+(?:\.\d+)?\s*=", RegexOptions.IgnoreCase) ||
            Regex.IsMatch(line, @"\d+(?:\.\d+)?\s*[x*×]\s*\d+(?:\.\d+)?", RegexOptions.IgnoreCase) ||
            line.Contains('=');
    }

    private static string NormalizeNoteLine(string line)
    {
        return Regex
            .Replace(
                line
                    .Replace('|', ' ')
                    .Replace('\t', ' ')
                    .Replace('×', 'x'),
                @"\s+",
                " ")
            .Trim();
    }

    private static decimal? ParseDecimal(string? value)
    {
        if (string.IsNullOrWhiteSpace(value))
        {
            return null;
        }

        var sanitized = value.Replace(",", string.Empty).Trim();
        if (decimal.TryParse(sanitized, NumberStyles.Number, CultureInfo.InvariantCulture, out var parsed))
        {
            return parsed;
        }

        if (decimal.TryParse(sanitized, NumberStyles.Number, CultureInfo.CurrentCulture, out parsed))
        {
            return parsed;
        }

        return null;
    }
}
