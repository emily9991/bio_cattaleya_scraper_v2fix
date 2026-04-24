"""
Unit tests for parser module.
"""

import pytest
from unittest.mock import Mock, patch

from src.bio_cattaleya.parsers.factory import ParserFactory
from src.bio_cattaleya.parsers.tmall import TmallParser
from src.bio_cattaleya.parsers.taobao import TaobaoParser
from src.bio_cattaleya.parsers.amazon import AmazonParser


class TestParserFactory:
    """Test cases for ParserFactory."""
    
    def setup_method(self):
        """Setup test fixtures."""
        self.factory = ParserFactory()
    
    def test_default_parsers_registered(self):
        """Test that default parsers are registered."""
        parsers = self.factory.get_available_parsers()
        
        assert "tmall" in parsers
        assert "taobao" in parsers
        assert "amazon" in parsers
    
    def test_domain_mapping(self):
        """Test domain to parser mapping."""
        domains = self.factory.get_supported_domains()
        
        assert "tmall.com" in domains
        assert "taobao.com" in domains
        assert "amazon.com" in domains
        assert domains["tmall.com"] == "tmall"
        assert domains["taobao.com"] == "taobao"
        assert domains["amazon.com"] == "amazon"
    
    def test_get_parser_by_url(self):
        """Test getting parser by URL."""
        tmall_parser = self.factory.get_parser("https://detail.tmall.com/item.htm?id=123")
        assert isinstance(tmall_parser, TmallParser)
        
        taobao_parser = self.factory.get_parser("https://item.taobao.com/item.htm?id=456")
        assert isinstance(taobao_parser, TaobaoParser)
        
        amazon_parser = self.factory.get_parser("https://www.amazon.com/dp/B08N5WRWNW")
        assert isinstance(amazon_parser, AmazonParser)
    
    def test_get_parser_by_type(self):
        """Test getting parser by explicit type."""
        tmall_parser = self.factory.get_parser("", "tmall")
        assert isinstance(tmall_parser, TmallParser)
    
    def test_unsupported_url(self):
        """Test handling of unsupported URLs."""
        with pytest.raises(ValueError, match="No parser found"):
            self.factory.get_parser("https://example.com/product")
    
    def test_can_handle_url(self):
        """Test URL handling capability check."""
        assert self.factory.can_handle_url("https://detail.tmall.com/item.htm")
        assert self.factory.can_handle_url("https://item.taobao.com/item.htm")
        assert self.factory.can_handle_url("https://www.amazon.com/dp/B123")
        assert not self.factory.can_handle_url("https://example.com/product")
    
    def test_register_custom_parser(self):
        """Test registering a custom parser."""
        class CustomParser:
            def get_platform_name(self):
                return "custom"
            def get_supported_domains(self):
                return ["custom.com"]
        
        self.factory.register_parser("custom", CustomParser)
        self.factory.map_domain("custom.com", "custom")
        
        assert "custom" in self.factory.get_available_parsers()
        assert self.factory.can_handle_url("https://custom.com/product")
    
    def test_parser_info(self):
        """Test getting parser information."""
        info = self.factory.get_parser_info("tmall")
        
        assert info is not None
        assert info["name"] == "tmall"
        assert info["platform"] == "tmall"
        assert "selectors" in info
        assert "sample_data" in info
    
    def test_validate_parser(self):
        """Test parser validation."""
        assert self.factory.validate_parser("tmall")
        assert self.factory.validate_parser("taobao")
        assert self.factory.validate_parser("amazon")
        assert not self.factory.validate_parser("nonexistent")


class TestTmallParser:
    """Test cases for TmallParser."""
    
    def setup_method(self):
        """Setup test fixtures."""
        self.parser = TmallParser()
    
    def test_platform_name(self):
        """Test platform name."""
        assert self.parser.get_platform_name() == "tmall"
    
    def test_supported_domains(self):
        """Test supported domains."""
        domains = self.parser.get_supported_domains()
        assert "tmall.com" in domains
        assert "detail.tmall.com" in domains
    
    def test_can_handle_url(self):
        """Test URL handling capability."""
        assert self.parser.can_handle_url("https://detail.tmall.com/item.htm")
        assert self.parser.can_handle_url("https://www.tmall.com/product/123")
        assert not self.parser.can_handle_url("https://taobao.com/item")
    
    def test_selectors_structure(self):
        """Test selectors structure."""
        selectors = self.parser.get_selectors()
        
        required_selectors = ['title', 'price', 'description', 'main_image']
        for selector in required_selectors:
            assert selector in selectors
            assert isinstance(selectors[selector], str)
    
    def test_parse_sample_data(self):
        """Test parsing sample data."""
        sample_data = {
            'title': 'Test Product',
            'price': '¥99.99',
            'description': 'Test description',
            'main_image': 'https://example.com/image.jpg',
            'page_metadata': {
                'url': 'https://detail.tmall.com/item.htm',
                'title': 'Test Product Page'
            }
        }
        
        result = self.parser.parse(sample_data)
        
        assert result['title'] == 'Test Product'
        assert result['platform'] == 'tmall'
        assert result['currency'] == '¥'
        assert 'parser_version' in result
        assert 'parser_type' in result
    
    def test_price_extraction(self):
        """Test price extraction."""
        sample_data = {
            'price': '¥99.99',
            'original_price': '¥199.99',
            'page_metadata': {'url': 'https://detail.tmall.com/item.htm'}
        }
        
        result = self.parser.parse(sample_data)
        
        assert result['price'] == 99.99
        assert result['original_price'] == 199.99
        assert result['discount_percent'] == 50.0
        assert result['discount_amount'] == 100.0


class TestTaobaoParser:
    """Test cases for TaobaoParser."""
    
    def setup_method(self):
        """Setup test fixtures."""
        self.parser = TaobaoParser()
    
    def test_platform_name(self):
        """Test platform name."""
        assert self.parser.get_platform_name() == "taobao"
    
    def test_supported_domains(self):
        """Test supported domains."""
        domains = self.parser.get_supported_domains()
        assert "taobao.com" in domains
        assert "item.taobao.com" in domains
    
    def test_sales_extraction(self):
        """Test sales count extraction."""
        sample_data = {
            'title': 'Test Product',
            'price': '¥99.99',
            'sales': '1.2万+',
            'page_metadata': {'url': 'https://item.taobao.com/item.htm'}
        }
        
        result = self.parser.parse(sample_data)
        
        assert result['sales_count'] == 12000
        assert result['sales_text'] == '1.2万+'


class TestAmazonParser:
    """Test cases for AmazonParser."""
    
    def setup_method(self):
        """Setup test fixtures."""
        self.parser = AmazonParser()
    
    def test_platform_name(self):
        """Test platform name."""
        assert self.parser.get_platform_name() == "amazon"
    
    def test_supported_domains(self):
        """Test supported domains."""
        domains = self.parser.get_supported_domains()
        
        assert "amazon.com" in domains
        assert "amazon.co.uk" in domains
        assert "amazon.de" in domains
        assert "amazon.fr" in domains
        assert "amazon.it" in domains
        assert "amazon.es" in domains
    
    def test_currency_detection(self):
        """Test currency detection by domain."""
        # Test US Amazon
        sample_data = {
            'title': 'Test Product',
            'price': '$99.99',
            'page_metadata': {'url': 'https://www.amazon.com/dp/B123'}
        }
        
        result = self.parser.parse(sample_data)
        assert result['currency'] == '$'
        
        # Test UK Amazon
        sample_data['page_metadata']['url'] = 'https://www.amazon.co.uk/dp/B123'
        result = self.parser.parse(sample_data)
        assert result['currency'] == '£'
        
        # Test German Amazon
        sample_data['page_metadata']['url'] = 'https://www.amazon.de/dp/B123'
        result = self.parser.parse(sample_data)
        assert result['currency'] == '€'
    
    def test_rating_extraction(self):
        """Test rating extraction."""
        sample_data = {
            'title': 'Test Product',
            'price': '$99.99',
            'rating': '4.5 out of 5 stars',
            'reviews_count': '2,345 ratings',
            'page_metadata': {'url': 'https://www.amazon.com/dp/B123'}
        }
        
        result = self.parser.parse(sample_data)
        
        assert result['rating'] == 4.5
        assert result['reviews_count'] == 2345
