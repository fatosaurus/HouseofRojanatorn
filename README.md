# House of Rojanatorn

Generic full-stack Azure scaffold.

## Included

- `backend/`: .NET 8 Azure Functions (JWT auth, Cosmos user repository, SQL connectivity service)
- `frontend/`: React + Vite login scaffold with protected route
- `migrations/`: baseline SQL migration
- `tools/db/`: SQL runners (Python + .NET)
- `tools/cosmos/`: Cosmos provisioning and user seeding CLI
- `.github/workflows/`: CI + backend/frontend deploy workflows

## Quick Start

1. Configure backend settings from `backend/local.settings.json.template`.
2. Run backend:

```bash
cd backend
func start
```

3. Run frontend:

```bash
npm --prefix frontend ci
npm --prefix frontend run dev
```

## Required GitHub Secrets

- `AZURE_FUNCTIONAPP_PUBLISH_PROFILE`
- `AZURE_STATIC_WEB_APPS_API_TOKEN`

## Required GitHub Variables

- `AZURE_FUNCTIONAPP_NAME` (optional override for backend deploy workflow)

## Azure Function App Configuration

Set these Application Settings in the Function App:

- `CosmosConnection`
- `CosmosDatabaseName=houseofrojanatorn`
- `SqlConnection`
- `Jwt:Issuer=houseofrojanatorn`
- `Jwt:Audience=houseofrojanatorn-clients`
- `Jwt:SigningKey=<32+ byte secret>`
- `Cors:AllowedOrigins=https://agreeable-meadow-05ce23e00.6.azurestaticapps.net`

Set Function App CORS allowed origins to:

- `https://agreeable-meadow-05ce23e00.6.azurestaticapps.net`
- `http://localhost:5173` (optional for local frontend dev)
