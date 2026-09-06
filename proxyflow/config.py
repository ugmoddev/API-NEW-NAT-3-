from dataclasses import dataclass
import os
from dotenv import load_dotenv
load_dotenv()

@dataclass(frozen=True)
class Settings:
    database_path: str = os.getenv("DATABASE_PATH", "proxyflow.db")
    test_url: str = os.getenv("TEST_URL", "https://example.com")
    proxyscrape_base_url: str = os.getenv("PROXYSCRAPE_BASE_URL", "")
    max_concurrent: int = int(os.getenv("MAX_CONCURRENT", "3"))
    navigation_timeout: int = int(os.getenv("NAVIGATION_TIMEOUT", "30000"))
    proxy_timeout: float = float(os.getenv("PROXY_TIMEOUT", "10"))
    headless: bool = os.getenv("HEADLESS", "true").lower() == "true"
    allow_reuse: bool = os.getenv("ALLOW_REUSE", "false").lower() == "true"
    log_level: str = os.getenv("LOG_LEVEL", "INFO")
