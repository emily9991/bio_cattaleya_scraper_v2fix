"""
Tmall parser for Bio Cattaleya Scraper.

Handles data extraction from Tmall.com product pages.
"""

import re
import logging
from typing import Dict, List, Optional, Any

from .base import BaseParser
from ..config import settings


logger = logging.getLogger(__name__)


class TmallParser(BaseParser):
    """Parser for Tmall.com product pages."""
    
    def get_selectors(self) -> Dict[str, str]:
        """Get CSS selectors for Tmall data extraction."""
        return {
            'title': 'h1[data-spm="itemId"], .tb-detail-hd h1, .item-title-dt',
            'price': '.tb-rmb-num, .tm-price .tm-price-cur, .price .tm-price-cur',
            'original_price': '.tm-price-ori, .price-line .tm-price-ori',
            'description': '.tb-detail-desc, .item-detail-desc, #description',
            'brand': '.brand-name, .tb-brand-name, .item-brand',
            'category': '.crumb a, .breadcrumb a, .nav-path a',
            'main_image': '#J_ImgBooth img, .tb-booth img, .item-gallery img',
            'images': '.tb-gallery img, .item-gallery-list img',
            'sku': '.item-no, .sku-no, .item-sku',
            'colors': '.tb-prop-color a, .color-chosen a, .item-color a',
            'sizes': '.tb-prop-size a, .size-chosen a, .item-size a',
            'stock': '.tb-count, .item-stock, .stock-info',
            'seller': '.tb-seller-name, .seller-name, .shop-name',
            'rating': '.tb-rate-score, .item-rate, .rating-score'
        }
    
    def get_platform_name(self) -> str:
        """Get platform name."""
        return "tmall"
    
    def get_supported_domains(self) -> List[str]:
        """Get supported domains for Tmall."""
        return ["tmall.com", "detail.tmall.com"]
    
    def extract_product_details(self, raw_data: Dict[str, Any]) -> Dict[str, Any]:
        """Extract Tmall-specific product details."""
        data = super().extract_product_details(raw_data)
        
        # Extract Tmall-specific information
        if 'seller' in raw_data:
            data['seller'] = self.extractor.clean_text(str(raw_data['seller']))
        
        if 'stock' in raw_data:
            stock_text = str(raw_data['stock'])
            # Extract numeric stock quantity
            stock_match = re.search(r'(\d+)', stock_text)
            if stock_match:
                data['stock_quantity'] = int(stock_match.group(1))
            data['stock_text'] = self.extractor.clean_text(stock_text)
        
        if 'rating' in raw_data:
            rating_text = str(raw_data['rating'])
            # Extract numeric rating
            rating_match = re.search(r'(\d+\.?\d*)', rating_text)
            if rating_match:
                data['rating'] = float(rating_match.group(1))
        
        # Extract category path
        if 'category' in raw_data:
            categories = raw_data['category']
            if isinstance(categories, list):
                data['category_path'] = [self.extractor.clean_text(cat) for cat in categories if cat]
            else:
                data['category_path'] = [self.extractor.clean_text(str(categories))]
        
        return data
    
    def extract_pricing_info(self, raw_data: Dict[str, Any]) -> Dict[str, Any]:
        """Extract Tmall-specific pricing information."""
        data = super().extract_pricing_info(raw_data)
        
        # Tmall uses Chinese Yuan (RMB)
        data['currency'] = '¥'
        
        # Extract discount information
        if 'original_price' in raw_data and 'price' in raw_data:
            try:
                original = self.extractor.extract_price(str(raw_data['original_price']))
                current = self.extractor.extract_price(str(raw_data['price']))
                
                if original and current and original > current:
                    discount_percent = ((original - current) / original) * 100
                    data['discount_percent'] = round(discount_percent, 2)
                    data['discount_amount'] = round(original - current, 2)
            except Exception:
                pass
        
        return data
    
    def extract_variants(self, raw_data: Dict[str, Any]) -> Dict[str, Any]:
        """Extract Tmall-specific variant information."""
        data = super().extract_variants(raw_data)
        
        # Tmall often has complex variant structures
        # Extract variant combinations if available
        if 'colors' in raw_data and 'sizes' in raw_data:
            colors = raw_data['colors']
            sizes = raw_data['sizes']
            
            if isinstance(colors, list) and isinstance(sizes, list):
                # Create variant combinations
                variants = []
                for color in colors:
                    for size in sizes:
                        variants.append({
                            'color': self.extractor.clean_text(str(color)),
                            'size': self.extractor.clean_text(str(size))
                        })
                data['variants'] = variants
        
        return data
    
    def normalize_parsed_data(self, data: Dict[str, Any]) -> Dict[str, Any]:
        """Normalize Tmall-specific data."""
        data = super().normalize_parsed_data(data)
        
        # Add Tmall-specific normalizations
        if 'category_path' in data and isinstance(data['category_path'], list):
            # Join category path into single string
            data['category'] = ' > '.join(data['category_path'])
        
        # Ensure numeric fields are properly typed
        if 'stock_quantity' in data:
            try:
                data['stock_quantity'] = int(data['stock_quantity'])
            except (ValueError, TypeError):
                data['stock_quantity'] = 0
        
        if 'rating' in data:
            try:
                data['rating'] = float(data['rating'])
            except (ValueError, TypeError):
                data['rating'] = 0.0
        
        return data
    
    def validate_data(self, data: Dict[str, Any]) -> bool:
        """Validate Tmall-specific data."""
        if not super().validate_data(data):
            return False
        
        # Tmall-specific validations
        if 'tmall.com' not in data.get('url', ''):
            logger.warning("URL doesn't appear to be from Tmall")
        
        # Check for Tmall-specific indicators
        title = data.get('title', '').lower()
        if not any(indicator in title for indicator in ['tmall', '天猫']):
            logger.warning("Title doesn't contain Tmall indicators")
        
        return True
