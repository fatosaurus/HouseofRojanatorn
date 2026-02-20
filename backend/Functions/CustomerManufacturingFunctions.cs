using System.Net;
using System.Text.Json;
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

    private static int ParseInt(string? value, int fallback)
    {
        if (int.TryParse(value, out var parsed))
        {
            return parsed;
        }

        return fallback;
    }
}
