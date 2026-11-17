"""
Stage A: PDF Type Detection.
Analyzes whether a PDF is digital, scanned, or a hybrid mixture of text and images.
"""

from enum import Enum
from typing import Dict, List, Any
import fitz


class DocumentType(str, Enum):
    SEARCHABLE_TEXT = "searchable_text"
    SCANNED_IMAGE = "scanned_image"
    HYBRID_MIXED = "hybrid_mixed"


class PageType(str, Enum):
    DIGITAL = "digital"
    SCANNED = "scanned"
    HYBRID = "hybrid"


def analyze_page(page: fitz.Page) -> Dict[str, Any]:
    """
    Analyzes an individual PDF page to determine its text density,
    image area coverage, and rendering nature.
    """
    page_rect = page.rect
    page_area = max(1.0, page_rect.width * page_rect.height)

    raw_text = page.get_text("text").strip()
    char_count = len(raw_text)
    words = page.get_text("words")
    word_count = len(words)

    # Calculate image coverage on page
    images = page.get_image_info(xrefs=True)
    total_img_area = 0.0
    for img in images:
        bbox = img.get("bbox")
        if bbox:
            w = max(0.0, bbox[2] - bbox[0])
            h = max(0.0, bbox[3] - bbox[1])
            total_img_area += (w * h)

    image_coverage = min(1.0, total_img_area / page_area)

    # Classify page type
    # A page with very little text (< 40 chars) and high image coverage is scanned
    if char_count < 40:
        page_type = PageType.SCANNED
    elif image_coverage > 0.40 and char_count > 0:
        # High image coverage (e.g. background scanned template or multiple photos) with some text
        page_type = PageType.HYBRID
    else:
        page_type = PageType.DIGITAL

    return {
        "page_number": page.number + 1,
        "page_type": page_type,
        "char_count": char_count,
        "word_count": word_count,
        "image_count": len(images),
        "image_coverage": image_coverage,
        "rect": (page_rect.x0, page_rect.y0, page_rect.x1, page_rect.y1),
    }


def classify_pdf(doc: fitz.Document) -> Dict[str, Any]:
    """
    Classifies the entire PDF document by evaluating all pages.
    """
    page_reports: List[Dict[str, Any]] = []
    scanned_pages = 0
    hybrid_pages = 0
    digital_pages = 0

    for page in doc:
        rep = analyze_page(page)
        page_reports.append(rep)
        if rep["page_type"] == PageType.SCANNED:
            scanned_pages += 1
        elif rep["page_type"] == PageType.HYBRID:
            hybrid_pages += 1
        else:
            digital_pages += 1

    total_pages = len(page_reports)
    if total_pages == 0:
        doc_type = DocumentType.SCANNED_IMAGE
    elif scanned_pages == total_pages:
        doc_type = DocumentType.SCANNED_IMAGE
    elif digital_pages == total_pages and hybrid_pages == 0:
        doc_type = DocumentType.SEARCHABLE_TEXT
    else:
        # If there is any mixture of scanned, hybrid, or digital pages
        doc_type = DocumentType.HYBRID_MIXED

    return {
        "document_type": doc_type,
        "total_pages": total_pages,
        "scanned_pages": scanned_pages,
        "hybrid_pages": hybrid_pages,
        "digital_pages": digital_pages,
        "page_details": page_reports,
    }
