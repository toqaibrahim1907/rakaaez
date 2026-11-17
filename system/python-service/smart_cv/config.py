"""
Configuration and environment setup for Smart CV Parser.
Handles automatic detection of Tesseract OCR, model weights, and system defaults.
"""

import os
import shutil
import logging
from pathlib import Path
import pytesseract

logger = logging.getLogger("smart_cv.config")

# Project Root
BASE_DIR = Path(__file__).resolve().parent.parent
MODELS_DIR = BASE_DIR / "models"
YUNET_MODEL_PATH = MODELS_DIR / "face_detection_yunet_2023mar.onnx"

# Common Windows locations for Tesseract-OCR
TESSERACT_CANDIDATE_PATHS = [
    os.environ.get("TESSERACT_CMD"),
    r"C:\Program Files\Tesseract-OCR\tesseract.exe",
    r"C:\Program Files (x86)\Tesseract-OCR\tesseract.exe",
    os.path.expandvars(r"%LOCALAPPDATA%\Programs\Tesseract-OCR\tesseract.exe"),
]


def setup_tesseract():
    """
    Automatically detects and configures the Tesseract executable path.
    Returns the resolved path or None if not found.
    """
    # 1. Check if tesseract is already available in PATH
    which_path = shutil.which("tesseract")
    if which_path:
        pytesseract.pytesseract.tesseract_cmd = which_path
        logger.debug(f"Tesseract found in system PATH: {which_path}")
        return which_path

    # 2. Check common installation directories on Windows
    for candidate in TESSERACT_CANDIDATE_PATHS:
        if candidate and os.path.isfile(candidate):
            pytesseract.pytesseract.tesseract_cmd = candidate
            logger.debug(f"Tesseract located at: {candidate}")
            return candidate

    logger.warning(
        "Tesseract OCR executable not found in PATH or standard directories. "
        "OCR fallback will be limited."
    )
    return None


# Execute setup upon import
TESSERACT_EXECUTABLE = setup_tesseract()

# Default pipeline parameters
DEFAULT_OCR_DPI = 300
DEFAULT_OCR_LANG = "ara+eng"
MIN_OCR_CHAR_COUNT = 40
CONFIDENCE_THRESHOLD = 0.50
