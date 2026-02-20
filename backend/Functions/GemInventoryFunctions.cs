using System.Net;
using backend.Services;
using Microsoft.Azure.Functions.Worker;
using Microsoft.Azure.Functions.Worker.Http;

namespace backend.Functions;

public sealed class GemInventoryFunctions
{
    private readonly IGemInventorySqlService _inventoryService;

    public GemInventoryFunctions(IGemInventorySqlService inventoryService)
    {
        _inventoryService = inventoryService;
    }

    [Function("GetInventorySummary")]
    public async Task<HttpResponseData> GetInventorySummary(
        [HttpTrigger(AuthorizationLevel.Anonymous, "get", Route = "inventory/summary")] HttpRequestData req)
    {
        var summary = await _inventoryService.GetSummaryAsync(req.FunctionContext.CancellationToken);
        var response = req.CreateResponse(HttpStatusCode.OK);
        await response.WriteAsJsonAsync(summary);
        return response;
    }

    [Function("GetInventoryItems")]
    public async Task<HttpResponseData> GetInventoryItems(
        [HttpTrigger(AuthorizationLevel.Anonymous, "get", Route = "inventory/gemstones")] HttpRequestData req)
    {
        var query = System.Web.HttpUtility.ParseQueryString(req.Url.Query);
        var search = query["search"];
        var type = query["type"];
        var status = query["status"];
        var limit = ParseInt(query["limit"], 50);
        var offset = ParseInt(query["offset"], 0);

        var items = await _inventoryService.GetInventoryItemsAsync(search, type, status, limit, offset, req.FunctionContext.CancellationToken);
        var response = req.CreateResponse(HttpStatusCode.OK);
        await response.WriteAsJsonAsync(items);
        return response;
    }

    [Function("GetInventoryItemById")]
    public async Task<HttpResponseData> GetInventoryItemById(
        [HttpTrigger(AuthorizationLevel.Anonymous, "get", Route = "inventory/gemstones/{id:int}")] HttpRequestData req,
        int id)
    {
        var item = await _inventoryService.GetInventoryItemByIdAsync(id, req.FunctionContext.CancellationToken);
        if (item is null)
        {
            var notFound = req.CreateResponse(HttpStatusCode.NotFound);
            await notFound.WriteAsJsonAsync(new { error = "Inventory item not found." });
            return notFound;
        }

        var response = req.CreateResponse(HttpStatusCode.OK);
        await response.WriteAsJsonAsync(item);
        return response;
    }

    [Function("GetUsageBatches")]
    public async Task<HttpResponseData> GetUsageBatches(
        [HttpTrigger(AuthorizationLevel.Anonymous, "get", Route = "inventory/usage")] HttpRequestData req)
    {
        var query = System.Web.HttpUtility.ParseQueryString(req.Url.Query);
        var search = query["search"];
        var category = query["category"];
        var limit = ParseInt(query["limit"], 50);
        var offset = ParseInt(query["offset"], 0);

        var batches = await _inventoryService.GetUsageBatchesAsync(search, category, limit, offset, req.FunctionContext.CancellationToken);
        var response = req.CreateResponse(HttpStatusCode.OK);
        await response.WriteAsJsonAsync(batches);
        return response;
    }

    [Function("GetUsageBatchById")]
    public async Task<HttpResponseData> GetUsageBatchById(
        [HttpTrigger(AuthorizationLevel.Anonymous, "get", Route = "inventory/usage/{batchId:int}")] HttpRequestData req,
        int batchId)
    {
        var batch = await _inventoryService.GetUsageBatchDetailAsync(batchId, req.FunctionContext.CancellationToken);
        if (batch is null)
        {
            var notFound = req.CreateResponse(HttpStatusCode.NotFound);
            await notFound.WriteAsJsonAsync(new { error = "Usage batch not found." });
            return notFound;
        }

        var response = req.CreateResponse(HttpStatusCode.OK);
        await response.WriteAsJsonAsync(batch);
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
}
