# FastAPI Pilot Contract

Date: 2026-08-31

## Pilot 1

`GET /api/geo`

## Next Contract

Route handler:

```text
GET /api/geo
    -> src/app/api/geo/route.ts
    -> src/lib/geo-service.ts
```

Current observable response:

```json
{ "country_code": "AE", "country_name": "UAE" }
```

with overrides from `x-vercel-ip-country`, `ipapi.co`, or `api.country.is` when available.

## Python Contract

```text
GET /api/geo
    -> FastAPI route
    -> Python geo service
    -> ipapi.co / api.country.is
```

The Python pilot must preserve:

- method: `GET`
- path: `/api/geo`
- response keys: `country_code`, `country_name`
- provider ordering:
  1. `x-vercel-ip-country`
  2. `ipapi.co`
  3. `api.country.is`
  4. UAE fallback
- timeout behavior: 4 seconds per provider call
- fallback behavior: UAE on total failure
- no auth, no quota, no persistence

## Shared Fixture

The parity test uses:

`contract-fixtures/geo/geo-contract.json`

## Future Cutover Rule

Do not route production traffic to Python yet. The Next implementation remains the rollback reference.
