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
