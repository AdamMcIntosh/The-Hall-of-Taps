# Railway Migration Plan — Option 1: Postgres

## Target Architecture

```
Railway
├── Frontend Service (static HTML/JS/CSS, served by nginx)
├── Backend API Service (.NET 9 minimal API, reads from Postgres)
└── Postgres Database (managed by Railway)

Local (your machine)
└── HallofTaps.NetCore console app (scrape/formulate/export)
    └── Writes to Railway Postgres (remote connection string)
```

## Data Migration: SQL Server → Postgres (~2M records)

### Overview
Repurpose the existing `HallOfTaps.Migrate` project to read from the current SQL Server and write to Railway Postgres. Both sides use EF Core so this is a bulk copy operation.

### Steps

1. **Provision Railway Postgres**
   - Create a Postgres database in Railway
   - Grab the connection string (format: `Host=...;Port=5432;Database=halloftaps;Username=...;Password=...`)

2. **Add Npgsql provider to HallOfTaps.Migrate**
   - Add `Npgsql.EntityFrameworkCore.PostgreSQL` (9.0.x) to `HallOfTaps.Migrate.csproj`
   - Keep the existing `Microsoft.EntityFrameworkCore.SqlServer` reference (it reads from SQL Server via `HallOfTaps.Core`)

3. **Create a Postgres DbContext in the Migrate project**
   - New class `PostgresDbContext` — same schema as `HallOfTapsDbContext` but uses `UseNpgsql()`
   - Reuses the same models (`Beer`, `BeerInfo`, `Brewery`, `Skips`)

4. **Rewrite `Program.cs` for SQL Server → Postgres**
   - Source: `HallOfTapsDbContext` (SQL Server, existing connection string)
   - Target: `PostgresDbContext` (Railway Postgres)
   - Batch reads of 1,000 records from SQL Server
   - Bulk insert into Postgres
   - Progress logging per table
   - Tables to migrate: `Beers`, `BeerInfo`, `Breweries`, `Skips`

5. **Run the migration**
   - Set env vars:
     - `HallOfTaps__ConnectionString` → local SQL Server
     - `HallOfTaps__PostgresConnectionString` → Railway Postgres
   - `dotnet run --project HallOfTaps.Migrate`
   - Verify row counts match

### Estimated Data Volume
| Table     | Est. Rows  | Notes                           |
|-----------|------------|---------------------------------|
| Beers     | ~2,000,000 | Core beer records               |
| BeerInfo  | ~2,000,000 | Ratings, formulation data       |
| Breweries | ~50,000    | Brewery metadata                |
| Skips     | ~10,000    | Beer IDs to skip during scraping|

---

## Code Changes: HallOfTaps.Core → Postgres

After migration is complete, switch the core library to Postgres permanently.

### 1. Swap NuGet package in `HallOfTaps.Core.csproj`
```diff
- <PackageReference Include="Microsoft.EntityFrameworkCore.SqlServer" Version="9.0.3" />
+ <PackageReference Include="Npgsql.EntityFrameworkCore.PostgreSQL" Version="9.0.3" />
```

### 2. Update `HallOfTapsDbContext.OnConfiguring`
```diff
- optionsBuilder.UseSqlServer(_connectionString);
+ optionsBuilder.UseNpgsql(_connectionString);
```

### 3. Update `HallOfTapsDbContextFactory`
Same change — `UseNpgsql()` instead of `UseSqlServer()`.

### 4. Update default connection strings
Replace all SQL Server defaults with Postgres format:
```
Host=localhost;Port=5432;Database=halloftaps;Username=postgres;Password=...
```
Or just remove defaults and require the env var.

### 5. Reset EF migrations
Since we're switching providers, delete existing migrations and create a fresh `InitialCreate` for Postgres:
```bash
rm -rf HallOfTaps.Core/Migrations/
dotnet ef migrations add InitialCreate --project HallOfTaps.Core --startup-project HallofTaps.NetCore
```

### 6. Postgres-specific considerations
- `decimal(18,6)` → Postgres uses `numeric(18,6)` — EF Core handles this automatically
- String PKs (`id`) work the same way
- Indexes on `BID`, `BreweryID`, `Bid` carry over
- No `MultipleActiveResultSets` needed (Postgres doesn't have this concept)
- `Integrated Security` doesn't exist — use `Username`/`Password`

---

## New Project: HallOfTaps.Api

Minimal API project for Railway deployment.

### Endpoints
```
GET /api/beers?page=1&pageSize=25          → Paginated beer list (sorted by TAP desc)
GET /api/beers/{bid}                        → Single beer by BID
GET /api/beers/search?q=...                 → Search by name
GET /api/beers/styles                       → List of styles
GET /api/beers/preview                      → Top 15 beers (leaderboard)
GET /api/breweries?page=1&pageSize=25       → Paginated brewery list
GET /api/breweries/{id}                     → Single brewery
GET /api/breweries/names                    → Brewery name list (for autocomplete)
GET /health                                 → Health check
```

### Query parameters (beers)
- `style` — filter by beer style
- `brewery` — filter by brewery name
- `abvMin` / `abvMax` — ABV range
- `tapMin` / `tapMax` — TAP rating range
- `sort` — column to sort by (tap, abv, style_plus, bar)
- `order` — asc/desc

### Project setup
- Add to existing solution: `dotnet new webapi -n HallOfTaps.Api --no-openapi`
- Reference `HallOfTaps.Core` (reuse DbContext + models)
- Add `Npgsql.EntityFrameworkCore.PostgreSQL`
- Connection string via `HallOfTaps__PostgresConnectionString` env var
- CORS: allow the frontend origin
- Dockerfile for Railway deployment

---

## Frontend Changes

### 1. Update `site.js` to fetch from API instead of static JSON
Replace `fetch('/data/beers/page-0.json')` calls with `fetch('https://api.halloftaps.com/api/beers?page=0')`.

### 2. Server-side filtering (optional upgrade)
Currently all filtering happens client-side by loading `all-*.json` chunks (~50MB total). With a real API, filtering can happen server-side — much faster, less bandwidth.

### 3. Dockerfile
```dockerfile
FROM nginx:alpine
COPY . /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
```

### 4. `nginx.conf`
```nginx
server {
    listen 80;
    root /usr/share/nginx/html;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }
}
```

---

## Railway Configuration

### Services
| Service   | Source         | Port | Env Vars                            |
|-----------|---------------|------|-------------------------------------|
| frontend  | The-Hall-of-Taps repo | 80   | (none)                              |
| api       | HallofTaps.Engine repo | 8080 | `HallOfTaps__PostgresConnectionString` |
| postgres  | Railway plugin | 5432 | (auto-provisioned)                  |

### Deploy flow
1. Push to GitHub → Railway auto-deploys frontend + API
2. Scraping stays local: run console app → writes directly to Railway Postgres
3. Formulation runs locally → results stored in Postgres → API serves them immediately

---

## Migration Order of Operations

1. **Provision** Railway Postgres
2. ~~**Build** the Postgres migration tool (repurpose `HallOfTaps.Migrate`)~~ DONE
3. **Run** SQL Server → Postgres data migration (~2M records)
4. **Verify** row counts and spot-check data
5. ~~**Switch** `HallOfTaps.Core` from SQL Server to Npgsql~~ DONE
6. **Verify** local console app works against Postgres (scrape, formulate, export)
7. ~~**Build** `HallOfTaps.Api` minimal API project~~ DONE
8. ~~**Build** Dockerfiles for frontend + API~~ DONE
9. **Deploy** to Railway
10. **Update** frontend to call API instead of static JSON
11. **Test** end-to-end: local scrape → Postgres → API → frontend
12. **Retire** SQL Server + GitHub Pages
