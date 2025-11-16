from functools import lru_cache
from typing import Optional

from pydantic import Field
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    app_name: str = Field(default="Voice Agent Platform API")
    supabase_url: str = Field(default="")
    supabase_key: str = Field(default="")
    livekit_url: str = Field(default="")
    livekit_api_key: str = Field(default="")
    livekit_api_secret: str = Field(default="")
    assemblyai_api_key: str = Field(default="")
    deepgram_api_key: str = Field(default="")
    cartesia_api_key: str = Field(default="")
    openai_api_key: str = Field(default="")
    next_public_livekit_url: str = Field(default="")
    frontend_base_url: str = Field(default="http://localhost:5173")
    frontend_allowed_origins: list[str] = Field(default_factory=list)
    frontend_redirect_path_prefixes: list[str] = Field(default_factory=list)
    airtable_client_id: str = Field(default="")
    airtable_client_secret: str = Field(default="")
    airtable_redirect_uri: str = Field(default="")
    gmail_client_id: str = Field(default="")
    gmail_client_secret: str = Field(default="")
    gmail_redirect_uri: str = Field(default="")
    oauth_state_secret: str = Field(default="")
    oauth_state_ttl_seconds: int = Field(default=300)
    spitch_api_key: str |None=None
    eleven_api_key: str |None=None

    class Config:
        env_file = ".env.local"
        env_file_encoding = "utf-8"


@lru_cache()
def get_settings() -> Settings:
    return Settings()  # type: ignore[arg-type]

