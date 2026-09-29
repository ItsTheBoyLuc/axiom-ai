# AXIOM AI

The Intelligence Standard. A directory, benchmark explorer and comparison tool for AI models.

## Quick start (PowerShell)

```powershell
Copy-Item .env.example .env      # then set POSTGRES_PASSWORD (and update DATABASE_URL to match)
npm install
docker compose up -d --build
docker compose ps                # web, worker, postgres, redis should be healthy
Invoke-RestMethod http://localhost:3000/api/v1/health
```

Local development against the compose databases:

```powershell
docker compose up -d postgres redis
npm run dev
```

See `CLAUDE.md` for project rules and `docs/DECISIONS.md` for decisions.
