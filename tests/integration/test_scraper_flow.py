"""
Integration tests for complete scraper workflow.
"""

import pytest
import asyncio
from unittest.mock import Mock, patch, AsyncMock

from src.bio_cattaleya.scraper.main import BioCattaleyaScraper
from src.bio_cattaleya.parsers.factory import ParserFactory
from src.bio_cattaleya.config import Settings


class TestScraperWorkflow:
    """Test cases for complete scraper workflow."""
    
    @pytest.fixture
    def mock_config(self):
        """Create mock configuration."""
        config = Settings()
        config.debug = True
        config.headless = True
        config.notion_api_key = "test_key"
        config.notion_database_id = "test_db_id"
        return config
    
    @pytest.fixture
    def scraper(self, mock_config):
        """Create scraper instance."""
        with patch('src.bio_cattaleya.scraper.browser.webdriver'), \
             patch('src.bio_cattaleya.storage.notion.AsyncNotionClient'):
            scraper = BioCattaleyaScraper(mock_config)
            yield scraper
            scraper.close()
    
    def test_scraper_initialization(self, scraper):
        """Test scraper initialization."""
        assert scraper.config is not None
        assert scraper.browser_manager is not None
        assert scraper.data_extractor is not None
        assert scraper.parser_factory is not None
        assert scraper.storage is not None
    
    @pytest.mark.asyncio
    async def test_single_url_scraping(self, scraper):
        """Test scraping a single URL."""
        # Mock browser manager
        mock_data = {
            'title': 'Test Product',
            'price': '¥99.99',
            'description': 'Test description',
            'page_metadata': {
                'url': 'https://detail.tmall.com/item.htm',
                'title': 'Test Product Page'
            }
        }
        
        scraper.browser_manager.extract_data = AsyncMock(return_value=mock_data)
        
        # Test scraping
        result = await scraper.scrape_url("https://detail.tmall.com/item.htm")
        
        assert result['title'] == 'Test Product'
        assert result['platform'] == 'tmall'
        assert result['source_url'] == 'https://detail.tmall.com/item.htm'
        assert 'scraped_at' in result
    
    @pytest.mark.asyncio
    async def test_multiple_urls_scraping(self, scraper):
        """Test scraping multiple URLs."""
        urls = [
            "https://detail.tmall.com/item.htm?id=1",
            "https://item.taobao.com/item.htm?id=2",
            "https://www.amazon.com/dp/B123"
        ]
        
        # Mock browser manager
        def mock_extract_data(url, selectors):
            if "tmall.com" in url:
                return {'title': 'Tmall Product', 'page_metadata': {'url': url}}
            elif "taobao.com" in url:
                return {'title': 'Taobao Product', 'page_metadata': {'url': url}}
            elif "amazon.com" in url:
                return {'title': 'Amazon Product', 'page_metadata': {'url': url}}
        
        scraper.browser_manager.extract_data = AsyncMock(side_effect=mock_extract_data)
        
        # Test batch scraping
        results = await scraper.scrape_multiple(urls)
        
        assert len(results) == 3
        assert any('Tmall Product' in r['title'] for r in results)
        assert any('Taobao Product' in r['title'] for r in results)
        assert any('Amazon Product' in r['title'] for r in results)
    
    @pytest.mark.asyncio
    async def test_save_to_storage(self, scraper):
        """Test saving data to storage."""
        test_data = {
            'title': 'Test Product',
            'url': 'https://example.com/product',
            'platform': 'test'
        }
        
        # Mock storage
        scraper.storage.save = AsyncMock(return_value=True)
        
        # Test saving
        result = await scraper.save_to_storage(test_data)
        
        assert result is True
        scraper.storage.save.assert_called_once_with(test_data)
    
    @pytest.mark.asyncio
    async def test_full_pipeline(self, scraper):
        """Test complete scraping pipeline."""
        urls = ["https://detail.tmall.com/item.htm?id=1"]
        
        # Mock components
        mock_data = {
            'title': 'Test Product',
            'price': '¥99.99',
            'page_metadata': {'url': urls[0]}
        }
        
        scraper.browser_manager.extract_data = AsyncMock(return_value=mock_data)
        scraper.storage.save = AsyncMock(return_value=True)
        
        # Test full pipeline
        results = await scraper.run_full_pipeline(urls, save_to_storage=True)
        
        assert len(results) == 1
        assert results[0]['title'] == 'Test Product'
        scraper.storage.save.assert_called_once()
    
    @pytest.mark.asyncio
    async def test_error_handling(self, scraper):
        """Test error handling in scraping workflow."""
        # Mock browser manager to raise exception
        scraper.browser_manager.extract_data = AsyncMock(
            side_effect=Exception("Network error")
        )
        
        # Test error handling
        with pytest.raises(Exception, match="Network error"):
            await scraper.scrape_url("https://example.com/product")
    
    @pytest.mark.asyncio
    async def test_rate_limiting(self, scraper):
        """Test rate limiting in batch scraping."""
        urls = [
            "https://detail.tmall.com/item.htm?id=1",
            "https://detail.tmall.com/item.htm?id=2"
        ]
        
        # Mock with delay tracking
        call_times = []
        
        async def mock_extract_data(url, selectors):
            call_times.append(asyncio.get_event_loop().time())
            return {'title': 'Test Product', 'page_metadata': {'url': url}}
        
        scraper.browser_manager.extract_data = AsyncMock(side_effect=mock_extract_data)
        
        # Test batch scraping with rate limiting
        await scraper.scrape_multiple(urls)
        
        # Verify rate limiting (should have delays between calls)
        assert len(call_times) == 2
        time_diff = call_times[1] - call_times[0]
        assert time_diff >= scraper.config.rate_limit_delay
    
    def test_context_manager(self, mock_config):
        """Test async context manager."""
        with patch('src.bio_cattaleya.scraper.browser.webdriver'), \
             patch('src.bio_cattaleya.storage.notion.AsyncNotionClient'):
            
            async def test_context():
                async with BioCattaleyaScraper(mock_config) as scraper:
                    assert scraper is not None
                    return scraper
            
            scraper = asyncio.run(test_context())
            assert scraper is not None


class TestParserIntegration:
    """Test cases for parser integration."""
    
    def setup_method(self):
        """Setup test fixtures."""
        self.factory = ParserFactory()
    
    def test_parser_selection_integration(self):
        """Test parser selection across multiple URLs."""
        urls = [
            "https://detail.tmall.com/item.htm?id=1",
            "https://item.taobao.com/item.htm?id=2", 
            "https://www.amazon.com/dp/B123",
            "https://www.amazon.co.uk/dp/B456"
        ]
        
        expected_parsers = ["tmall", "taobao", "amazon", "amazon"]
        
        for url, expected in zip(urls, expected_parsers):
            parser = self.factory.get_parser(url)
            assert parser.get_platform_name() == expected
    
    def test_cross_platform_data_structure(self):
        """Test consistent data structure across platforms."""
        urls = [
            "https://detail.tmall.com/item.htm",
            "https://item.taobao.com/item.htm",
            "https://www.amazon.com/dp/B123"
        ]
        
        # Create parsers
        parsers = [self.factory.get_parser(url) for url in urls]
        
        # Get sample data from each parser
        sample_data_list = [parser.get_sample_data() for parser in parsers]
        
        # Verify consistent structure
        required_fields = ['title', 'url', 'platform', 'parser_version', 'parser_type']
        
        for sample_data in sample_data_list:
            for field in required_fields:
                assert field in sample_data, f"Missing field {field} in sample data"
    
    def test_parser_factory_info_integration(self):
        """Test parser factory information integration."""
        all_info = self.factory.get_all_parsers_info()
        
        assert len(all_info) >= 3  # At least tmall, taobao, amazon
        
        for parser_name, info in all_info.items():
            assert 'name' in info
            assert 'platform' in info
            assert 'supported_domains' in info
            assert 'selectors' in info
            assert 'sample_data' in info
            
            # Verify info consistency
            assert info['name'] == parser_name
            assert isinstance(info['supported_domains'], list)
            assert isinstance(info['selectors'], dict)
            assert isinstance(info['sample_data'], dict)
