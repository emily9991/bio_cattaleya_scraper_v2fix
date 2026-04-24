"""
Parser factory for Bio Cattaleya Scraper.

Manages parser creation and selection based on URL patterns.
"""

import logging
from typing import Dict, List, Optional, Type
from urllib.parse import urlparse

from .base import BaseParser
from .tmall import TmallParser
from .taobao import TaobaoParser
from .amazon import AmazonParser


logger = logging.getLogger(__name__)


class ParserFactory:
    """Factory class for creating and managing parsers."""
    
    def __init__(self):
        """Initialize parser factory with available parsers."""
        self._parsers: Dict[str, Type[BaseParser]] = {}
        self._domain_mapping: Dict[str, str] = {}
        self._register_default_parsers()
    
    def _register_default_parsers(self) -> None:
        """Register default parsers with their supported domains."""
        # Register parsers
        self.register_parser("tmall", TmallParser)
        self.register_parser("taobao", TaobaoParser)
        self.register_parser("amazon", AmazonParser)
        
        # Map domains to parsers
        self.map_domain("tmall.com", "tmall")
        self.map_domain("taobao.com", "taobao")
        self.map_domain("amazon.com", "amazon")
        self.map_domain("amazon.co.uk", "amazon")
        self.map_domain("amazon.de", "amazon")
        self.map_domain("amazon.fr", "amazon")
        self.map_domain("amazon.it", "amazon")
        self.map_domain("amazon.es", "amazon")
    
    def register_parser(self, name: str, parser_class: Type[BaseParser]) -> None:
        """
        Register a parser class.
        
        Args:
            name: Parser name
            parser_class: Parser class
        """
        self._parsers[name] = parser_class
        logger.info(f"Registered parser: {name}")
    
    def map_domain(self, domain: str, parser_name: str) -> None:
        """
        Map a domain to a parser.
        
        Args:
            domain: Domain name
            parser_name: Parser name
        """
        self._domain_mapping[domain.lower()] = parser_name
        logger.info(f"Mapped domain {domain} to parser {parser_name}")
    
    def get_parser(self, url: str, parser_type: Optional[str] = None) -> BaseParser:
        """
        Get appropriate parser for a URL.
        
        Args:
            url: URL to parse
            parser_type: Optional specific parser type
            
        Returns:
            Parser instance
            
        Raises:
            ValueError: If no suitable parser is found
        """
        if parser_type:
            return self._create_parser(parser_type)
        
        # Auto-detect parser from URL
        domain = urlparse(url).netloc.lower()
        
        # Extract main domain (remove subdomains)
        domain_parts = domain.split('.')
        if len(domain_parts) >= 2:
            main_domain = '.'.join(domain_parts[-2:])
        else:
            main_domain = domain
        
        # Find matching parser
        parser_name = None
        
        # Try exact domain match first
        if domain in self._domain_mapping:
            parser_name = self._domain_mapping[domain]
        elif main_domain in self._domain_mapping:
            parser_name = self._domain_mapping[main_domain]
        else:
            # Try partial matches
            for mapped_domain, name in self._domain_mapping.items():
                if mapped_domain in domain or domain in mapped_domain:
                    parser_name = name
                    break
        
        if not parser_name:
            raise ValueError(f"No parser found for URL: {url}")
        
        return self._create_parser(parser_name)
    
    def _create_parser(self, parser_name: str) -> BaseParser:
        """
        Create parser instance.
        
        Args:
            parser_name: Name of parser to create
            
        Returns:
            Parser instance
            
        Raises:
            ValueError: If parser is not registered
        """
        if parser_name not in self._parsers:
            raise ValueError(f"Unknown parser: {parser_name}")
        
        parser_class = self._parsers[parser_name]
        return parser_class()
    
    def get_available_parsers(self) -> List[str]:
        """
        Get list of available parser names.
        
        Returns:
            List of parser names
        """
        return list(self._parsers.keys())
    
    def get_supported_domains(self) -> Dict[str, str]:
        """
        Get mapping of supported domains to parsers.
        
        Returns:
            Dictionary mapping domains to parser names
        """
        return self._domain_mapping.copy()
    
    def can_handle_url(self, url: str) -> bool:
        """
        Check if any parser can handle the given URL.
        
        Args:
            url: URL to check
            
        Returns:
            True if URL can be handled, False otherwise
        """
        try:
            self.get_parser(url)
            return True
        except ValueError:
            return False
    
    def get_parser_for_domain(self, domain: str) -> Optional[str]:
        """
        Get parser name for a specific domain.
        
        Args:
            domain: Domain name
            
        Returns:
            Parser name or None if not found
        """
        domain = domain.lower()
        return self._domain_mapping.get(domain)
    
    def list_parsers_with_domains(self) -> Dict[str, List[str]]:
        """
        Get mapping of parsers to their supported domains.
        
        Returns:
            Dictionary mapping parser names to list of domains
        """
        parser_domains = {}
        
        for domain, parser_name in self._domain_mapping.items():
            if parser_name not in parser_domains:
                parser_domains[parser_name] = []
            parser_domains[parser_name].append(domain)
        
        return parser_domains
    
    def validate_parser(self, parser_name: str) -> bool:
        """
        Validate if a parser is properly registered.
        
        Args:
            parser_name: Parser name to validate
            
        Returns:
            True if parser is valid, False otherwise
        """
        if parser_name not in self._parsers:
            return False
        
        try:
            # Try to create an instance
            parser = self._create_parser(parser_name)
            return hasattr(parser, 'parse') and hasattr(parser, 'can_handle_url')
        except Exception:
            return False
    
    def get_parser_info(self, parser_name: str) -> Optional[Dict[str, any]]:
        """
        Get information about a specific parser.
        
        Args:
            parser_name: Parser name
            
        Returns:
            Parser information dictionary or None
        """
        if parser_name not in self._parsers:
            return None
        
        try:
            parser = self._create_parser(parser_name)
            return {
                'name': parser_name,
                'platform': parser.get_platform_name(),
                'supported_domains': parser.get_supported_domains(),
                'selectors': parser.get_selectors(),
                'sample_data': parser.get_sample_data()
            }
        except Exception as e:
            logger.error(f"Error getting parser info for {parser_name}: {str(e)}")
            return None
    
    def get_all_parsers_info(self) -> Dict[str, Dict[str, any]]:
        """
        Get information about all registered parsers.
        
        Returns:
            Dictionary mapping parser names to their information
        """
        parsers_info = {}
        
        for parser_name in self.get_available_parsers():
            info = self.get_parser_info(parser_name)
            if info:
                parsers_info[parser_name] = info
        
        return parsers_info
