"""
Base storage class for Bio Cattaleya Scraper.

Provides common interface for all storage backends.
"""

import logging
from abc import ABC, abstractmethod
from typing import Dict, List, Optional, Any

from ..config import settings


logger = logging.getLogger(__name__)


class BaseStorage(ABC):
    """Abstract base class for all storage backends."""
    
    def __init__(self, config: Optional[settings] = None):
        """Initialize storage with configuration."""
        self.config = config or settings()
        self._setup_logging()
    
    def _setup_logging(self) -> None:
        """Setup logging for storage operations."""
        self.logger = logging.getLogger(f"{__name__}.{self.__class__.__name__}")
    
    @abstractmethod
    async def save(self, data: Dict[str, Any]) -> bool:
        """
        Save data to storage.
        
        Args:
            data: Data to save
            
        Returns:
            True if successful, False otherwise
        """
        pass
    
    @abstractmethod
    async def get(self, identifier: str) -> Optional[Dict[str, Any]]:
        """
        Retrieve data from storage.
        
        Args:
            identifier: Unique identifier for the data
            
        Returns:
            Retrieved data or None if not found
        """
        pass
    
    @abstractmethod
    async def update(self, identifier: str, data: Dict[str, Any]) -> bool:
        """
        Update existing data in storage.
        
        Args:
            identifier: Unique identifier for the data
            data: Updated data
            
        Returns:
            True if successful, False otherwise
        """
        pass
    
    @abstractmethod
    async def delete(self, identifier: str) -> bool:
        """
        Delete data from storage.
        
        Args:
            identifier: Unique identifier for the data
            
        Returns:
            True if successful, False otherwise
        """
        pass
    
    @abstractmethod
    async def list(self, filters: Optional[Dict[str, Any]] = None) -> List[Dict[str, Any]]:
        """
        List data from storage with optional filters.
        
        Args:
            filters: Optional filters to apply
            
        Returns:
            List of data items
        """
        pass
    
    async def save_batch(self, data_list: List[Dict[str, Any]]) -> bool:
        """
        Save multiple data items in batch.
        
        Args:
            data_list: List of data items to save
            
        Returns:
            True if all successful, False otherwise
        """
        success_count = 0
        
        for data in data_list:
            if await self.save(data):
                success_count += 1
            else:
                self.logger.error(f"Failed to save data item: {data.get('id', 'unknown')}")
        
        self.logger.info(f"Saved {success_count}/{len(data_list)} items")
        return success_count == len(data_list)
    
    async def validate_data(self, data: Dict[str, Any]) -> bool:
        """
        Validate data before saving.
        
        Args:
            data: Data to validate
            
        Returns:
            True if valid, False otherwise
        """
        # Basic validation
        if not isinstance(data, dict):
            self.logger.error("Data must be a dictionary")
            return False
        
        if not data:
            self.logger.error("Data cannot be empty")
            return False
        
        # Check for required fields
        required_fields = ['title', 'url']
        for field in required_fields:
            if field not in data or not data[field]:
                self.logger.warning(f"Missing required field: {field}")
                return False
        
        return True
    
    def generate_identifier(self, data: Dict[str, Any]) -> str:
        """
        Generate unique identifier for data.
        
        Args:
            data: Data to generate identifier for
            
        Returns:
            Unique identifier string
        """
        import hashlib
        
        # Use URL and title to generate unique ID
        url = data.get('url', '')
        title = data.get('title', '')
        
        # Create hash
        content = f"{url}_{title}"
        return hashlib.md5(content.encode()).hexdigest()
    
    async def health_check(self) -> Dict[str, Any]:
        """
        Check storage backend health.
        
        Returns:
            Health status information
        """
        try:
            # Test basic connectivity
            test_data = {
                'title': 'Health Check Test',
                'url': 'https://test.example.com',
                'platform': 'test'
            }
            
            # Try to save and retrieve test data
            test_id = self.generate_identifier(test_data)
            success = await self.save(test_data)
            
            if success:
                retrieved = await self.get(test_id)
                await self.delete(test_id)  # Clean up
                
                return {
                    'status': 'healthy',
                    'backend': self.__class__.__name__,
                    'test_passed': True,
                    'data_retrieved': retrieved is not None
                }
            else:
                return {
                    'status': 'unhealthy',
                    'backend': self.__class__.__name__,
                    'test_passed': False,
                    'error': 'Failed to save test data'
                }
        
        except Exception as e:
            return {
                'status': 'unhealthy',
                'backend': self.__class__.__name__,
                'test_passed': False,
                'error': str(e)
            }
    
    def get_storage_info(self) -> Dict[str, Any]:
        """
        Get storage backend information.
        
        Returns:
            Storage information dictionary
        """
        return {
            'backend': self.__class__.__name__,
            'version': self.config.version,
            'features': self.get_supported_features()
        }
    
    def get_supported_features(self) -> List[str]:
        """
        Get list of supported features.
        
        Returns:
            List of feature names
        """
        return [
            'save',
            'get', 
            'update',
            'delete',
            'list',
            'batch_save',
            'health_check'
        ]
