# FastAPI Foundation

Date: 2026-08-31

## Purpose

Create a small, isolated Python backend foundation alongside the existing Next.js backend.

## Current Python Baseline

- Python: 3.12.10
- Framework: FastAPI
- Validation/config: Pydantic + `pydantic-settings`
- HTTP client: `httpx`
- Testing: `pytest`
- Linting: `ruff`

## Directory Shape

```text
backend-python/
    pyproject.toml
    README.md
    app/
        main.py
        config.py
        api/routes/health.py
        api/routes/geo.py
        services/geo.py
    tests/
        test_health.py
        test_geo.py
```

## Runtime Contract

- `GET /health` returns `{"status":"ok"}`
- `GET /ready` returns a readiness object for the Python app
- `GET /api/geo` is the first parity pilot endpoint

## Configuration

- `BACKEND_PYTHON_HOST`
- `BACKEND_PYTHON_PORT`
- `BACKEND_PYTHON_LOG_LEVEL`
- `BACKEND_PYTHON_CORS_ALLOWED_ORIGINS`
- `BACKEND_PYTHON_GEO_DEFAULT_COUNTRY_CODE`
- `BACKEND_PYTHON_GEO_DEFAULT_COUNTRY_NAME`
- `BACKEND_PYTHON_GEO_PROVIDER_TIMEOUT_SECONDS`
- `BACKEND_PYTHON_GEO_USER_AGENT`

## CORS

- CORS is only enabled when explicit allowed origins are configured.
- Credentials are disabled.
- This checkpoint does not cut frontend traffic over to Python.

## Logging

- Use Python standard logging.
- Do not log tokens, cookies, or provider secrets.

## Error Strategy

- Keep endpoint-level behavior aligned to the observed Next contract.
- Use small, explicit response shapes for health and geo.
