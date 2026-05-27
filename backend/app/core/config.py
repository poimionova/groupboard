from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    DATABASE_URL: str = "postgresql+asyncpg://groupboard:groupboard_secret@db:5432/groupboard"
    SECRET_KEY: str = "super-secret-change-in-production-32chars!!"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 10080  # 7 days
    UPLOAD_DIR: str = "uploads"

    class Config:
        env_file = ".env"


settings = Settings()
