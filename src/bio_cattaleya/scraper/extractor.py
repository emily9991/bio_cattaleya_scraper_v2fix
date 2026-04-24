"""
Data extraction utilities for Bio Cattaleya Scraper.

Provides methods for extracting and cleaning data from web pages.
"""

import re
import logging
from typing import Dict, List, Optional, Any, Union
from urllib.parse import urljoin, urlparse
from bs4 import BeautifulSoup

from ..config import settings


logger = logging.getLogger(__name__)


class DataExtractor:
    """Handles data extraction and cleaning operations."""
    
    def __init__(self, config: settings):
        """Initialize extractor with configuration."""
        self.config = config
    
    def extract_text(self, element: Any, clean: bool = True) -> Optional[str]:
        """
        Extract and clean text from an element.
        
        Args:
            element: BeautifulSoup element or similar
            clean: Whether to clean the text
            
        Returns:
            Cleaned text or None
        """
        if not element:
            return None
        
        text = getattr(element, 'text', '') or getattr(element, 'get_text', lambda: '')()
        
        if not text:
            return None
        
        if clean:
            text = self.clean_text(text)
        
        return text.strip() if text else None
    
    def clean_text(self, text: str) -> str:
        """
        Clean text by removing extra whitespace and special characters.
        
        Args:
            text: Text to clean
            
        Returns:
            Cleaned text
        """
        if not text:
            return ""
        
        # Remove extra whitespace
        text = re.sub(r'\s+', ' ', text)
        
        # Remove special characters but keep basic punctuation
        text = re.sub(r'[^\w\s\.,;:!?()\-"\']', '', text)
        
        # Remove leading/trailing whitespace
        text = text.strip()
        
        return text
    
    def extract_price(self, price_text: str) -> Optional[float]:
        """
        Extract numeric price from price text.
        
        Args:
            price_text: Text containing price information
            
        Returns:
            Numeric price or None
        """
        if not price_text:
            return None
        
        # Remove currency symbols and whitespace
        cleaned = re.sub(r'[^\d.,]', '', price_text)
        
        if not cleaned:
            return None
        
        # Handle different decimal separators
        if ',' in cleaned and '.' in cleaned:
            # Assume last separator is decimal
            if cleaned.rindex(',') > cleaned.rindex('.'):
                cleaned = cleaned.replace('.', '').replace(',', '.')
            else:
                cleaned = cleaned.replace(',', '')
        elif ',' in cleaned:
            # Could be decimal or thousands separator
            parts = cleaned.split(',')
            if len(parts) == 2 and len(parts[1]) <= 2:
                # Likely decimal separator
                cleaned = cleaned.replace(',', '.')
            else:
                # Likely thousands separator
                cleaned = cleaned.replace(',', '')
        
        try:
            return float(cleaned)
        except ValueError:
            logger.warning(f"Could not parse price: {price_text}")
            return None
    
    def extract_url(self, element: Any, base_url: Optional[str] = None) -> Optional[str]:
        """
        Extract and normalize URL from an element.
        
        Args:
            element: Element containing URL
            base_url: Base URL for relative links
            
        Returns:
            Normalized absolute URL or None
        """
        if not element:
            return None
        
        # Try different attributes
        url = None
        for attr in ['href', 'src', 'data-href', 'data-url']:
            url = getattr(element, attr, None) or element.get(attr)
            if url:
                break
        
        if not url:
            return None
        
        # Clean URL
        url = url.strip()
        
        # Handle relative URLs
        if base_url and not url.startswith(('http://', 'https://', '//')):
            url = urljoin(base_url, url)
        
        return url
    
    def extract_image_url(self, element: Any, base_url: Optional[str] = None) -> Optional[str]:
        """
        Extract image URL from an element.
        
        Args:
            element: Element containing image
            base_url: Base URL for relative links
            
        Returns:
            Image URL or None
        """
        if not element:
            return None
        
        # Try different image sources
        for attr in ['src', 'data-src', 'data-original', 'data-lazy']:
            url = getattr(element, attr, None) or element.get(attr)
            if url:
                return self.extract_url(element, base_url)
        
        return None
    
    def extract_attributes(self, element: Any, attributes: List[str]) -> Dict[str, Any]:
        """
        Extract multiple attributes from an element.
        
        Args:
            element: Element to extract from
            attributes: List of attribute names
            
        Returns:
            Dictionary of attribute values
        """
        result = {}
        
        for attr in attributes:
            value = getattr(element, attr, None) or element.get(attr)
            if value:
                result[attr] = value
        
        return result
    
    def extract_table_data(self, table: Any) -> List[Dict[str, str]]:
        """
        Extract data from an HTML table.
        
        Args:
            table: Table element
            
        Returns:
            List of dictionaries representing table rows
        """
        if not table:
            return []
        
        rows = table.find_all('tr')
        if not rows:
            return []
        
        # Extract headers
        headers = []
        header_row = rows[0]
        for th in header_row.find_all(['th', 'td']):
            header_text = self.extract_text(th)
            headers.append(header_text or f"Column_{len(headers)}")
        
        # Extract data rows
        data = []
        for row in rows[1:]:  # Skip header row
            cells = row.find_all(['td', 'th'])
            if len(cells) != len(headers):
                continue
            
            row_data = {}
            for i, cell in enumerate(cells):
                if i < len(headers):
                    row_data[headers[i]] = self.extract_text(cell) or ""
            
            data.append(row_data)
        
        return data
    
    def extract_list_items(self, list_element: Any, item_selector: str = 'li') -> List[str]:
        """
        Extract text from list items.
        
        Args:
            list_element: List element
            item_selector: Selector for list items
            
        Returns:
            List of text items
        """
        if not list_element:
            return []
        
        items = list_element.select(item_selector)
        return [self.extract_text(item) for item in items if self.extract_text(item)]
    
    def extract_json_data(self, script_text: str) -> Optional[Dict[str, Any]]:
        """
        Extract JSON data from script text.
        
        Args:
            script_text: Text containing JSON data
            
        Returns:
            Parsed JSON data or None
        """
        if not script_text:
            return None
        
        try:
            import json
            
            # Look for JSON patterns
            json_patterns = [
                r'window\.__INITIAL_STATE__\s*=\s*({.*?});',
                r'window\.__DATA__\s*=\s*({.*?});',
                r'var\s+data\s*=\s*({.*?});',
                r'const\s+data\s*=\s*({.*?});',
            ]
            
            for pattern in json_patterns:
                match = re.search(pattern, script_text, re.DOTALL)
                if match:
                    json_str = match.group(1)
                    return json.loads(json_str)
            
            return None
        except Exception as e:
            logger.warning(f"Failed to extract JSON data: {str(e)}")
            return None
    
    def normalize_data(self, data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Normalize extracted data by applying standard transformations.
        
        Args:
            data: Raw extracted data
            
        Returns:
            Normalized data
        """
        normalized = {}
        
        for key, value in data.items():
            if value is None:
                continue
            
            # Apply specific transformations based on key
            if 'price' in key.lower() and isinstance(value, str):
                normalized[key] = self.extract_price(value)
            elif 'url' in key.lower() and isinstance(value, str):
                normalized[key] = value.strip()
            elif 'image' in key.lower() and isinstance(value, str):
                normalized[key] = value.strip()
            elif isinstance(value, str):
                normalized[key] = self.clean_text(value)
            else:
                normalized[key] = value
        
        return normalized
