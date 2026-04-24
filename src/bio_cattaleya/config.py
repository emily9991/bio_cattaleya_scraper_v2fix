"""
Configuration management for Bio Cattaleya Scraper.

Centralized configuration with environment variable support
and validation using Pydantic.
"""

import os
from pathlib import Path
from typing import Optional, List
from pydantic import BaseSettings, Field, validator


class Settings(BaseSettings):
    """Main configuration class for the scraper."""
    
    # Application settings
    app_name: str = "Bio Cattaleya Scraper"
    version: str = "4.3.0"
    debug: bool = Field(default=False, env="BSC_DEBUG")
    
    # Scraping settings
    max_items_per_page: int = Field(default=30, env="MAX_ITEMS_PER_PAGE")
    extraction_interval: float = Field(default=1.0, env="EXTRACTION_INTERVAL")
    request_timeout: int = Field(default=30, env="REQUEST_TIMEOUT")
    max_retries: int = Field(default=3, env="MAX_RETRIES")
    
    # Browser settings
    headless: bool = Field(default=True, env="HEADLESS_BROWSER")
    browser_timeout: int = Field(default=30, env="BROWSER_TIMEOUT")
    user_agent: str = Field(
        default="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        env="USER_AGENT"
    )
    
    # API settings
    notion_api_key: Optional[str] = Field(default=None, env="NOTION_API_KEY")
    notion_database_id: Optional[str] = Field(default=None, env="NOTION_DATABASE_ID")
    
    # License settings
    license_key: Optional[str] = Field(default=None, env="LICENSE_KEY")
    license_server: str = Field(
        default="https://api.biocattaleya.com/license",
        env="LICENSE_SERVER"
    )
    
    # Storage settings
    data_dir: Path = Field(default=Path("data"), env="DATA_DIR")
    raw_data_dir: Path = Field(default=Path("data/raw"), env="RAW_DATA_DIR")
    processed_data_dir: Path = Field(default=Path("data/processed"), env="PROCESSED_DATA_DIR")
    
    # Logging settings
    log_level: str = Field(default="INFO", env="LOG_LEVEL")
    log_file: Optional[Path] = Field(default=None, env="LOG_FILE")
    log_format: str = Field(
        default="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
        env="LOG_FORMAT"
    )
    
    # Security settings
    allowed_domains: List[str] = Field(
        default=[
            "tmall.com",
            "taobao.com", 
            "1688.com",
            "amazon.com",
            "ebay.com"
        ],
        env="ALLOWED_DOMAINS"
    )
    
    # Rate limiting
    rate_limit_delay: float = Field(default=1.0, env="RATE_LIMIT_DELAY")
    concurrent_requests: int = Field(default=5, env="CONCURRENT_REQUESTS")
    
    @validator("data_dir", "raw_data_dir", "processed_data_dir")
    def create_directories(cls, v):
        """Create directories if they don't exist."""
        v.mkdir(parents=True, exist_ok=True)
        return v
    
    @validator("log_level")
    def validate_log_level(cls, v):
        """Validate log level."""
        valid_levels = ["DEBUG", "INFO", "WARNING", "ERROR", "CRITICAL"]
        if v.upper() not in valid_levels:
            raise ValueError(f"Log level must be one of: {valid_levels}")
        return v.upper()
    
    @validator("license_key")
    def validate_license(cls, v):
        """Validate license key format."""
        if v and len(v) < 16:
            raise ValueError("License key must be at least 16 characters")
        return v
    
    class Config:
        """Pydantic configuration."""
        env_file = ".env"
        env_file_encoding = "utf-8"
        case_sensitive = False
        
    def is_production(self) -> bool:
        """Check if running in production mode."""
        return not self.debug
    
    def is_licensed(self) -> bool:
        """Check if license is properly configured."""
        return bool(self.license_key)
    
    def get_headers(self) -> dict:
        """Get default request headers."""
        return {
            "User-Agent": self.user_agent,
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
            "Accept-Language": "en-US,en;q=0.5",
            "Accept-Encoding": "gzip, deflate",
            "Connection": "keep-alive",
            "Upgrade-Insecure-Requests": "1",
        }


# Global settings instance
settings = Settings()
