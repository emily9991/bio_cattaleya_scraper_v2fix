"""
Browser management for Bio Cattaleya Scraper.

Handles browser automation, page navigation, and element extraction.
"""

import asyncio
import logging
from typing import Dict, List, Optional, Any
from pathlib import Path

try:
    from selenium import webdriver
    from selenium.webdriver.common.by import By
    from selenium.webdriver.support.ui import WebDriverWait
    from selenium.webdriver.support import expected_conditions as EC
    from selenium.webdriver.chrome.options import Options
    from selenium.common.exceptions import TimeoutException, WebDriverException
except ImportError:
    webdriver = None

from ..config import settings


logger = logging.getLogger(__name__)


class BrowserManager:
    """Manages browser instances and web interactions."""
    
    def __init__(self, config: settings):
        """Initialize browser manager with configuration."""
        self.config = config
        self.driver: Optional[Any] = None
        self._setup_browser()
    
    def _setup_browser(self) -> None:
        """Configure and initialize the browser."""
        if not webdriver:
            raise ImportError("Selenium is required for browser automation. Install with: pip install selenium")
        
        options = Options()
        
        # Basic options
        if self.config.headless:
            options.add_argument("--headless")
        
        options.add_argument("--no-sandbox")
        options.add_argument("--disable-dev-shm-usage")
        options.add_argument("--disable-gpu")
        options.add_argument("--window-size=1920,1080")
        
        # User agent
        options.add_argument(f"--user-agent={self.config.user_agent}")
        
        # Performance options
        options.add_argument("--disable-extensions")
        options.add_argument("--disable-plugins")
        options.add_argument("--disable-images")
        options.add_argument("--disable-javascript")  # Can be enabled if needed
        
        try:
            self.driver = webdriver.Chrome(options=options)
            self.driver.set_page_load_timeout(self.config.browser_timeout)
            logger.info("Browser initialized successfully")
        except WebDriverException as e:
            logger.error(f"Failed to initialize browser: {str(e)}")
            raise
    
    async def extract_data(self, url: str, selectors: Dict[str, str]) -> Dict[str, Any]:
        """
        Extract data from a URL using CSS selectors.
        
        Args:
            url: URL to extract data from
            selectors: Dictionary of field names to CSS selectors
            
        Returns:
            Dictionary containing extracted data
        """
        if not self.driver:
            raise RuntimeError("Browser not initialized")
        
        logger.info(f"Extracting data from: {url}")
        
        try:
            # Navigate to URL
            self.driver.get(url)
            
            # Wait for page to load
            WebDriverWait(self.driver, self.config.browser_timeout).until(
                EC.presence_of_element_located((By.TAG_NAME, "body"))
            )
            
            # Extract data using selectors
            extracted_data = {}
            
            for field_name, selector in selectors.items():
                try:
                    elements = self.driver.find_elements(By.CSS_SELECTOR, selector)
                    
                    if not elements:
                        extracted_data[field_name] = None
                        continue
                    
                    # Handle multiple elements
                    if len(elements) == 1:
                        element = elements[0]
                        extracted_data[field_name] = self._extract_element_value(element)
                    else:
                        extracted_data[field_name] = [
                            self._extract_element_value(el) for el in elements
                        ]
                
                except Exception as e:
                    logger.warning(f"Failed to extract {field_name} with selector {selector}: {str(e)}")
                    extracted_data[field_name] = None
            
            # Add page metadata
            extracted_data["page_metadata"] = {
                "url": url,
                "title": self.driver.title,
                "current_url": self.driver.current_url,
                "timestamp": asyncio.get_event_loop().time()
            }
            
            logger.info(f"Successfully extracted {len([v for v in extracted_data.values() if v])} fields")
            return extracted_data
            
        except TimeoutException:
            logger.error(f"Timeout while loading page: {url}")
            raise
        except Exception as e:
            logger.error(f"Error extracting data from {url}: {str(e)}")
            raise
    
    def _extract_element_value(self, element: Any) -> str:
        """
        Extract the appropriate value from a web element.
        
        Args:
            element: Selenium WebElement
            
        Returns:
            Extracted text or attribute value
        """
        # Try different attributes in order of preference
        for attr in ["text", "value", "href", "src", "alt", "title"]:
            try:
                value = getattr(element, attr, None)
                if value and attr == "text":
                    return value.strip()
                elif value and attr != "text":
                    return value
            except Exception:
                continue
        
        # Fallback to inner text
        try:
            return element.get_attribute("innerText") or ""
        except Exception:
            return ""
    
    async def wait_for_element(self, selector: str, timeout: Optional[int] = None) -> bool:
        """
        Wait for an element to appear on the page.
        
        Args:
            selector: CSS selector to wait for
            timeout: Optional timeout in seconds
            
        Returns:
            True if element appeared, False otherwise
        """
        if not self.driver:
            return False
        
        timeout = timeout or self.config.browser_timeout
        
        try:
            WebDriverWait(self.driver, timeout).until(
                EC.presence_of_element_located((By.CSS_SELECTOR, selector))
            )
            return True
        except TimeoutException:
            return False
    
    async def scroll_to_bottom(self, delay: float = 1.0) -> None:
        """Scroll to the bottom of the page."""
        if not self.driver:
            return
        
        # Execute JavaScript to scroll
        self.driver.execute_script("window.scrollTo(0, document.body.scrollHeight);")
        
        # Wait for content to load
        await asyncio.sleep(delay)
    
    async def take_screenshot(self, filename: str) -> bool:
        """
        Take a screenshot of the current page.
        
        Args:
            filename: Path to save screenshot
            
        Returns:
            True if successful, False otherwise
        """
        if not self.driver:
            return False
        
        try:
            self.driver.save_screenshot(filename)
            logger.info(f"Screenshot saved to: {filename}")
            return True
        except Exception as e:
            logger.error(f"Failed to take screenshot: {str(e)}")
            return False
    
    def get_page_source(self) -> str:
        """Get the current page's HTML source."""
        if not self.driver:
            return ""
        return self.driver.page_source
    
    def close(self) -> None:
        """Close the browser and clean up resources."""
        if self.driver:
            try:
                self.driver.quit()
                logger.info("Browser closed successfully")
            except Exception as e:
                logger.error(f"Error closing browser: {str(e)}")
            finally:
                self.driver = None
