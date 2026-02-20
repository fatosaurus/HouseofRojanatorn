# Azure SQL Tooling

Two options:
- Python runner (`run_sql.py`) uses `pyodbc`.
- .NET runner (`SqlRunner`) uses `Microsoft.Data.SqlClient`.

## Environment Variables

- `AZURE_SQL_SERVER`
- `AZURE_SQL_DB`
- `AZURE_SQL_USER`
- `AZURE_SQL_PASSWORD`
- `AZURE_SQL_ODBC_DRIVER` (default: `ODBC Driver 18 for SQL Server`)

## Usage

```bash
python3 tools/db/run_sql.py --file migrations/001_init.sql
python3 tools/db/run_sql.py --query "SELECT TOP 5 * FROM dbo.app_settings"
```

```bash
dotnet run --project tools/db/SqlRunner -- --file migrations/001_init.sql
dotnet run --project tools/db/SqlRunner -- --query "SELECT TOP 5 * FROM dbo.app_settings"
```

## Import Workbook Data

`import_stock_workbook.py` parses the `ROJANATORN GEMS STOCK 2026.xlsx` workbook and writes data into:

- `dbo.gem_inventory_items`
- `dbo.gem_usage_batches`
- `dbo.gem_usage_lines`

Install Python dependencies:

```bash
python3 -m pip install --user openpyxl
```

Run migration first:

```bash
dotnet run --project tools/db/SqlRunner -- --file migrations/002_gem_inventory_schema.sql
```

Run import:

```bash
python3 tools/db/import_stock_workbook.py \
  --excel-path "/Users/suzieleedhirakul/Downloads/ROJANATORN GEMS STOCK 2026.xlsx"
```

Dry run (parse only):

```bash
python3 tools/db/import_stock_workbook.py --dry-run
```
