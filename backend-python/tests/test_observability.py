import logging

from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.main import create_app
from app.observability import REQUEST_ID_HEADER, request_logging_middleware


def test_generates_request_id_when_none_provided() -> None:
    client = TestClient(create_app())

    response = client.get("/health")

    assert response.status_code == 200
    request_id = response.headers.get(REQUEST_ID_HEADER)
    assert request_id
    assert len(request_id) == 32


def test_echoes_a_safe_incoming_request_id() -> None:
    client = TestClient(create_app())

    response = client.get("/health", headers={REQUEST_ID_HEADER: "caller-supplied-id-123"})

    assert response.headers.get(REQUEST_ID_HEADER) == "caller-supplied-id-123"


def test_replaces_an_unsafe_incoming_request_id() -> None:
    client = TestClient(create_app())
    unsafe = "x" * 500

    response = client.get("/health", headers={REQUEST_ID_HEADER: unsafe})

    request_id = response.headers.get(REQUEST_ID_HEADER)
    assert request_id != unsafe
    assert len(request_id) == 32


def test_logs_method_path_status_and_duration_without_sensitive_headers(caplog) -> None:
    client = TestClient(create_app())

    with caplog.at_level(logging.INFO, logger="backend_python.access"):
        response = client.get(
            "/health",
            headers={"Authorization": "Bearer secret-token", "Cookie": "session=secret"},
        )

    assert response.status_code == 200
    [record] = [r for r in caplog.records if r.name == "backend_python.access"]
    message = record.getMessage()
    assert "method=GET" in message
    assert "path=/health" in message
    assert "status=200" in message
    assert "duration_ms=" in message
    assert "secret-token" not in message
    assert "session=secret" not in message


def test_unhandled_exception_is_logged_but_response_stays_generic(caplog) -> None:
    app = FastAPI()
    app.middleware("http")(request_logging_middleware)

    @app.get("/boom")
    async def boom() -> None:
        raise RuntimeError("db password is hunter2")

    client = TestClient(app, raise_server_exceptions=False)

    with caplog.at_level(logging.INFO, logger="backend_python.access"):
        response = client.get("/boom")

    assert response.status_code == 500
    assert "hunter2" not in response.text

    [record] = [r for r in caplog.records if r.name == "backend_python.access"]
    assert record.levelname == "ERROR"
    message = record.getMessage()
    assert "method=GET" in message
    assert "path=/boom" in message
    assert "request_id=" in message
