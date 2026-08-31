from app.config import get_settings


def test_settings_parse_cors_origins(monkeypatch) -> None:
    monkeypatch.setenv(
        "BACKEND_PYTHON_CORS_ALLOWED_ORIGINS",
        '["http://localhost:3000","http://127.0.0.1:3000"]',
    )
    monkeypatch.setenv("BACKEND_PYTHON_PORT", "9001")
    get_settings.cache_clear()

    settings = get_settings()

    assert settings.port == 9001
    assert settings.cors_allowed_origins == [
        "http://localhost:3000",
        "http://127.0.0.1:3000",
    ]
