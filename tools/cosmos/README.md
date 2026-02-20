# Cosmos Tools

Simple CLI to provision Cosmos DB resources.

## Environment Variable

- `COSMOS_CONNECTION_STRING`

## Ensure default containers

```bash
dotnet run --project tools/cosmos -- ensure-defaults --database houseofrojanatorn
```

## Seed a user

```bash
dotnet run --project tools/cosmos -- seed-user --database houseofrojanatorn --email user@example.com --password Password123!
```
