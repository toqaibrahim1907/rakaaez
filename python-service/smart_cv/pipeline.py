"""
Main Smart CV Extraction Pipeline.
Coordinates classification, PyMuPDF extraction, Tesseract OCR,
intelligent spatial field matching, worker photo extraction, and validation.
"""

import os
import json
import logging
from pathlib import Path
from typing import Dict, Any, Optional

import fitz

from .config import setup_tesseract
from .pdf_classifier import classify_pdf, DocumentType, PageType
from .ocr_engine import run_ocr_on_page
from .text_extractor import extract_native_page_data, merge_native_and_ocr
from .field_extractor import extract_all_fields
from .photo_extractor import extract_worker_photos, FaceDetector
from .validator import validate_extraction

logger = logging.getLogger("smart_cv.pipeline")


class SmartCVParser:
    """Production-grade multi-stage CV parser for domestic worker recruitment."""

    def __init__(self, output_dir: Optional[str] = None):
        setup_tesseract()
        self.output_dir = Path(output_dir) if output_dir else Path("extracted_output")
        self.face_detector = FaceDetector()

    def parse(self, pdf_path: str, save_json: bool = True) -> Dict[str, Any]:
        """
        Processes a CV PDF through all pipeline stages and returns the structured result.
        """
        pdf_file = Path(pdf_path)
        if not pdf_file.is_file():
            raise FileNotFoundError(f"PDF file not found: {pdf_path}")

        doc_output_dir = self.output_dir / pdf_file.stem
        os.makedirs(str(doc_output_dir), exist_ok=True)

        try:
            doc = fitz.open(str(pdf_file))
        except Exception as e:
            logger.error(f"Failed to open PDF '{pdf_path}': {e}")
            return {
                "salary": None, "nationality": None, "religion": None, "age": None,
                "job": None, "passport_number": None, "experience": None, "worker_photo": None,
                "confidence": {
                    "salary": 0, "nationality": 0, "religion": 0, "age": 0,
                    "job": 0, "passport_number": 0, "experience": 0, "worker_photo": 0
                },
                "candidate_photos": [],
                "warnings": [f"Corrupted or invalid PDF file: {str(e)}"]
            }

        try:
            # Stage A: Classify Document
            classification = classify_pdf(doc)
            doc_type = classification["document_type"]
            logger.info(f"Classified '{pdf_file.name}' as {doc_type} ({classification['total_pages']} pages).")

            # Stage B & C: Extract and Merge Text
            combined_tokens = []
            combined_text_parts = []

            for page_idx, page in enumerate(doc):
                page_info = classification["page_details"][page_idx]
                p_type = page_info["page_type"]

                native_data = extract_native_page_data(page)

                # Run OCR if page is scanned, hybrid, or if critical text fields might be in raster elements
                if p_type in [PageType.SCANNED, PageType.HYBRID] or doc_type == DocumentType.HYBRID_MIXED:
                    is_scanned = (p_type == PageType.SCANNED)
                    ocr_data = run_ocr_on_page(page, is_scanned=is_scanned)
                    merged = merge_native_and_ocr(native_data, ocr_data)
                else:
                    merged = native_data
                    merged["ocr_added_count"] = 0

                combined_tokens.extend(merged.get("tokens", []))
                combined_text_parts.append(merged.get("full_text", ""))

            full_document_text = "\n".join(combined_text_parts)

            # Stage D: Field Matching
            raw_fields_result = extract_all_fields(full_document_text, combined_tokens)

            # Stage 4: Worker Photo Extraction
            photo_result = extract_worker_photos(
                doc,
                output_dir=doc_output_dir,
                face_detector=self.face_detector,
            )

            # Stage 5: Validation & Quality Assurance
            final_data = validate_extraction(raw_fields_result, photo_result)

            # Save JSON output if requested
            if save_json:
                json_path = doc_output_dir / "worker_data.json"
                with open(json_path, "w", encoding="utf-8") as f:
                    json.dump(final_data, f, ensure_ascii=False, indent=4)
                logger.info(f"Saved extraction result to: {json_path}")

            return final_data

        finally:
            doc.close()
