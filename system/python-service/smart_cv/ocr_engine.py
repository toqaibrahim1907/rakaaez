"""
Stage C: Optical Character Recognition (OCR) Engine.
Handles image preprocessing (deskewing, noise reduction, contrast enhancement),
high-resolution page rendering (300 DPI), and Tesseract OCR for Arabic & English.
"""

import math
import logging
from typing import Dict, List, Any, Tuple, Optional
import numpy as np
import cv2
from PIL import Image
import pytesseract
import fitz

from .config import DEFAULT_OCR_DPI, DEFAULT_OCR_LANG, TESSERACT_EXECUTABLE

logger = logging.getLogger("smart_cv.ocr")


def preprocess_image(image_bgr: np.ndarray, is_scanned: bool = False) -> np.ndarray:
    """
    Applies image preprocessing pipeline tailored to page type.
    For digital/hybrid pages, preserves high-fidelity grayscale.
    For scanned pages, applies deskewing and contrast optimization.
    """
    if len(image_bgr.shape) == 3:
        gray = cv2.cvtColor(image_bgr, cv2.COLOR_BGR2GRAY)
    else:
        gray = image_bgr.copy()

    if not is_scanned:
        # Digital / hybrid documents have clean rendered text; avoid destructive thresholding
        return gray

    # For scanned documents:
    # 1. CLAHE Contrast Enhancement
    clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8))
    enhanced = clahe.apply(gray)

    # 2. Deskewing
    deskewed = deskew_image(enhanced)

    return deskewed


def deskew_image(gray: np.ndarray) -> np.ndarray:
    """
    Detects document skew angle and corrects it if significant.
    """
    try:
        # Otsu threshold to get binary foreground
        _, thresh = cv2.threshold(gray, 0, 255, cv2.THRESH_BINARY_INV + cv2.THRESH_OTSU)
        coords = np.column_stack(np.where(thresh > 0))
        if len(coords) < 100:
            return gray

        # Compute minimum area bounding box
        rect = cv2.minAreaRect(coords)
        angle = rect[-1]

        # Normalize angle
        if angle < -45:
            angle = -(90 + angle)
        else:
            angle = -angle

        # Only correct moderate skew (between 0.5 and 20 degrees)
        if 0.5 <= abs(angle) <= 20.0:
            h, w = gray.shape[:2]
            center = (w // 2, h // 2)
            rot_mat = cv2.getRotationMatrix2D(center, angle, 1.0)
            rotated = cv2.warpAffine(
                gray,
                rot_mat,
                (w, h),
                flags=cv2.INTER_CUBIC,
                borderMode=cv2.BORDER_REPLICATE,
            )
            return rotated
    except Exception as e:
        logger.debug(f"Deskew skipped: {e}")

    return gray


def render_page_to_numpy(page: fitz.Page, dpi: int = DEFAULT_OCR_DPI) -> Tuple[np.ndarray, float, float]:
    """
    Renders a PyMuPDF page to an OpenCV BGR numpy array at specified DPI.
    Returns (image_bgr, scale_x, scale_y) where scale converts image pixels to PDF points.
    """
    pix = page.get_pixmap(dpi=dpi, alpha=False)
    img = np.frombuffer(pix.samples, dtype=np.uint8).reshape((pix.height, pix.width, pix.n))
    if pix.n == 3:
        # RGB to BGR
        img_bgr = cv2.cvtColor(img, cv2.COLOR_RGB2BGR)
    elif pix.n == 1:
        img_bgr = cv2.cvtColor(img, cv2.COLOR_GRAY2BGR)
    else:
        img_bgr = img

    scale_x = page.rect.width / max(1.0, pix.width)
    scale_y = page.rect.height / max(1.0, pix.height)

    return img_bgr, scale_x, scale_y


def run_ocr_on_page(
    page: fitz.Page,
    lang: str = DEFAULT_OCR_LANG,
    dpi: int = DEFAULT_OCR_DPI,
    psm: int = 6,
    is_scanned: bool = False,
) -> Dict[str, Any]:
    """
    Performs OCR on a PDF page and returns:
    - full_text: string of recognized text
    - tokens: list of token dicts with text, confidence (0.0-1.0), and PDF-point coordinates (x0, y0, x1, y1)
    """
    if not TESSERACT_EXECUTABLE:
        logger.warning("Tesseract OCR is not configured. Skipping OCR.")
        return {"full_text": "", "tokens": [], "confidence": 0.0}

    img_bgr, scale_x, scale_y = render_page_to_numpy(page, dpi=dpi)
    preprocessed = preprocess_image(img_bgr, is_scanned=is_scanned)

    config = f"--psm {psm}"

    try:
        # Full text extraction
        full_text = pytesseract.image_to_string(
            preprocessed,
            lang=lang,
            config=config,
        )

        # Detailed word-level boxes and confidences
        ocr_data = pytesseract.image_to_data(
            preprocessed,
            lang=lang,
            config=config,
            output_type=pytesseract.Output.DICT,
        )

        tokens = []
        conf_sum = 0.0
        conf_count = 0

        num_items = len(ocr_data["text"])
        for i in range(num_items):
            word = ocr_data["text"][i].strip()
            conf = float(ocr_data["conf"][i])

            if not word or conf < 0:
                continue

            conf_normalized = conf / 100.0
            conf_sum += conf_normalized
            conf_count += 1

            left = float(ocr_data["left"][i])
            top = float(ocr_data["top"][i])
            w = float(ocr_data["width"][i])
            h = float(ocr_data["height"][i])

            # Convert to PDF coordinates
            pdf_x0 = left * scale_x
            pdf_y0 = top * scale_y
            pdf_x1 = (left + w) * scale_x
            pdf_y1 = (top + h) * scale_y

            tokens.append({
                "text": word,
                "confidence": conf_normalized,
                "bbox": (pdf_x0, pdf_y0, pdf_x1, pdf_y1),
                "line_num": ocr_data["line_num"][i],
                "block_num": ocr_data["block_num"][i],
                "source": "ocr",
            })

        avg_confidence = (conf_sum / max(1, conf_count)) if conf_count > 0 else 0.0

        return {
            "full_text": full_text,
            "tokens": tokens,
            "confidence": avg_confidence,
        }

    except Exception as e:
        logger.error(f"Error during OCR execution: {e}")
        return {"full_text": "", "tokens": [], "confidence": 0.0}
