"""
Bio Cattaleya Scraper - Professional Web Scraping Library

A comprehensive web scraping solution for e-commerce data extraction
with support for multiple platforms and advanced data processing.
"""

__version__ = "4.3.0"
__author__ = "Emily"
__email__ = "emily9991@example.com"

from .config import Settings
from .scraper.main import BioCattaleyaScraper
from .parsers.base import BaseParser
from .storage.notion import NotionStorage

__all__ = [
    "Settings",
    "BioCattaleyaScraper", 
    "BaseParser",
    "NotionStorage",
]
