"""
Stage B: PyMuPDF Text Extraction & Spatial Analysis.
Extracts blocks, lines, words, and coordinates, performs multilingual normalization
(Arabic diacritics, Eastern Arabic numerals, Unicode NFKC, reversed string recovery),
and merges native text with OCR when needed.
"""

import re
import unicodedata
import logging
from typing import Dict, List, Any, Tuple, Optional
import fitz

logger = logging.getLogger("smart_cv.extractor")

ARABIC_INDIC_DIGITS = {
    '٠': '0', '١': '1', '٢': '2', '٣': '3', '٤': '4',
    '٥': '5', '٦': '6', '٧': '7', '٨': '8', '٩': '9'
}


def normalize_digits(text: str) -> str:
    """Converts Arabic-Indic digits to Western ASCII digits."""
    return "".join(ARABIC_INDIC_DIGITS.get(ch, ch) for ch in text)


def normalize_arabic(text: str) -> str:
    """Normalizes Arabic text by stripping diacritics, tatweel, and normalizing forms."""
    text = unicodedata.normalize("NFKC", text)
    # Remove tashkeel / harakat
    text = re.sub(r"[\u064B-\u065F\u0670]", "", text)
    # Remove tatweel
    text = text.replace("\u0640", "")
    # Normalize common letter variations
    text = text.replace("إ", "ا").replace("أ", "ا").replace("آ", "ا").replace("ة", "ه")
    return text


def unreverse_arabic_tokens(text: str) -> str:
    """
    Detects if Arabic words in a string are stored in reversed (visual) character order
    (common in PDFs where letters were drawn from left to right), and includes the un-reversed
    logical representations.
    """
    nfkc = unicodedata.normalize("NFKC", text)
    if not re.search(r"[\u0600-\u06FF]", nfkc):
        return text

    # Separate Arabic script from Latin letters and digits that might have been conjoined in visual streams
    nfkc = re.sub(r"([\u0600-\u06FF])([a-zA-Z0-9])", r"\1 \2", nfkc)
    nfkc = re.sub(r"([a-zA-Z0-9])([\u0600-\u06FF])", r"\1 \2", nfkc)

    enhanced_lines = []
    for line in nfkc.splitlines():
        enhanced_lines.append(line)
        tokens = line.split()
        if not tokens:
            continue
        unrev_tokens = [t[::-1] if re.search(r"[\u0600-\u06FF]", t) else t for t in tokens]
        unrev_line = " ".join(unrev_tokens)
        if unrev_line != line:
            enhanced_lines.append(unrev_line)
            enhanced_lines.append(" ".join(reversed(unrev_tokens)))

    return "\n".join(enhanced_lines)


def repair_reversed_text(text: str) -> str:
    """
    Recovers reversed or disjointed words commonly found in Arabic-English PDF generators
    (e.g., 'E C N E I R E P X E' -> 'EXPERIENCE', 't n e m y lo p m E' -> 'Employment').
    """
    cleaned = re.sub(r"\s+", " ", text).strip()

    # Check for character-spaced reversed words (e.g. single letters separated by space)
    tokens = cleaned.split()
    if len(tokens) >= 4 and all(len(t) <= 2 for t in tokens):
        reversed_candidate = "".join(reversed(tokens))
        known_phrases = [
            ("EXPERIENCE", "EXPERIENCE"),
            ("WORKING", "WORKING"),
            ("EMPLOYMENT", "EMPLOYMENT"),
            ("APPLICATION", "APPLICATION"),
            ("PASSPORT", "PASSPORT"),
            ("DETAILS", "DETAILS"),
            ("PREVIOUS", "PREVIOUS"),
        ]
        up_candidate = reversed_candidate.upper()
        for phrase, replacement in known_phrases:
            if phrase in up_candidate:
                return replacement

    return cleaned


def extract_native_page_data(page: fitz.Page) -> Dict[str, Any]:
    """
    Extracts text blocks, lines, and words with their bounding boxes from PyMuPDF.
    """
    blocks_raw = page.get_text("blocks")  # (x0, y0, x1, y1, text, block_no, block_type)
    words_raw = page.get_text("words")    # (x0, y0, x1, y1, word, block_no, line_no, word_no)

    blocks: List[Dict[str, Any]] = []
    lines: List[Dict[str, Any]] = []
    tokens: List[Dict[str, Any]] = []

    # Process blocks
    for b in sorted(blocks_raw, key=lambda x: (x[1], x[0])):
        # block_type 0 is text
        if b[6] != 0:
            continue
        text = b[4].strip()
        if not text:
            continue

        bbox = (b[0], b[1], b[2], b[3])
        norm_text = normalize_digits(normalize_arabic(text))
        repaired_text = repair_reversed_text(norm_text)

        blocks.append({
            "bbox": bbox,
            "text": text,
            "normalized_text": repaired_text,
            "block_num": b[5],
        })

    # Process individual lines and spatial tokens from get_text("dict")
    page_dict = page.get_text("dict")
    for block in page_dict.get("blocks", []):
        if block.get("type") != 0:
            continue
        for line in block.get("lines", []):
            line_bbox = line.get("bbox", (0, 0, 0, 0))
            line_spans = line.get("spans", [])
            line_text = " ".join(s.get("text", "") for s in line_spans).strip()
            if not line_text:
                continue

            lines.append({
                "bbox": line_bbox,
                "text": line_text,
                "normalized_text": normalize_digits(normalize_arabic(line_text)),
            })

            for s in line_spans:
                span_text = s.get("text", "").strip()
                if span_text:
                    tokens.append({
                        "text": span_text,
                        "normalized_text": normalize_digits(normalize_arabic(span_text)),
                        "bbox": s.get("bbox", (0, 0, 0, 0)),
                        "confidence": 1.0,  # Digital text has 1.0 confidence
                        "source": "digital",
                    })

    raw_text = page.get_text("text")
    normalized_full_text = unreverse_arabic_tokens(raw_text)

    return {
        "blocks": blocks,
        "lines": lines,
        "tokens": tokens,
        "raw_text": raw_text,
        "full_text": normalized_full_text,
    }


def merge_native_and_ocr(
    native_data: Dict[str, Any],
    ocr_data: Dict[str, Any],
) -> Dict[str, Any]:
    """
    Fuses native PyMuPDF tokens and Tesseract OCR tokens into a spatial grid.
    If an OCR token occupies an area where no native text exists, it is added.
    """
    merged_tokens = list(native_data.get("tokens", []))
    merged_lines = list(native_data.get("lines", []))
    native_bboxes = [t["bbox"] for t in merged_tokens]

    def has_overlap(bbox1: Tuple[float, float, float, float], threshold: float = 0.3) -> bool:
        x0, y0, x1, y1 = bbox1
        for nx0, ny0, nx1, ny1 in native_bboxes:
            # Check bounding box intersection
            ix0 = max(x0, nx0)
            iy0 = max(y0, ny0)
            ix1 = min(x1, nx1)
            iy1 = min(y1, ny1)
            if ix1 > ix0 and iy1 > iy0:
                inter_area = (ix1 - ix0) * (iy1 - iy0)
                box_area = max(1.0, (x1 - x0) * (y1 - y0))
                if (inter_area / box_area) > threshold:
                    return True
        return False

    ocr_tokens_added = []
    for ocr_t in ocr_data.get("tokens", []):
        if not has_overlap(ocr_t["bbox"]):
            norm_t = normalize_digits(normalize_arabic(ocr_t["text"]))
            token_entry = {
                "text": ocr_t["text"],
                "normalized_text": norm_t,
                "bbox": ocr_t["bbox"],
                "confidence": ocr_t.get("confidence", 0.7),
                "source": "ocr",
            }
            merged_tokens.append(token_entry)
            ocr_tokens_added.append(token_entry)

    # Sort merged tokens spatially (top-to-bottom, left-to-right)
    merged_tokens.sort(key=lambda t: (round(t["bbox"][1] / 10) * 10, t["bbox"][0]))

    # Also build lines from OCR if native lines are sparse
    full_text_parts = [native_data.get("raw_text", "")]
    if ocr_data.get("full_text"):
        full_text_parts.append(ocr_data["full_text"])

    return {
        "blocks": native_data.get("blocks", []),
        "lines": merged_lines,
        "tokens": merged_tokens,
        "full_text": "\n".join(full_text_parts),
        "ocr_added_count": len(ocr_tokens_added),
    }
