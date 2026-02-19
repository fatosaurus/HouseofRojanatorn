using System.Net;
using backend.Services;
using Microsoft.Azure.Functions.Worker;
using Microsoft.Azure.Functions.Worker.Http;

namespace backend.Functions;

public sealed class HealthFunctions
{
    private readonly ISqlDataService _sqlDataService;

    public HealthFunctions(ISqlDataService sqlDataService)
    {
        _sqlDataService = sqlDataService;
    }

    [Function("GetHealth")]
    public async Task<HttpResponseData> GetHealth(
        [HttpTrigger(AuthorizationLevel.Anonymous, "get", Route = "health")] HttpRequestData req)
    {
        var response = req.CreateResponse(HttpStatusCode.OK);
        await response.WriteAsJsonAsync(new
        {
            status = "ok",
            service = "houseofrojanatorn-backend",
            checkedAtUtc = DateTime.UtcNow
        });
        return response;
    }

    [Function("GetSqlHealth")]
    public async Task<HttpResponseData> GetSqlHealth(
        [HttpTrigger(AuthorizationLevel.Anonymous, "get", Route = "health/sql")] HttpRequestData req)
    {
        var result = await _sqlDataService.PingAsync(req.FunctionContext.CancellationToken);
        var response = req.CreateResponse(result.IsReachable ? HttpStatusCode.OK : HttpStatusCode.ServiceUnavailable);
        await response.WriteAsJsonAsync(result);
        return response;
    }
}
