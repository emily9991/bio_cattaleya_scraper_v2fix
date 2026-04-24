"""
Amazon parser for Bio Cattaleya Scraper.

Handles data extraction from Amazon product pages.
"""

import re
import logging
from typing import Dict, List, Optional, Any

from .base import BaseParser
from ..config import settings


logger = logging.getLogger(__name__)


class AmazonParser(BaseParser):
    """Parser for Amazon product pages."""
    
    def get_selectors(self) -> Dict[str, str]:
        """Get CSS selectors for Amazon data extraction."""
        return {
            'title': '#productTitle, .product-title, h1.a-size-large',
            'price': '.a-price .a-offscreen, .a-price-whole, .a-price-fraction',
            'original_price': '.a-text-strike .a-offscreen, .basisPrice .a-offscreen',
            'description': '#feature-bullets ul, #productDescription, .a-unordered-list',
            'brand': '#bylineInfo, .a-row .a-size-base, .po-brand .a-size-base',
            'category': '#wayfinding-breadcrumbs_container a, .a-breadcrumb a',
            'main_image': '#landingImage, .a-dynamic-image, .item-gallery img',
            'images': '.a-spacing-small .a-button-thumbnail img, .item-gallery-list img',
            'sku': '#ASIN, .item-sku, .sku-data',
            'colors': '#variation_color_name .a-form-normal, .color-name .a-form-normal',
            'sizes': '#variation_size_name .a-form-normal, .size-name .a-form-normal',
            'stock': '#availability, .availability, .a-color-price',
            'seller': '#sellerProfileTriggerId, .a-row .a-size-small, .seller-name',
            'rating': '.a-icon-alt, .a-star-average, .review-rating',
            'reviews_count': '#acrCustomerReviewText, .reviews-count, .total-review-count'
        }
    
    def get_platform_name(self) -> str:
        """Get platform name."""
        return "amazon"
    
    def get_supported_domains(self) -> List[str]:
        """Get supported domains for Amazon."""
        return ["amazon.com", "amazon.co.uk", "amazon.de", "amazon.fr", "amazon.it", "amazon.es"]
    
    def extract_product_details(self, raw_data: Dict[str, Any]) -> Dict[str, Any]:
        """Extract Amazon-specific product details."""
        data = super().extract_product_details(raw_data)
        
        # Extract Amazon-specific information
        if 'seller' in raw_data:
            seller_text = str(raw_data['seller'])
            # Clean seller information
            data['seller'] = self.extractor.clean_text(seller_text.replace('Brand:', '').replace('Visit the', ''))
        
        if 'stock' in raw_data:
            stock_text = str(raw_data['stock'])
            data['stock_text'] = self.extractor.clean_text(stock_text)
            
            # Extract stock availability
            if any(keyword in stock_text.lower() for keyword in ['in stock', 'available', '通常']):
                data['in_stock'] = True
            elif any(keyword in stock_text.lower() for keyword in ['out of stock', 'unavailable', '在庫なし']):
                data['in_stock'] = False
            else:
                data['in_stock'] = None
        
        if 'rating' in raw_data:
            rating_text = str(raw_data['rating'])
            # Extract numeric rating (format: "4.5 out of 5 stars")
            rating_match = re.search(r'(\d+\.?\d*)\s*out\s*of\s*5', rating_text.lower())
            if rating_match:
                data['rating'] = float(rating_match.group(1))
            else:
                # Try alternative format
                rating_match = re.search(r'(\d+\.?\d*)', rating_text)
                if rating_match:
                    data['rating'] = float(rating_match.group(1))
        
        # Extract reviews count
        if 'reviews_count' in raw_data:
            reviews_text = str(raw_data['reviews_count'])
            # Extract numeric reviews count
            reviews_match = re.search(r'([\d,]+)', reviews_text.replace(',', ''))
            if reviews_match:
                data['reviews_count'] = int(reviews_match.group(1))
        
        # Extract category path
        if 'category' in raw_data:
            categories = raw_data['category']
            if isinstance(categories, list):
                data['category_path'] = [self.extractor.clean_text(cat) for cat in categories if cat]
            else:
                data['category_path'] = [self.extractor.clean_text(str(categories))]
        
        return data
    
    def extract_pricing_info(self, raw_data: Dict[str, Any]) -> Dict[str, Any]:
        """Extract Amazon-specific pricing information."""
        data = super().extract_pricing_info(raw_data)
        
        # Amazon uses different currencies based on domain
        url = raw_data.get('page_metadata', {}).get('url', '')
        
        if 'amazon.com' in url:
            data['currency'] = '$'
        elif 'amazon.co.uk' in url:
            data['currency'] = '£'
        elif 'amazon.de' in url:
            data['currency'] = '€'
        elif 'amazon.fr' in url:
            data['currency'] = '€'
        elif 'amazon.it' in url:
            data['currency'] = '€'
        elif 'amazon.es' in url:
            data['currency'] = '€'
        
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
        """Extract Amazon-specific variant information."""
        data = super().extract_variants(raw_data)
        
        # Amazon has structured variant information
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
        """Normalize Amazon-specific data."""
        data = super().normalize_parsed_data(data)
        
        # Add Amazon-specific normalizations
        if 'category_path' in data and isinstance(data['category_path'], list):
            # Join category path into single string
            data['category'] = ' > '.join(data['category_path'])
        
        # Ensure numeric fields are properly typed
        if 'rating' in data:
            try:
                data['rating'] = float(data['rating'])
            except (ValueError, TypeError):
                data['rating'] = 0.0
        
        if 'reviews_count' in data:
            try:
                data['reviews_count'] = int(data['reviews_count'])
            except (ValueError, TypeError):
                data['reviews_count'] = 0
        
        return data
    
    def validate_data(self, data: Dict[str, Any]) -> bool:
        """Validate Amazon-specific data."""
        if not super().validate_data(data):
            return False
        
        # Amazon-specific validations
        url = data.get('url', '')
        if not any(domain in url for domain in self.get_supported_domains()):
            logger.warning("URL doesn't appear to be from Amazon")
        
        # Check for Amazon-specific indicators
        title = data.get('title', '').lower()
        if not any(indicator in title for indicator in ['amazon', 'amazon.com']):
            logger.warning("Title doesn't contain Amazon indicators")
        
        return True
