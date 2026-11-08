"""
Smart CV Parser - Production CV Extraction System for Recruitment Companies.
"""

from .pipeline import SmartCVParser
from .config import setup_tesseract

__all__ = ["SmartCVParser", "setup_tesseract"]
