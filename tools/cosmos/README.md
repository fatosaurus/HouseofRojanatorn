# Cosmos Tools

Simple CLI to provision Cosmos DB resources.

## Environment Variable

- `COSMOS_CONNECTION_STRING`

## Ensure default containers

```bash
dotnet run --project tools/cosmos -- ensure-defaults --database houseofrojanatorn
```

If only .NET 10 runtime is installed locally, add `-f net10.0` to `dotnet run`.

## Seed a user

```bash
dotnet run --project tools/cosmos -- seed-user --database houseofrojanatorn --email user@example.com --password Password123!
```

## List users

```bash
dotnet run --project tools/cosmos -- list-users --database houseofrojanatorn
```

## Prune users (keep allow-list)

```bash
dotnet run --project tools/cosmos -- prune-users --database houseofrojanatorn --keep-emails admin@houseofrojanatorn.local
```
