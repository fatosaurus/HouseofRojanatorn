# House of Rojanatorn

Gem inventory and usage operations app for House of Rojanatorn.

## Included

- `backend/`: .NET 8 Azure Functions (JWT auth, Cosmos user repository, SQL-backed inventory APIs)
- `frontend/`: React + Vite app with inventory + usage dashboard modules
- `website/`: standalone React + Vite marketing website deployed to Azure Static Web Apps
- `migrations/`: SQL schema migrations including workbook-derived inventory tables
- `tools/db/`: SQL runners and workbook import tooling
- `tools/cosmos/`: Cosmos provisioning and user seeding CLI
- `.github/workflows/`: CI + backend deploy workflow + website deploy workflow

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

4. Run marketing website:

```bash
npm --prefix website install
npm --prefix website run dev
```

## Import Workbook Data

1. Apply migrations:

```bash
dotnet run --project tools/db/SqlRunner -- --file migrations/001_init.sql
dotnet run --project tools/db/SqlRunner -- --file migrations/002_gem_inventory_schema.sql
```

2. Import workbook to Azure SQL:

```bash
python3 tools/db/import_stock_workbook.py \
  --excel-path "/Users/suzieleedhirakul/Downloads/ROJANATORN GEMS STOCK 2026.xlsx"
```

3. Mapping reference:

- `docs/stock-workbook-field-mapping.md`

## Required GitHub Secrets

- `AZURE_FUNCTIONAPP_PUBLISH_PROFILE`
- `AZURE_STATIC_WEB_APPS_API_TOKEN_PURPLE_DUNE_053243600` (preferred)
- `AZURE_STATIC_WEB_APPS_API_TOKEN` (legacy fallback)

## Required GitHub Variables

- `AZURE_FUNCTIONAPP_NAME` (optional override for backend deploy workflow)

## Azure Function App Configuration

Set these Application Settings in the Function App:

- `CosmosConnection`
- `CosmosDatabaseName=houseofrojanatorn`
- `SqlConnection`
- `Jwt__Issuer=houseofrojanatorn`
- `Jwt__Audience=houseofrojanatorn-clients`
- `Jwt__SigningKey=<32+ byte secret>`
- `Cors__AllowedOrigins=https://purple-dune-053243600.4.azurestaticapps.net`

Set Function App CORS allowed origins to:

- `https://purple-dune-053243600.4.azurestaticapps.net`
- `http://localhost:5173` (optional for local frontend dev)
