"""
Stage 4: Worker Photo Extraction Engine.
Extracts embedded images and scans rendered page regions to locate human faces.
Distinguishes the primary worker portrait from:
- Full body photographs
- Scanned passport pages / passport photos
- Company logos, stamps, and icons

Returns the best worker portrait, saves it to disk, and lists all candidate photos.
"""

import os
import logging
from typing import Dict, List, Any, Optional, Tuple
from pathlib import Path
import cv2
import numpy as np
import fitz

from .config import YUNET_MODEL_PATH

logger = logging.getLogger("smart_cv.photos")


class FaceDetector:
    """Wrapper around OpenCV YuNet deep learning face detector."""

    def __init__(self, model_path: Optional[Path] = None):
        self.model_path = model_path or YUNET_MODEL_PATH
        self.detector = None
        self._initialize()

    def _initialize(self):
        if not os.path.isfile(str(self.model_path)):
            logger.warning(f"YuNet model not found at {self.model_path}. Face detection disabled.")
            return

        try:
            # Initialize with standard input size; dynamically updated per image
            self.detector = cv2.FaceDetectorYN.create(
                str(self.model_path),
                "",
                (320, 320),
                score_threshold=0.6,
                nms_threshold=0.3,
                top_k=5000,
            )
            logger.debug("YuNet face detector initialized successfully.")
        except Exception as e:
            logger.error(f"Failed to initialize YuNet face detector: {e}")
            self.detector = None

    def detect(self, img_bgr: np.ndarray) -> List[Dict[str, Any]]:
        """Runs face detection on an OpenCV BGR image."""
        if self.detector is None or img_bgr is None:
            return []

        h, w = img_bgr.shape[:2]
        if w < 20 or h < 20:
            return []

        try:
            self.detector.setInputSize((w, h))
            _, faces = self.detector.detect(img_bgr)
            if faces is None:
                return []

            results = []
            for f in faces:
                x, y, fw, fh = f[0], f[1], f[2], f[3]
                conf = float(f[-1])
                results.append({
                    "bbox": (float(x), float(y), float(fw), float(fh)),
                    "confidence": conf,
                    "relative_area": (fw * fh) / max(1.0, w * h),
                })
            return results
        except Exception as e:
            logger.error(f"Error during face detection: {e}")
            return []


def classify_candidate(
    img_bgr: np.ndarray,
    faces: List[Dict[str, Any]],
    page_num: int,
    page_bbox: Optional[Tuple[float, float, float, float]] = None,
) -> Tuple[str, float]:
    """
    Classifies an image candidate into:
    - 'portrait' (Worker main headshot)
    - 'full_body' (Standing worker photo)
    - 'passport_copy' (Scanned passport document / passport photo)
    - 'non_human' (Logo, stamp, graphic)
    Returns (classification, score).
    """
    if not faces:
        return "non_human", 0.0

    h, w = img_bgr.shape[:2]
    aspect_ratio = w / max(1.0, h)
    best_face = max(faces, key=lambda f: f["confidence"])
    face_ratio = best_face["relative_area"]

    # Case 1: Huge document scan (e.g. passport copy on page 2)
    if (w > 1000 and h > 1200 and face_ratio < 0.06) or page_num > 1:
        # If on page 2 or higher and tiny face ratio, it's typically passport bio page
        return "passport_copy", 0.35

    # Case 2: Full-body photo (tall aspect ratio, small face relative area)
    if aspect_ratio < 0.55 and face_ratio < 0.10:
        return "full_body", 0.75

    # Case 3: Primary portrait (aspect ratio ~0.7 to 1.25, prominent face area 10% - 60%)
    if 0.60 <= aspect_ratio <= 1.30 and 0.09 <= face_ratio <= 0.65:
        # Ideal portrait photo
        return "portrait", 0.95

    # Moderate portrait
    if face_ratio >= 0.07:
        return "portrait", 0.85

    return "passport_copy", 0.40


def extract_worker_photos(
    doc: fitz.Document,
    output_dir: Path,
    face_detector: Optional[FaceDetector] = None,
) -> Dict[str, Any]:
    """
    Extracts all candidate photos, classifies them, saves them,
    and identifies the top worker portrait.
    """
    if face_detector is None:
        face_detector = FaceDetector()

    os.makedirs(str(output_dir), exist_ok=True)
    candidates: List[Dict[str, Any]] = []

    # 1. Extract embedded image objects
    for page_idx in range(len(doc)):
        page = doc[page_idx]
        image_infos = page.get_image_info(xrefs=True)

        for img_info in image_infos:
            xref = img_info["xref"]
            bbox = img_info.get("bbox")
            try:
                base_img = doc.extract_image(xref)
                if not base_img:
                    continue

                img_bytes = base_img["image"]
                ext = base_img["ext"]
                arr = np.frombuffer(img_bytes, dtype=np.uint8)
                img_bgr = cv2.imdecode(arr, cv2.IMREAD_COLOR)
                if img_bgr is None:
                    continue

                faces = face_detector.detect(img_bgr)
                if not faces:
                    continue

                h, w = img_bgr.shape[:2]

                # Special Handling: If this image is a full scanned page (w > 800 and h > 1000)
                if (w > 800 and h > 1000) and faces:
                    if page_idx == 0:
                        # Page 1 scanned CV: crop the worker portrait from the document
                        for f_idx, f in enumerate(faces):
                            fx, fy, fw, fh = f["bbox"]
                            pad_x = int(fw * 0.45)
                            pad_y_top = int(fh * 0.6)
                            pad_y_bot = int(fh * 0.9)
                            cx0 = max(0, int(fx - pad_x))
                            cy0 = max(0, int(fy - pad_y_top))
                            cx1 = min(w, int(fx + fw + pad_x))
                            cy1 = min(h, int(fy + fh + pad_y_bot))
                            crop = img_bgr[cy0:cy1, cx0:cx1]
                            if crop.size > 0:
                                crop_filename = f"candidate_p1_crop_portrait_{f_idx+1}.jpg"
                                crop_path = output_dir / crop_filename
                                cv2.imwrite(str(crop_path), crop)
                                crop_bytes = cv2.imencode(".jpg", crop)[1].tobytes()
                                candidates.append({
                                    "path": str(crop_path.relative_to(output_dir.parent) if output_dir.parent in crop_path.parents else crop_filename),
                                    "absolute_path": str(crop_path),
                                    "filename": crop_filename,
                                    "type": "portrait",
                                    "score": 0.92,
                                    "page": 1,
                                    "dimensions": [crop.shape[1], crop.shape[0]],
                                    "faces_found": 1,
                                    "best_face_confidence": round(f["confidence"], 2),
                                    "image_bytes": crop_bytes,
                                    "ext": "jpg",
                                })
                        continue
                    else:
                        # Page 2+ scanned document: passport copy
                        cand_type = "passport_copy"
                        cand_score = 0.35
                else:
                    cand_type, cand_score = classify_candidate(
                        img_bgr, faces, page_num=page_idx + 1, page_bbox=bbox
                    )

                cand_filename = f"candidate_p{page_idx+1}_xref{xref}_{cand_type}.{ext}"
                cand_path = output_dir / cand_filename

                # Save candidate image
                with open(cand_path, "wb") as f:
                    f.write(img_bytes)

                candidates.append({
                    "path": str(cand_path.relative_to(output_dir.parent) if output_dir.parent in cand_path.parents else cand_filename),
                    "absolute_path": str(cand_path),
                    "filename": cand_filename,
                    "type": cand_type,
                    "score": cand_score,
                    "page": page_idx + 1,
                    "dimensions": [base_img["width"], base_img["height"]],
                    "faces_found": len(faces),
                    "best_face_confidence": round(faces[0]["confidence"], 2),
                    "image_bytes": img_bytes,
                    "ext": ext,
                })
            except Exception as e:
                logger.error(f"Error processing image xref {xref}: {e}")

    # 2. Fallback: If no candidate embedded images found, inspect rendered page
    if not candidates:
        logger.debug("No embedded face images found. Inspecting rendered page 1.")
        try:
            page = doc[0]
            pix = page.get_pixmap(dpi=300, alpha=False)
            arr = np.frombuffer(pix.samples, dtype=np.uint8).reshape((pix.height, pix.width, pix.n))
            page_bgr = cv2.cvtColor(arr, cv2.COLOR_RGB2BGR) if pix.n == 3 else arr

            faces = face_detector.detect(page_bgr)
            for idx, f in enumerate(faces):
                fx, fy, fw, fh = f["bbox"]
                # Expand box with margins for head and shoulders
                pad_x = int(fw * 0.4)
                pad_y = int(fh * 0.6)
                h, w = page_bgr.shape[:2]
                crop_x0 = max(0, int(fx - pad_x))
                crop_y0 = max(0, int(fy - pad_y))
                crop_x1 = min(w, int(fx + fw + pad_x))
                crop_y1 = min(h, int(fy + fh + pad_y * 1.5))

                crop = page_bgr[crop_y0:crop_y1, crop_x0:crop_x1]
                if crop.size > 0:
                    cand_filename = f"scanned_face_p1_{idx+1}.jpg"
                    cand_path = output_dir / cand_filename
                    cv2.imwrite(str(cand_path), crop)

                    candidates.append({
                        "path": str(cand_path.relative_to(output_dir.parent) if output_dir.parent in cand_path.parents else cand_filename),
                        "absolute_path": str(cand_path),
                        "filename": cand_filename,
                        "type": "portrait",
                        "score": 0.88,
                        "page": 1,
                        "dimensions": [crop.shape[1], crop.shape[0]],
                        "faces_found": 1,
                        "best_face_confidence": round(f["confidence"], 2),
                        "image_bytes": cv2.imencode(".jpg", crop)[1].tobytes(),
                        "ext": "jpg",
                    })
        except Exception as e:
            logger.error(f"Error inspecting rendered page for faces: {e}")

    # Sort candidates by score descending
    candidates.sort(key=lambda c: c["score"], reverse=True)

    # Select primary worker photo
    worker_photo_path = None
    worker_photo_conf = 0.0

    # Only select if top candidate is a legitimate portrait or full body (never passport copy)
    if candidates and candidates[0]["type"] in ["portrait", "full_body"] and candidates[0]["score"] >= 0.70:
        top_cand = candidates[0]
        # Save as standard worker_photo.jpg or worker_photo.png
        final_ext = top_cand["ext"]
        primary_filename = f"worker_photo.{final_ext}"
        primary_path = output_dir / primary_filename
        with open(primary_path, "wb") as f:
            f.write(top_cand["image_bytes"])

        # Relative path for schema
        worker_photo_path = str(primary_path.relative_to(output_dir.parent) if output_dir.parent in primary_path.parents else primary_filename)
        worker_photo_conf = top_cand["score"]

    # Format candidates list for output schema
    sanitized_candidates = []
    for c in candidates:
        sanitized_candidates.append({
            "path": c["path"],
            "type": c["type"],
            "score": round(c["score"], 2),
            "page": c["page"],
            "dimensions": c["dimensions"],
            "faces_found": c["faces_found"],
        })

    return {
        "worker_photo": worker_photo_path,
        "confidence": worker_photo_conf,
        "candidate_photos": sanitized_candidates,
    }
