# API

AXIOM AI exposes a JSON REST API under `/api/v1`. The **public read API** needs no authentication. Account and admin endpoints use the session cookie. An HTML reference generated from the same schemas is served at `/api/docs`, and the OpenAPI 3.1 document at `/api/docs/openapi.json`.

Examples use PowerShell; replace the host with yours.

```powershell
Invoke-RestMethod "http://localhost:3000/api/v1/models?provider=anthropic&pageSize=5"
Invoke-RestMethod "http://localhost:3000/api/v1/compare?models=model-a,model-b"
```

## Conventions

- **Envelope.** Success: `{ "data": ... }` (lists add `meta` with `page`, `pageSize`, `total`). Error: `{ "error": { "code", "message", "details?" } }`. Unexpected failures return `500 INTERNAL_ERROR` with a generic message; details go to the server log only.
- **Validation.** Query strings and bodies are validated strictly: unknown parameters or fields are rejected with `400` (`INVALID_QUERY`, `INVALID_PARAMS`, `INVALID_BODY`; `413` and `415` for oversized or non-JSON bodies), so a typo never silently returns unfiltered data.
- **Caching.** Public reads send `ETag` and `Cache-Control: public, s-maxage=…, stale-while-revalidate=…`; send `If-None-Match` to get `304`. `X-Cache: HIT | MISS | BYPASS` reports the Redis read-through cache. Account, auth and admin responses are `no-store`.
- **Rate limits.** The public API allows **240 requests per minute per client address** (`API_RATE_LIMIT_PER_MINUTE`, `0` disables). Responses carry `RateLimit-Limit`, `RateLimit-Remaining` and `RateLimit-Reset` (seconds); over the limit you get `429 RATE_LIMITED` with `Retry-After`. Sign-in, sign-up, password changes and the admin API have their own, stricter limits (see `docs/SECURITY.md`).
- **Data semantics.** Absent facts are `null` and mean "not publicly disclosed". Every sourced record includes `sourceUrl`, `verificationStatus` (`OFFICIALLY_VERIFIED`, `INDEPENDENTLY_EVALUATED`, `PROVIDER_REPORTED`, `COMMUNITY_REPORTED`, `UNVERIFIED`, `NOT_PUBLICLY_DISCLOSED`), `verifiedAt` and `isDemo`. There is no overall score and no ranking anywhere in the API.
- **Security headers.** API responses carry `Content-Security-Policy: default-src 'none'`, `X-Content-Type-Options: nosniff` and (over HTTPS) HSTS.

## Public read API

Generated from the endpoint registry; do not edit by hand (`npm run docs:api`).

<!-- BEGIN GENERATED: public read API (npm run docs:api) -->

### Meta

#### `GET /api/v1/stats`

Platform statistics.

Counts shown on the homepage. `isDemo` is true while the database holds placeholder rows.

Responses: `200` OK; `304` Not modified (If-None-Match matched); `500` Unexpected error (safe message, details are only in server logs).

#### `GET /api/v1/health`

Service health.

200 when PostgreSQL and Redis respond, 503 otherwise. Never cached.

Responses: `200` OK; `304` Not modified (If-None-Match matched); `500` Unexpected error (safe message, details are only in server logs); `503` A dependency is unavailable.

### Models

#### `GET /api/v1/models`

List and filter models.

Server-side search, filtering, sorting and pagination. Filters combine with AND across groups and OR within a group. `sort=benchmark` sorts by ONE benchmark (required `benchmark` parameter); there is no overall ranking.

| Parameter    | In    | Type   | Required | Description |
| ------------ | ----- | ------ | -------- | ----------- |
| `q`          | query | string | no       |             |
| `provider`   | query | string | no       |             |
| `category`   | query | string | no       |             |
| `capability` | query | string | no       |             |
| `deployment` | query | string | no       |             |
| `pricing`    | query | string | no       |             |
| `sort`       | query | recent | updated  | alpha       | provider | context | benchmark | no  |     |
| `benchmark`  | query | string | no       |             |
| `page`       | query | string | no       |             |
| `pageSize`   | query | string | no       |             |

Responses: `200` OK; `304` Not modified (If-None-Match matched); `400` Invalid query or path parameters; `500` Unexpected error (safe message, details are only in server logs).

#### `GET /api/v1/models/suggest`

Search-box suggestions.

| Parameter | In    | Type   | Required | Description |
| --------- | ----- | ------ | -------- | ----------- |
| `q`       | query | string | yes      |             |
| `limit`   | query | string | no       |             |

Responses: `200` OK; `304` Not modified (If-None-Match matched); `400` Invalid query or path parameters; `500` Unexpected error (safe message, details are only in server logs).

#### `GET /api/v1/models/{slug}`

Model profile.

| Parameter | In   | Type   | Required | Description |
| --------- | ---- | ------ | -------- | ----------- |
| `slug`    | path | string | yes      |             |

Responses: `200` OK; `304` Not modified (If-None-Match matched); `400` Invalid query or path parameters; `404` Not found; `500` Unexpected error (safe message, details are only in server logs).

#### `GET /api/v1/models/{slug}/benchmarks`

Benchmark results for a model.

Every result keeps its own benchmark, version, date, methodology, source and evaluation type. Nothing is averaged.

| Parameter | In   | Type   | Required | Description |
| --------- | ---- | ------ | -------- | ----------- |
| `slug`    | path | string | yes      |             |

Responses: `200` OK; `304` Not modified (If-None-Match matched); `400` Invalid query or path parameters; `404` Not found; `500` Unexpected error (safe message, details are only in server logs).

#### `GET /api/v1/models/{slug}/pricing`

Pricing for a model (current and historical).

`price: null` means not publicly disclosed. Historical prices have `isCurrent: false`.

| Parameter | In   | Type   | Required | Description |
| --------- | ---- | ------ | -------- | ----------- |
| `slug`    | path | string | yes      |             |

Responses: `200` OK; `304` Not modified (If-None-Match matched); `400` Invalid query or path parameters; `404` Not found; `500` Unexpected error (safe message, details are only in server logs).

#### `GET /api/v1/models/{slug}/releases`

Release history for a model.

| Parameter | In   | Type   | Required | Description |
| --------- | ---- | ------ | -------- | ----------- |
| `slug`    | path | string | yes      |             |

Responses: `200` OK; `304` Not modified (If-None-Match matched); `400` Invalid query or path parameters; `404` Not found; `500` Unexpected error (safe message, details are only in server logs).

#### `GET /api/v1/models/{slug}/related`

Related models.

Same provider and/or overlapping categories and capabilities.

| Parameter | In    | Type   | Required | Description |
| --------- | ----- | ------ | -------- | ----------- |
| `slug`    | path  | string | yes      |             |
| `limit`   | query | string | no       |             |

Responses: `200` OK; `304` Not modified (If-None-Match matched); `400` Invalid query or path parameters; `404` Not found; `500` Unexpected error (safe message, details are only in server logs).

### Providers

#### `GET /api/v1/providers`

List providers.

| Parameter  | In    | Type   | Required | Description |
| ---------- | ----- | ------ | -------- | ----------- |
| `q`        | query | string | no       |             |
| `page`     | query | string | no       |             |
| `pageSize` | query | string | no       |             |

Responses: `200` OK; `304` Not modified (If-None-Match matched); `400` Invalid query or path parameters; `500` Unexpected error (safe message, details are only in server logs).

#### `GET /api/v1/providers/{slug}`

Provider profile.

Includes the provider's models, latest releases and publications.

| Parameter | In   | Type   | Required | Description |
| --------- | ---- | ------ | -------- | ----------- |
| `slug`    | path | string | yes      |             |

Responses: `200` OK; `304` Not modified (If-None-Match matched); `400` Invalid query or path parameters; `404` Not found; `500` Unexpected error (safe message, details are only in server logs).

### Benchmarks

#### `GET /api/v1/benchmarks`

List benchmarks.

Responses: `200` OK; `304` Not modified (If-None-Match matched); `500` Unexpected error (safe message, details are only in server logs).

#### `GET /api/v1/benchmarks/results`

Benchmark results across models.

Filter by benchmark, provider, model family, model version and evaluation date range. Results are never merged into a single score; each row states its own methodology, evaluation type and source.

| Parameter   | In    | Type   | Required | Description |
| ----------- | ----- | ------ | -------- | ----------- |
| `benchmark` | query | string | no       |             |
| `provider`  | query | string | no       |             |
| `family`    | query | string | no       |             |
| `version`   | query | string | no       |             |
| `from`      | query | string | no       |             |
| `to`        | query | string | no       |             |
| `page`      | query | string | no       |             |
| `pageSize`  | query | string | no       |             |

Responses: `200` OK; `304` Not modified (If-None-Match matched); `400` Invalid query or path parameters; `500` Unexpected error (safe message, details are only in server logs).

### Releases

#### `GET /api/v1/releases`

Release timeline.

`category` is the release kind (major, minor, deprecation, capability, api-change, pricing-change, docs-update). Only officially verified or independently evaluated releases have `confirmed: true`.

| Parameter  | In    | Type   | Required | Description |
| ---------- | ----- | ------ | -------- | ----------- |
| `q`        | query | string | no       |             |
| `provider` | query | string | no       |             |
| `category` | query | major  | minor    | capability  | deprecation | api-change | pricing-change | docs-update | no  |     |
| `from`     | query | string | no       |             |
| `to`       | query | string | no       |             |
| `page`     | query | string | no       |             |
| `pageSize` | query | string | no       |             |

Responses: `200` OK; `304` Not modified (If-None-Match matched); `400` Invalid query or path parameters; `500` Unexpected error (safe message, details are only in server logs).

### News

#### `GET /api/v1/news`

News.

Official announcements and AI-generated summaries are flagged (`isOfficial`, `isAiSummary`). `official=true` keeps official sources only, `official=false` independent reporting only.

| Parameter  | In    | Type           | Required | Description |
| ---------- | ----- | -------------- | -------- | ----------- |
| `q`        | query | string         | no       |             |
| `category` | query | model-releases | research | companies   | infrastructure | hardware | safety | regulation | no  |     |
| `provider` | query | string         | no       |             |
| `official` | query | true           | false    | no          |                |
| `page`     | query | string         | no       |             |
| `pageSize` | query | string         | no       |             |

Responses: `200` OK; `304` Not modified (If-None-Match matched); `400` Invalid query or path parameters; `500` Unexpected error (safe message, details are only in server logs).

#### `GET /api/v1/research`

Research publications.

Papers and technical reports on record, newest first. `q` matches the title and venue.

| Parameter  | In    | Type   | Required | Description |
| ---------- | ----- | ------ | -------- | ----------- |
| `q`        | query | string | no       |             |
| `provider` | query | string | no       |             |
| `page`     | query | string | no       |             |
| `pageSize` | query | string | no       |             |

Responses: `200` OK; `304` Not modified (If-None-Match matched); `400` Invalid query or path parameters; `500` Unexpected error (safe message, details are only in server logs).

### Search

#### `GET /api/v1/search`

Global search.

Searches models, providers, benchmarks, releases, news and research. `types` is a comma-separated subset.

| Parameter | In    | Type   | Required | Description |
| --------- | ----- | ------ | -------- | ----------- |
| `q`       | query | string | yes      |             |
| `types`   | query | string | no       |             |
| `limit`   | query | string | no       |             |

Responses: `200` OK; `304` Not modified (If-None-Match matched); `400` Invalid query or path parameters; `500` Unexpected error (safe message, details are only in server logs).

### Compare

#### `GET /api/v1/compare`

Compare up to four models.

Returns full profiles in the requested order. 404 lists any unknown slugs.

| Parameter | In    | Type   | Required | Description |
| --------- | ----- | ------ | -------- | ----------- |
| `models`  | query | string | yes      |             |

Responses: `200` OK; `304` Not modified (If-None-Match matched); `400` Invalid query or path parameters; `404` Not found; `500` Unexpected error (safe message, details are only in server logs).

#### `GET /api/v1/compare/export.csv`

Comparison as CSV.

One column per model. Each benchmark is a separate row with its evaluation type and date. Cells are protected against spreadsheet formula injection.

| Parameter | In    | Type   | Required | Description |
| --------- | ----- | ------ | -------- | ----------- |
| `models`  | query | string | yes      |             |

Responses: `200` OK; `304` Not modified (If-None-Match matched); `400` Invalid query or path parameters; `404` Not found; `500` Unexpected error (safe message, details are only in server logs).

<!-- END GENERATED -->

## Authentication

Sessions are random tokens in an HttpOnly, SameSite=Lax cookie (`__Host-axiom_session` over HTTPS). All state-changing requests must come from the site's own origin (`Origin` / `Sec-Fetch-Site` are checked); a request without either header is accepted only when it carries no cookie.

| Endpoint              | Purpose                                                                                                                                                |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `POST /auth/sign-up`  | `{ email, password, name?, next? }`. Creates a USER, signs in, returns `{ user, next }`. `409 EMAIL_TAKEN`, `400 WEAK_PASSWORD`, `429` when throttled. |
| `POST /auth/sign-in`  | `{ email, password, next? }`. One uniform `401 INVALID_CREDENTIALS` for every kind of failure. `429` when throttled.                                   |
| `POST /auth/sign-out` | Revokes the session server-side and clears the cookie.                                                                                                 |
| `GET /auth/session`   | `200` with `{ user, preferences, savedModels }`, or `user: null` when signed out. Re-issues the cookie when the session slides.                        |
| `GET /auth/me`        | The signed-in user, or `401`.                                                                                                                          |

## Account (`/me/*`, signed in)

Every handler only touches rows owned by the caller. `401` without a session; writes are same-origin only and limited to 120 per minute.

| Endpoint                          | Purpose                                                                                                                                                                                            |
| --------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `GET`, `PUT /me/preferences`      | `{ theme: "system" \| "dark" \| "light" \| null, preferredProviders: slug[] (≤ 20, must exist), personalized: boolean, motion: "system" \| "full" \| "reduced" \| null (optional, default null) }` |
| `GET`, `POST /me/saved-models`    | List, or save `{ slug }`                                                                                                                                                                           |
| `DELETE /me/saved-models/:slug`   | Remove a saved model                                                                                                                                                                               |
| `GET`, `POST /me/comparisons`     | List, or save `{ name, models: slug[] (2 to 4) }`                                                                                                                                                  |
| `DELETE /me/comparisons/:id`      | Remove a saved comparison                                                                                                                                                                          |
| `GET`, `POST /me/recently-viewed` | List, or record `{ slug }`                                                                                                                                                                         |
| `PUT /me/password`                | `{ currentPassword, newPassword }`; revokes every other session. 5 attempts per window.                                                                                                            |
| `DELETE /me`                      | `{ password }`; deletes the account and everything saved with it, scrubs personal data from the audit log.                                                                                         |

## Admin (`/admin/*`, role ADMIN)

Every route goes through one guard: session, then role (read from the database on every call, so a demotion applies at once), then same-origin check on writes, then a per-admin rate limit (600 reads and 120 writes per minute). Anonymous callers get `401`, signed-in non-admins `403`. Writes are validated by the same Zod schemas as the seed files and are audited with before and after values.

| Endpoint                                                                                                         | Purpose                                                                                                                                               |
| ---------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| `GET`, `POST /admin/records/:entity`                                                                             | List or create records (`providers`, `models`, `benchmarks`, `benchmark-results`, `pricing`, `releases`, `news`, `publications`)                      |
| `GET`, `PUT`, `DELETE /admin/records/:entity/:id`                                                                | Read, update, delete one record                                                                                                                       |
| `GET /admin/audit`                                                                                               | Audit log with filters                                                                                                                                |
| `GET /admin/users`, `PUT /admin/users/:id/role`, `DELETE /admin/users/:id`, `DELETE /admin/users/:id/sessions`   | Users: list, change role, delete, sign out everywhere                                                                                                 |
| `GET`, `POST /admin/sync/sources`; `GET`, `PUT`, `DELETE /admin/sync/sources/:id`; `PUT …/enabled`; `POST …/run` | Data-sync sources and "run now"                                                                                                                       |
| `GET /admin/sync/runs`, `GET /admin/sync/runs/:id`                                                               | Sync runs and their validation issues                                                                                                                 |
| `GET /admin/sync/imports`, `GET /admin/sync/imports/:id`, `POST …/approve`, `POST …/reject`                      | Staged imports. Approve is refused (`409 TRUST_GUARD`) if it would lower the trust of stored data, unless `override: true` is sent, which is audited. |

## Health

`GET /health` returns `200 { status: "ok", checks: { postgres, redis } }` when both respond and `503` otherwise. It is never cached and not rate limited; use it for container and load-balancer checks.
