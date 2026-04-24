"""
Main scraper engine for Bio Cattaleya.

Coordinates all scraping operations and manages the extraction pipeline.
"""

import asyncio
import logging
from typing import Dict, List, Optional, Any
from pathlib import Path

from ..config import settings
from .browser import BrowserManager
from .extractor import DataExtractor
from ..parsers.factory import ParserFactory
from ..storage.notion import NotionStorage


logger = logging.getLogger(__name__)


class BioCattaleyaScraper:
    """Main scraper class that orchestrates the entire scraping process."""
    
    def __init__(self, config: Optional[settings] = None):
        """Initialize the scraper with configuration."""
        self.config = config or settings
        self.browser_manager = BrowserManager(self.config)
        self.data_extractor = DataExtractor(self.config)
        self.parser_factory = ParserFactory()
        self.storage = NotionStorage(self.config) if self.config.notion_api_key else None
        
        # Setup logging
        self._setup_logging()
        
        logger.info(f"Bio Cattaleya Scraper v{self.config.version} initialized")
    
    def _setup_logging(self) -> None:
        """Configure logging based on settings."""
        log_level = getattr(logging, self.config.log_level)
        
        # Create formatter
        formatter = logging.Formatter(self.config.log_format)
        
        # Setup console handler
        console_handler = logging.StreamHandler()
        console_handler.setLevel(log_level)
        console_handler.setFormatter(formatter)
        
        # Setup file handler if configured
        handlers = [console_handler]
        if self.config.log_file:
            file_handler = logging.FileHandler(self.config.log_file)
            file_handler.setLevel(log_level)
            file_handler.setFormatter(formatter)
            handlers.append(file_handler)
        
        # Configure root logger
        logging.basicConfig(
            level=log_level,
            handlers=handlers,
            force=True
        )
    
    async def scrape_url(self, url: str, parser_type: Optional[str] = None) -> Dict[str, Any]:
        """
        Scrape a single URL and extract product data.
        
        Args:
            url: URL to scrape
            parser_type: Optional parser type to use
            
        Returns:
            Dictionary containing extracted data
        """
        logger.info(f"Starting scrape of URL: {url}")
        
        try:
            # Get appropriate parser
            parser = self.parser_factory.get_parser(url, parser_type)
            
            # Extract data using browser
            raw_data = await self.browser_manager.extract_data(url, parser.selectors)
            
            # Parse the data
            parsed_data = parser.parse(raw_data)
            
            # Add metadata
            parsed_data.update({
                "source_url": url,
                "scraped_at": asyncio.get_event_loop().time(),
                "scraper_version": self.config.version,
                "parser_type": parser.__class__.__name__
            })
            
            logger.info(f"Successfully scraped {len(parsed_data.get('items', []))} items")
            return parsed_data
            
        except Exception as e:
            logger.error(f"Error scraping URL {url}: {str(e)}")
            raise
    
    async def scrape_multiple(self, urls: List[str], parser_type: Optional[str] = None) -> List[Dict[str, Any]]:
        """
        Scrape multiple URLs concurrently.
        
        Args:
            urls: List of URLs to scrape
            parser_type: Optional parser type to use
            
        Returns:
            List of dictionaries containing extracted data
        """
        logger.info(f"Starting batch scrape of {len(urls)} URLs")
        
        # Create semaphore to limit concurrent requests
        semaphore = asyncio.Semaphore(self.config.concurrent_requests)
        
        async def scrape_with_semaphore(url: str) -> Dict[str, Any]:
            async with semaphore:
                await asyncio.sleep(self.config.rate_limit_delay)
                return await self.scrape_url(url, parser_type)
        
        # Execute scraping tasks
        tasks = [scrape_with_semaphore(url) for url in urls]
        results = await asyncio.gather(*tasks, return_exceptions=True)
        
        # Filter successful results
        successful_results = []
        failed_count = 0
        
        for result in results:
            if isinstance(result, Exception):
                logger.error(f"Failed to scrape URL: {str(result)}")
                failed_count += 1
            else:
                successful_results.append(result)
        
        logger.info(f"Batch scrape completed: {len(successful_results)} successful, {failed_count} failed")
        return successful_results
    
    async def save_to_storage(self, data: Dict[str, Any]) -> bool:
        """
        Save extracted data to configured storage.
        
        Args:
            data: Data to save
            
        Returns:
            True if successful, False otherwise
        """
        if not self.storage:
            logger.warning("No storage configured, skipping save")
            return False
        
        try:
            success = await self.storage.save(data)
            if success:
                logger.info("Data successfully saved to storage")
            else:
                logger.error("Failed to save data to storage")
            return success
        except Exception as e:
            logger.error(f"Error saving to storage: {str(e)}")
            return False
    
    async def run_full_pipeline(self, urls: List[str], save_to_storage: bool = True) -> List[Dict[str, Any]]:
        """
        Run the complete scraping pipeline: extract and optionally save.
        
        Args:
            urls: List of URLs to scrape
            save_to_storage: Whether to save results to storage
            
        Returns:
            List of extracted data
        """
        logger.info("Starting full scraping pipeline")
        
        # Extract data
        results = await self.scrape_multiple(urls)
        
        # Save to storage if configured
        if save_to_storage:
            for result in results:
                await self.save_to_storage(result)
        
        logger.info("Full pipeline completed successfully")
        return results
    
    def close(self) -> None:
        """Clean up resources."""
        if self.browser_manager:
            self.browser_manager.close()
        logger.info("Scraper resources cleaned up")
    
    async def __aenter__(self):
        """Async context manager entry."""
        return self
    
    async def __aexit__(self, exc_type, exc_val, exc_tb):
        """Async context manager exit."""
        self.close()
