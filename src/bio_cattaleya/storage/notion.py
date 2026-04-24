"""
Notion storage backend for Bio Cattaleya Scraper.

Handles data persistence to Notion databases.
"""

import asyncio
import logging
from typing import Dict, List, Optional, Any
from datetime import datetime

try:
    from notion_client import Client as NotionClient
    from notion_client.async_client import AsyncClient as AsyncNotionClient
except ImportError:
    NotionClient = None
    AsyncNotionClient = None

from .base import BaseStorage
from ..config import settings


logger = logging.getLogger(__name__)


class NotionStorage(BaseStorage):
    """Notion database storage backend."""
    
    def __init__(self, config: Optional[settings] = None):
        """Initialize Notion storage with configuration."""
        super().__init__(config)
        
        if not AsyncNotionClient:
            raise ImportError("notion-client is required for Notion storage. Install with: pip install notion-client")
        
        if not self.config.notion_api_key or not self.config.notion_database_id:
            raise ValueError("Notion API key and database ID are required")
        
        self.client = AsyncNotionClient(auth=self.config.notion_api_key)
        self.database_id = self.config.notion_database_id
    
    async def save(self, data: Dict[str, Any]) -> bool:
        """Save data to Notion database."""
        try:
            # Validate data
            if not await self.validate_data(data):
                return False
            
            # Generate page properties
            properties = self._convert_to_notion_properties(data)
            
            # Create page in database
            page = await self.client.pages.create(
                parent={"database_id": self.database_id},
                properties=properties
            )
            
            # Add page content if available
            if data.get('description'):
                await self._add_page_content(page["id"], data)
            
            self.logger.info(f"Successfully saved data to Notion: {data.get('title', 'Unknown')}")
            return True
            
        except Exception as e:
            self.logger.error(f"Error saving to Notion: {str(e)}")
            return False
    
    async def get(self, identifier: str) -> Optional[Dict[str, Any]]:
        """Retrieve data from Notion database."""
        try:
            # Search for page by identifier
            response = await self.client.databases.query(
                database_id=self.database_id,
                filter={
                    "property": "ID",
                    "rich_text": {
                        "equals": identifier
                    }
                }
            )
            
            if not response["results"]:
                return None
            
            # Get the first result
            page = response["results"][0]
            return self._convert_from_notion_properties(page)
            
        except Exception as e:
            self.logger.error(f"Error retrieving from Notion: {str(e)}")
            return None
    
    async def update(self, identifier: str, data: Dict[str, Any]) -> bool:
        """Update existing data in Notion database."""
        try:
            # Find the page to update
            response = await self.client.databases.query(
                database_id=self.database_id,
                filter={
                    "property": "ID",
                    "rich_text": {
                        "equals": identifier
                    }
                }
            )
            
            if not response["results"]:
                return False
            
            page_id = response["results"][0]["id"]
            
            # Convert data to Notion properties
            properties = self._convert_to_notion_properties(data)
            
            # Update the page
            await self.client.pages.update(
                page_id=page_id,
                properties=properties
            )
            
            self.logger.info(f"Successfully updated data in Notion: {identifier}")
            return True
            
        except Exception as e:
            self.logger.error(f"Error updating in Notion: {str(e)}")
            return False
    
    async def delete(self, identifier: str) -> bool:
        """Delete data from Notion database."""
        try:
            # Find the page to delete
            response = await self.client.databases.query(
                database_id=self.database_id,
                filter={
                    "property": "ID",
                    "rich_text": {
                        "equals": identifier
                    }
                }
            )
            
            if not response["results"]:
                return False
            
            page_id = response["results"][0]["id"]
            
            # Archive the page (Notion doesn't support permanent deletion)
            await self.client.pages.update(
                page_id=page_id,
                archived=True
            )
            
            self.logger.info(f"Successfully archived data in Notion: {identifier}")
            return True
            
        except Exception as e:
            self.logger.error(f"Error deleting from Notion: {str(e)}")
            return False
    
    async def list(self, filters: Optional[Dict[str, Any]] = None) -> List[Dict[str, Any]]:
        """List data from Notion database with optional filters."""
        try:
            query_params = {"database_id": self.database_id}
            
            # Add filters if provided
            if filters:
                notion_filters = self._convert_to_notion_filters(filters)
                query_params["filter"] = notion_filters
            
            response = await self.client.databases.query(**query_params)
            
            # Convert results to our format
            results = []
            for page in response["results"]:
                data = self._convert_from_notion_properties(page)
                if data:
                    results.append(data)
            
            return results
            
        except Exception as e:
            self.logger.error(f"Error listing from Notion: {str(e)}")
            return []
    
    def _convert_to_notion_properties(self, data: Dict[str, Any]) -> Dict[str, Any]:
        """Convert our data format to Notion properties."""
        properties = {}
        
        # ID (required)
        properties["ID"] = {
            "rich_text": [{"text": {"content": self.generate_identifier(data)}}]
        }
        
        # Title (required)
        if data.get('title'):
            properties["Title"] = {
                "title": [{"text": {"content": str(data['title'])}}]
            }
        
        # URL
        if data.get('url'):
            properties["URL"] = {
                "url": str(data['url'])
            }
        
        # Platform
        if data.get('platform'):
            properties["Platform"] = {
            "select": {"name": str(data['platform'])}
        }
        
        # Price
        if data.get('price'):
            properties["Price"] = {
                "number": float(data['price'])
            }
        
        # Currency
        if data.get('currency'):
            properties["Currency"] = {
                "select": {"name": str(data['currency'])}
            }
        
        # Brand
        if data.get('brand'):
            properties["Brand"] = {
                "rich_text": [{"text": {"content": str(data['brand'])}}]
            }
        
        # Category
        if data.get('category'):
            properties["Category"] = {
                "rich_text": [{"text": {"content": str(data['category'])}}]
            }
        
        # SKU
        if data.get('sku'):
            properties["SKU"] = {
                "rich_text": [{"text": {"content": str(data['sku'])}}]
            }
        
        # Stock
        if data.get('stock_quantity'):
            properties["Stock"] = {
                "number": int(data['stock_quantity'])
            }
        
        # Rating
        if data.get('rating'):
            properties["Rating"] = {
                "number": float(data['rating'])
            }
        
        # Reviews Count
        if data.get('reviews_count'):
            properties["Reviews"] = {
                "number": int(data['reviews_count'])
            }
        
        # Seller
        if data.get('seller'):
            properties["Seller"] = {
                "rich_text": [{"text": {"content": str(data['seller'])}}]
            }
        
        # Images (as rich text)
        if data.get('images') and isinstance(data['images'], list):
            images_text = ", ".join(str(img) for img in data['images'][:5])  # Limit to 5 images
            properties["Images"] = {
                "rich_text": [{"text": {"content": images_text}}]
            }
        
        # Main Image
        if data.get('main_image'):
            properties["Main Image"] = {
                "url": str(data['main_image'])
            }
        
        # Scraped At
        scraped_at = data.get('scraped_at', datetime.now().isoformat())
        properties["Scraped At"] = {
            "date": {"start": scraped_at.split('T')[0]}
        }
        
        return properties
    
    def _convert_from_notion_properties(self, page: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        """Convert Notion properties to our data format."""
        try:
            properties = page.get("properties", {})
            data = {}
            
            # Extract basic properties
            for key, prop in properties.items():
                prop_type = prop.get("type")
                
                if prop_type == "title" and prop.get("title"):
                    data[key.lower()] = prop["title"][0]["text"]["content"]
                elif prop_type == "rich_text" and prop.get("rich_text"):
                    data[key.lower()] = prop["rich_text"][0]["text"]["content"]
                elif prop_type == "url" and prop.get("url"):
                    data[key.lower()] = prop["url"]
                elif prop_type == "select" and prop.get("select"):
                    data[key.lower()] = prop["select"]["name"]
                elif prop_type == "number" and prop.get("number") is not None:
                    data[key.lower()] = prop["number"]
                elif prop_type == "date" and prop.get("date"):
                    data[key.lower()] = prop["date"]["start"]
            
            return data
            
        except Exception as e:
            self.logger.error(f"Error converting from Notion properties: {str(e)}")
            return None
    
    def _convert_to_notion_filters(self, filters: Dict[str, Any]) -> Dict[str, Any]:
        """Convert our filter format to Notion filters."""
        notion_filters = []
        
        for key, value in filters.items():
            if key == "platform":
                notion_filters.append({
                    "property": "Platform",
                    "select": {"equals": value}
                })
            elif key == "brand":
                notion_filters.append({
                    "property": "Brand", 
                    "rich_text": {"equals": value}
                })
            elif key == "category":
                notion_filters.append({
                    "property": "Category",
                    "rich_text": {"contains": value}
                })
            elif key == "min_price":
                notion_filters.append({
                    "property": "Price",
                    "number": {"greater_than_or_equal_to": float(value)}
                })
            elif key == "max_price":
                notion_filters.append({
                    "property": "Price",
                    "number": {"less_than_or_equal_to": float(value)}
                })
        
        # Combine filters with AND
        if len(notion_filters) == 1:
            return notion_filters[0]
        elif len(notion_filters) > 1:
            return {
                "and": notion_filters
            }
        else:
            return {}
    
    async def _add_page_content(self, page_id: str, data: Dict[str, Any]) -> None:
        """Add content blocks to a Notion page."""
        try:
            blocks = []
            
            # Add description
            if data.get('description'):
                blocks.append({
                    "object": "block",
                    "type": "paragraph",
                    "paragraph": {
                        "rich_text": [{"text": {"content": str(data['description'])}}]
                    }
                })
            
            # Add variants if available
            if data.get('variants'):
                variants_text = "\n".join(
                    f"• {variant.get('color', 'N/A')} - {variant.get('size', 'N/A')}"
                    for variant in data['variants'][:10]
                )
                blocks.append({
                    "object": "block",
                    "type": "bulleted_list_item",
                    "bulleted_list_item": {
                        "rich_text": [{"text": {"content": f"Variants:\n{variants_text}"}}]
                    }
                })
            
            # Add blocks to page if any
            if blocks:
                await self.client.blocks.children.append(block_id=page_id, children=blocks)
                
        except Exception as e:
            self.logger.warning(f"Error adding page content: {str(e)}")
    
    async def health_check(self) -> Dict[str, Any]:
        """Check Notion storage health."""
        try:
            # Test database access
            database = await self.client.databases.retrieve(database_id=self.database_id)
            
            return {
                'status': 'healthy',
                'backend': self.__class__.__name__,
                'database_id': self.database_id,
                'database_title': database.get('title', [{}])[0].get('text', {}).get('content', 'Unknown'),
                'test_passed': True
            }
            
        except Exception as e:
            return {
                'status': 'unhealthy',
                'backend': self.__class__.__name__,
                'database_id': self.database_id,
                'test_passed': False,
                'error': str(e)
            }
    
    def get_supported_features(self) -> List[str]:
        """Get list of supported features."""
        return [
            'save',
            'get',
            'update', 
            'delete',
            'list',
            'batch_save',
            'health_check',
            'rich_content',
            'filtering',
            'search'
        ]
