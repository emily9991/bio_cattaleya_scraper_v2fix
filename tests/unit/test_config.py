"""
Unit tests for configuration module.
"""

import pytest
import os
from unittest.mock import patch
from pathlib import Path

from src.bio_cattaleya.config import Settings, settings


class TestSettings:
    """Test cases for Settings class."""
    
    def test_default_settings(self):
        """Test default configuration values."""
        config = Settings()
        
        assert config.app_name == "Bio Cattaleya Scraper"
        assert config.version == "4.3.0"
        assert config.debug is False
        assert config.max_items_per_page == 30
        assert config.extraction_interval == 1.0
        assert config.request_timeout == 30
        assert config.max_retries == 3
    
    def test_environment_variables(self):
        """Test environment variable loading."""
        with patch.dict(os.environ, {
            'BSC_DEBUG': 'true',
            'MAX_ITEMS_PER_PAGE': '50',
            'NOTION_API_KEY': 'test_key',
            'LICENSE_KEY': 'test_license_key_123456789012'
        }):
            config = Settings()
            
            assert config.debug is True
            assert config.max_items_per_page == 50
            assert config.notion_api_key == 'test_key'
            assert config.license_key == 'test_license_key_123456789012'
    
    def test_invalid_log_level(self):
        """Test validation of log level."""
        with pytest.raises(ValueError, match="Log level must be one of"):
            Settings(log_level="INVALID_LEVEL")
    
    def test_short_license_key(self):
        """Test validation of license key length."""
        with pytest.raises(ValueError, match="License key must be at least 16 characters"):
            Settings(license_key="short_key")
    
    def test_is_production(self):
        """Test production mode detection."""
        debug_config = Settings(debug=True)
        assert debug_config.is_production() is False
        
        prod_config = Settings(debug=False)
        assert prod_config.is_production() is True
    
    def test_is_licensed(self):
        """Test license validation."""
        unlicensed_config = Settings(license_key=None)
        assert unlicensed_config.is_licensed() is False
        
        licensed_config = Settings(license_key="valid_license_key_123456")
        assert licensed_config.is_licensed() is True
    
    def test_get_headers(self):
        """Test default headers generation."""
        config = Settings()
        headers = config.get_headers()
        
        assert "User-Agent" in headers
        assert "Accept" in headers
        assert "Accept-Language" in headers
        assert headers["User-Agent"] == config.user_agent
    
    def test_directory_creation(self, tmp_path):
        """Test automatic directory creation."""
        data_dir = tmp_path / "test_data"
        config = Settings(data_dir=data_dir)
        
        assert data_dir.exists()
        assert data_dir.is_dir()
    
    def test_allowed_domains_default(self):
        """Test default allowed domains."""
        config = Settings()
        
        assert "tmall.com" in config.allowed_domains
        assert "taobao.com" in config.allowed_domains
        assert "amazon.com" in config.allowed_domains
        assert "ebay.com" in config.allowed_domains
    
    def test_rate_limiting_config(self):
        """Test rate limiting configuration."""
        config = Settings()
        
        assert config.rate_limit_delay == 1.0
        assert config.concurrent_requests == 5


class TestGlobalSettings:
    """Test cases for global settings instance."""
    
    def test_global_settings_instance(self):
        """Test that global settings instance is available."""
        assert isinstance(settings, Settings)
        assert settings.app_name == "Bio Cattaleya Scraper"
    
    def test_settings_singleton_behavior(self):
        """Test that settings behaves like a singleton."""
        settings1 = Settings()
        settings2 = Settings()
        
        # Both should have same default values
        assert settings1.app_name == settings2.app_name
        assert settings1.version == settings2.version
