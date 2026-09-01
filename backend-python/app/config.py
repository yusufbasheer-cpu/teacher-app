from functools import lru_cache

from pydantic import AliasChoices, Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_prefix="BACKEND_PYTHON_", extra="ignore")

    app_name: str = "Layah Python Backend"
    environment: str = "development"
    host: str = "0.0.0.0"
    port: int = 8000
    log_level: str = "INFO"
    cors_allowed_origins: list[str] = Field(default_factory=list)

    geo_default_country_code: str = "AE"
    geo_default_country_name: str = "UAE"
    geo_provider_timeout_seconds: float = 4.0
    geo_user_agent: str = "LayahPricing/1.0"

    supabase_url: str = Field(
        default="", validation_alias=AliasChoices("NEXT_PUBLIC_SUPABASE_URL", "supabase_url")
    )
    supabase_anon_key: str = Field(
        default="",
        validation_alias=AliasChoices("NEXT_PUBLIC_SUPABASE_ANON_KEY", "supabase_anon_key"),
    )

    turnstile_secret_key: str = Field(
        default="", validation_alias=AliasChoices("TURNSTILE_SECRET_KEY", "turnstile_secret_key")
    )
    turnstile_timeout_seconds: float = 5.0


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    return Settings()
