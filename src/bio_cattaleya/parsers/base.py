"""
Base parser class for Bio Cattaleya Scraper.

Provides common functionality for all platform-specific parsers.
"""

import re
import logging
from abc import ABC, abstractmethod
from typing import Dict, List, Optional, Any, Union
from urllib.parse import urlparse
from bs4 import BeautifulSoup

from ..scraper.extractor import DataExtractor
from ..config import settings


logger = logging.getLogger(__name__)


class BaseParser(ABC):
    """Abstract base class for all platform parsers."""
    
    def __init__(self, config: Optional[settings] = None):
        """Initialize parser with configuration."""
        self.config = config or settings()
        self.extractor = DataExtractor(self.config)
        self.selectors = self.get_selectors()
        
    @abstractmethod
    def get_selectors(self) -> Dict[str, str]:
        """
        Get CSS selectors for data extraction.
        
        Returns:
            Dictionary mapping field names to CSS selectors
        """
        pass
    
    @abstractmethod
    def get_platform_name(self) -> str:
        """
        Get the platform name this parser handles.
        
        Returns:
            Platform name string
        """
        pass
    
    def can_handle_url(self, url: str) -> bool:
        """
        Check if this parser can handle the given URL.
        
        Args:
            url: URL to check
            
        Returns:
            True if parser can handle the URL
        """
        domain = urlparse(url).netloc.lower()
        return any(platform_domain in domain for platform_domain in self.get_supported_domains())
    
    @abstractmethod
    def get_supported_domains(self) -> List[str]:
        """
        Get list of supported domains for this parser.
        
        Returns:
            List of domain strings
        """
        pass
    
    def parse(self, raw_data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Parse raw data into structured format.
        
        Args:
            raw_data: Raw data extracted from web page
            
        Returns:
            Parsed and structured data
        """
        logger.info(f"Parsing data for {self.get_platform_name()}")
        
        try:
            # Extract basic information
            parsed_data = self.extract_basic_info(raw_data)
            
            # Extract product details
            parsed_data.update(self.extract_product_details(raw_data))
            
            # Extract pricing information
            parsed_data.update(self.extract_pricing_info(raw_data))
            
            # Extract images
            parsed_data.update(self.extract_images(raw_data))
            
            # Extract variants if available
            parsed_data.update(self.extract_variants(raw_data))
            
            # Add metadata
            parsed_data.update(self.add_metadata(raw_data))
            
            # Normalize data
            parsed_data = self.normalize_parsed_data(parsed_data)
            
            logger.info(f"Successfully parsed {len(parsed_data)} fields")
            return parsed_data
            
        except Exception as e:
            logger.error(f"Error parsing data: {str(e)}")
            raise
    
    def extract_basic_info(self, raw_data: Dict[str, Any]) -> Dict[str, Any]:
        """Extract basic product information."""
        data = {}
        
        # Title
        if 'title' in raw_data:
            data['title'] = self.extractor.clean_text(str(raw_data['title']))
        
        # URL
        if 'page_metadata' in raw_data and 'url' in raw_data['page_metadata']:
            data['url'] = raw_data['page_metadata']['url']
        
        # Platform
        data['platform'] = self.get_platform_name()
        
        return data
    
    def extract_product_details(self, raw_data: Dict[str, Any]) -> Dict[str, Any]:
        """Extract detailed product information."""
        data = {}
        
        # Description
        if 'description' in raw_data:
            data['description'] = self.extractor.clean_text(str(raw_data['description']))
        
        # Brand
        if 'brand' in raw_data:
            data['brand'] = self.extractor.clean_text(str(raw_data['brand']))
        
        # Category
        if 'category' in raw_data:
            data['category'] = self.extractor.clean_text(str(raw_data['category']))
        
        # SKU/ID
        if 'sku' in raw_data:
            data['sku'] = str(raw_data['sku']).strip()
        
        return data
    
    def extract_pricing_info(self, raw_data: Dict[str, Any]) -> Dict[str, Any]:
        """Extract pricing information."""
        data = {}
        
        # Current price
        if 'price' in raw_data:
            data['price'] = self.extractor.extract_price(str(raw_data['price']))
        
        # Original price
        if 'original_price' in raw_data:
            data['original_price'] = self.extractor.extract_price(str(raw_data['original_price']))
        
        # Currency
        if 'currency' in raw_data:
            data['currency'] = str(raw_data['currency']).strip()
        else:
            # Try to extract currency from price text
            if 'price' in raw_data:
                price_text = str(raw_data['price'])
                currency_match = re.search(r'[$€£¥₹₽]', price_text)
                if currency_match:
                    data['currency'] = currency_match.group()
        
        return data
    
    def extract_images(self, raw_data: Dict[str, Any]) -> Dict[str, Any]:
        """Extract product images."""
        data = {}
        
        # Main image
        if 'main_image' in raw_data:
            data['main_image'] = raw_data['main_image']
        
        # Additional images
        if 'images' in raw_data:
            images = raw_data['images']
            if isinstance(images, list):
                data['images'] = [img for img in images if img]
            else:
                data['images'] = [images]
        
        return data
    
    def extract_variants(self, raw_data: Dict[str, Any]) -> Dict[str, Any]:
        """Extract product variants (size, color, etc.)."""
        data = {}
        
        # Colors
        if 'colors' in raw_data:
            colors = raw_data['colors']
            if isinstance(colors, list):
                data['colors'] = [self.extractor.clean_text(str(color)) for color in colors if color]
            else:
                data['colors'] = [self.extractor.clean_text(str(colors))]
        
        # Sizes
        if 'sizes' in raw_data:
            sizes = raw_data['sizes']
            if isinstance(sizes, list):
                data['sizes'] = [self.extractor.clean_text(str(size)) for size in sizes if size]
            else:
                data['sizes'] = [self.extractor.clean_text(str(sizes))]
        
        return data
    
    def add_metadata(self, raw_data: Dict[str, Any]) -> Dict[str, Any]:
        """Add metadata to parsed data."""
        data = {}
        
        # Page metadata
        if 'page_metadata' in raw_data:
            metadata = raw_data['page_metadata']
            data['page_title'] = metadata.get('title', '')
            data['scraped_at'] = metadata.get('timestamp', '')
        
        # Parser metadata
        data['parser_version'] = self.config.version
        data['parser_type'] = self.__class__.__name__
        
        return data
    
    def normalize_parsed_data(self, data: Dict[str, Any]) -> Dict[str, Any]:
        """Normalize and validate parsed data."""
        # Remove empty values
        normalized = {k: v for k, v in data.items() if v is not None and v != ''}
        
        # Ensure required fields
        if 'title' not in normalized:
            normalized['title'] = 'Unknown Product'
        
        if 'url' not in normalized:
            normalized['url'] = ''
        
        return normalized
    
    def validate_data(self, data: Dict[str, Any]) -> bool:
        """
        Validate parsed data completeness.
        
        Args:
            data: Parsed data to validate
            
        Returns:
            True if data is valid, False otherwise
        """
        # Check required fields
        required_fields = ['title', 'url']
        for field in required_fields:
            if field not in data or not data[field]:
                logger.warning(f"Missing required field: {field}")
                return False
        
        # Check data quality
        if len(data.get('title', '')) < 3:
            logger.warning("Title too short")
            return False
        
        return True
    
    def get_sample_data(self) -> Dict[str, Any]:
        """
        Get sample data structure for this parser.
        
        Returns:
            Sample data dictionary
        """
        return {
            'title': 'Sample Product',
            'url': 'https://example.com/product/123',
            'platform': self.get_platform_name(),
            'price': 99.99,
            'currency': '$',
            'description': 'Sample product description',
            'brand': 'Sample Brand',
            'category': 'Sample Category',
            'images': ['https://example.com/image1.jpg'],
            'main_image': 'https://example.com/main.jpg',
            'colors': ['Red', 'Blue'],
            'sizes': ['S', 'M', 'L'],
            'sku': 'SAMPLE123',
            'page_title': 'Sample Product Page',
            'scraped_at': '2023-01-01T00:00:00Z',
            'parser_version': self.config.version,
            'parser_type': self.__class__.__name__
        }
