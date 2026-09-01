# backend-python

FastAPI foundation for the Layah backend migration.

## Python

- Python 3.12.10
- Package manager: `pip`
- Runtime framework: FastAPI

## Install

```powershell
python -m pip install -e backend-python[dev]
```

## Run locally

```powershell
python -m uvicorn app.main:app --app-dir backend-python --host 0.0.0.0 --port 8000
```

## Tests

```powershell
python -m pytest backend-python/tests
python -m ruff check backend-python/app backend-python/tests
```

## Endpoints

- `GET /health`
- `GET /ready`
- `GET /api/geo`
- `POST /api/lesson-plan/save` (authenticated parity pilot; not production traffic)

## Notes

- The backend is isolated in `backend-python/` so it can later become its own repository.
- This checkpoint does not cut frontend traffic over to Python.
- Geo is the first low-risk parity pilot.
- The lesson-plan save pilot validates bearer tokens through Supabase Auth and forwards the same token to PostgREST; it never uses the service-role key.
