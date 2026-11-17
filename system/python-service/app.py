from __future__ import annotations

import asyncio
import base64
import hashlib
import hmac
import io
import logging
import os
import tempfile
import time
import uuid
from pathlib import Path
from typing import Any
from urllib.parse import urlparse

import fitz
import httpx
import pytesseract
from fastapi import BackgroundTasks, FastAPI, Header, HTTPException, Query
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field
from PIL import Image

from smart_cv import SmartCVParser, setup_tesseract
from smart_cv.data_mapping import normalize_extracted_fields

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("rakaez.cv_service")

APP_SECRET = os.environ.get("CV_EXTRACTION_SECRET", "")
SUPABASE_URL = os.environ.get("SUPABASE_URL", "").rstrip("/")
MAX_PDF_BYTES = 15 * 1024 * 1024
MAX_CANDIDATES = 4
MAX_PREVIEW_BYTES = 280 * 1024
JOB_TTL_SECONDS = 60 * 60
jobs: dict[str, dict[str, Any]] = {}
job_lock = asyncio.Lock()
processing_lock = asyncio.Semaphore(1)

app = FastAPI(title="Rakaez CV Extraction", docs_url=None, redoc_url=None)


class CreateJobRequest(BaseModel):
    signed_url: str = Field(min_length=30, max_length=4096)
    file_name: str = Field(min_length=1, max_length=240)
    requested_by: str = Field(min_length=10, max_length=80)


def require_service_secret(authorization: str | None) -> None:
    expected = f"Bearer {APP_SECRET}"
    if not APP_SECRET or not authorization or not hmac.compare_digest(authorization, expected):
        raise HTTPException(status_code=401, detail="unauthorized")


def validate_signed_url(value: str) -> None:
    if not SUPABASE_URL:
        raise HTTPException(status_code=503, detail="service_not_configured")
    supplied = urlparse(value)
    expected = urlparse(SUPABASE_URL)
    if (supplied.scheme != "https" or supplied.netloc != expected.netloc
            or not supplied.path.startswith("/storage/v1/object/sign/website-worker-cvs/")
            or not supplied.query):
        raise HTTPException(status_code=400, detail="invalid_file_reference")


def encode_preview(raw: bytes) -> str | None:
    try:
        image = Image.open(io.BytesIO(raw)).convert("RGB")
        image.thumbnail((1000, 1000))
        quality = 86
        while True:
            output = io.BytesIO()
            image.save(output, format="JPEG", quality=quality, optimize=True)
            data = output.getvalue()
            if len(data) <= MAX_PREVIEW_BYTES or quality <= 55:
                return base64.b64encode(data).decode("ascii")
            quality -= 8
            if quality < 55:
                image.thumbnail((760, 760))
                quality = 55
    except Exception:
        return None


def process_pdf(raw_pdf: bytes, filename: str) -> dict[str, Any]:
    if len(raw_pdf) > MAX_PDF_BYTES:
        raise ValueError("file_too_large")
    if b"%PDF-" not in raw_pdf[:1024]:
        raise ValueError("invalid_pdf")

    try:
        document = fitz.open(stream=raw_pdf, filetype="pdf")
        if document.is_encrypted:
            document.close()
            raise ValueError("password_protected")
        if document.page_count < 1:
            document.close()
            raise ValueError("empty_pdf")
        document.close()
    except ValueError:
        raise
    except Exception as error:
        raise ValueError("corrupt_pdf") from error

    with tempfile.TemporaryDirectory(prefix="rakaez-cv-") as temporary:
        root = Path(temporary)
        safe_stem = Path(filename).stem[:80] or "worker-cv"
        pdf_path = root / f"{safe_stem}.pdf"
        output_root = root / "output"
        pdf_path.write_bytes(raw_pdf)
        parser = SmartCVParser(output_dir=str(output_root))
        result = parser.parse(str(pdf_path), save_json=False)

        extracted_fields = {key: result.get(key) for key in (
            "name", "salary", "nationality", "religion", "age", "job", "passport_number", "experience"
        )}
        normalized = normalize_extracted_fields(extracted_fields)
        fields = normalized["fields"]
        raw_fields = normalized["raw_fields"]
        confidence = result.get("confidence") if isinstance(result.get("confidence"), dict) else {}
        confidence = dict(confidence)
        for field in normalized["unmapped_fields"]:
            confidence[field] = 0
        if raw_fields.get("religion") and not fields.get("religion"):
            warnings = result.get("warnings") if isinstance(result.get("warnings"), list) else []
            result["warnings"] = [*warnings, "لم تُوحّد الديانة بشكل واضح؛ تُركت فارغة للمراجعة."]
        for field in ("salary", "age", "experience"):
            if raw_fields.get(field) and fields.get(field) is None:
                confidence[field] = 0
        photos: list[dict[str, Any]] = []
        selected_path = str(result.get("worker_photo") or "").replace("\\", "/")
        candidate_items = result.get("candidate_photos") or []
        selected_candidate = None
        excluded_document_photos = any(
            str(candidate.get("type") or "").lower() not in ("portrait", "full_body")
            for candidate in candidate_items
        )

        for candidate in candidate_items[:MAX_CANDIDATES]:
            if str(candidate.get("type") or "").lower() not in ("portrait", "full_body"):
                continue
            relative_path = str(candidate.get("path") or "").replace("\\", "/")
            if not relative_path or relative_path.startswith("/") or ".." in Path(relative_path).parts:
                continue
            candidate_path = (output_root / relative_path).resolve()
            if output_root.resolve() not in candidate_path.parents or not candidate_path.is_file():
                continue
            preview = encode_preview(candidate_path.read_bytes())
            if not preview:
                continue
            item = {
                "id": f"photo-{len(photos) + 1}",
                "type": str(candidate.get("type") or "unknown"),
                "score": round(float(candidate.get("score") or 0), 2),
                "page": int(candidate.get("page") or 1),
                "width": int((candidate.get("dimensions") or [0, 0])[0]),
                "height": int((candidate.get("dimensions") or [0, 0])[1]),
                "data": preview,
            }
            photos.append(item)
            if relative_path == selected_path:
                selected_candidate = item["id"]

        if not selected_candidate:
            primary = next((photo for photo in photos if photo["type"] in ("portrait", "full_body")), None)
            if primary:
                selected_candidate = primary["id"]

        warnings = [str(value)[:300] for value in (result.get("warnings") or [])[:12]]
        if excluded_document_photos:
            warnings.append("استُبعدت صور الجوازات والشعارات من خيارات صورة البطاقة.")

        return {
            "fields": fields,
            "raw_fields": raw_fields,
            "confidence": {key: float(confidence.get(key) or 0) for key in (
                "name", "salary", "nationality", "religion", "age", "job", "passport_number", "experience", "worker_photo"
            )},
            "warnings": warnings[:12],
            "photos": photos,
            "selected_photo": selected_candidate,
        }


async def run_job(job_id: str, signed_url: str, file_name: str) -> None:
    async with processing_lock:
        async with job_lock:
            if job_id not in jobs:
                return
            jobs[job_id]["status"] = "processing"
            jobs[job_id]["updated_at"] = time.time()
        try:
            timeout = httpx.Timeout(120.0, connect=15.0)
            async with httpx.AsyncClient(timeout=timeout, follow_redirects=True) as client:
                async with client.stream("GET", signed_url) as response:
                    if response.status_code in (401, 403, 404):
                        raise ValueError("file_unavailable")
                    response.raise_for_status()
                    content_length = response.headers.get("content-length")
                    if content_length and int(content_length) > MAX_PDF_BYTES:
                        raise ValueError("file_too_large")
                    chunks: list[bytes] = []
                    downloaded = 0
                    async for chunk in response.aiter_bytes():
                        downloaded += len(chunk)
                        if downloaded > MAX_PDF_BYTES:
                            raise ValueError("file_too_large")
                        chunks.append(chunk)
                    raw_pdf = b"".join(chunks)
            result = await asyncio.to_thread(process_pdf, raw_pdf, file_name)
            async with job_lock:
                if job_id in jobs:
                    jobs[job_id].update(status="complete", result=result, updated_at=time.time())
        except ValueError as error:
            code = str(error)
            async with job_lock:
                if job_id in jobs:
                    jobs[job_id].update(status="failed", error=code, updated_at=time.time())
        except httpx.TimeoutException:
            async with job_lock:
                if job_id in jobs:
                    jobs[job_id].update(status="failed", error="download_timeout", updated_at=time.time())
        except Exception:
            logger.exception("CV extraction job failed")
            async with job_lock:
                if job_id in jobs:
                    jobs[job_id].update(status="failed", error="extraction_failed", updated_at=time.time())


@app.get("/health")
async def health() -> dict[str, Any]:
    tesseract = setup_tesseract()
    languages: list[str] = []
    if tesseract:
        try:
            languages = pytesseract.get_languages(config="")
        except Exception:
            pass
    return {"status": "ok", "tesseract": bool(tesseract), "ocr_languages": languages}


@app.post("/v1/jobs", status_code=202)
async def create_job(
    payload: CreateJobRequest,
    background_tasks: BackgroundTasks,
    authorization: str | None = Header(default=None),
) -> dict[str, str]:
    require_service_secret(authorization)
    validate_signed_url(payload.signed_url)
    now = time.time()
    async with job_lock:
        expired = [key for key, value in jobs.items() if now - value.get("updated_at", now) > JOB_TTL_SECONDS]
        for key in expired:
            jobs.pop(key, None)
        if sum(value["status"] in ("queued", "processing") for value in jobs.values()) >= 3:
            raise HTTPException(status_code=429, detail="service_busy")
        job_id = str(uuid.uuid4())
        jobs[job_id] = {"status": "queued", "requested_by": payload.requested_by, "updated_at": now}
    background_tasks.add_task(run_job, job_id, payload.signed_url, Path(payload.file_name).name)
    return {"job_id": job_id, "status": "queued"}


@app.get("/v1/jobs/{job_id}")
async def get_job(
    job_id: str,
    requested_by: str = Query(min_length=10, max_length=80),
    authorization: str | None = Header(default=None),
) -> JSONResponse:
    require_service_secret(authorization)
    async with job_lock:
        item = jobs.get(job_id)
        if not item or item.get("requested_by") != requested_by:
            raise HTTPException(status_code=404, detail="job_not_found")
        response = {"job_id": job_id, "status": item["status"]}
        if item["status"] == "complete":
            response["result"] = item.get("result")
        elif item["status"] == "failed":
            response["error"] = item.get("error", "extraction_failed")
    return JSONResponse(response, headers={"Cache-Control": "no-store"})

