"""
Storage module for Bio Cattaleya.

Contains storage backends for data persistence.
"""

from .notion import NotionStorage
from .base import BaseStorage

__all__ = ["NotionStorage", "BaseStorage"]
