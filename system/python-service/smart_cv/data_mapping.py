"""Deterministic normalization for fields returned by the PDF parser.

This module is intentionally separate from the PDF/OCR extraction pipeline.
It keeps each parser value as ``*_raw`` and produces reviewed-form values in
``fields`` without inferring missing information.
"""

from __future__ import annotations

import re
import unicodedata
from typing import Any


NATIONALITIES = {
    "kenya": "كينيا", "kenyan": "كينيا", "كينيا": "كينيا", "كينية": "كينيا",
    "philippines": "الفلبين", "filipino": "الفلبين", "filipina": "الفلبين",
    "الفلبين": "الفلبين", "فلبين": "الفلبين", "فلبينية": "الفلبين",
    "ethiopia": "إثيوبيا", "ethiopian": "إثيوبيا", "إثيوبيا": "إثيوبيا", "اثيوبيا": "إثيوبيا",
    "إثيوبية": "إثيوبيا", "اثيوبية": "إثيوبيا",
    "uganda": "أوغندا", "ugandan": "أوغندا", "أوغندا": "أوغندا", "اوغندا": "أوغندا",
    "أوغندية": "أوغندا", "اوغندية": "أوغندا",
    "india": "الهند", "indian": "الهند", "الهند": "الهند", "هندية": "الهند",
    "bangladesh": "بنجلاديش", "bangladeshi": "بنجلاديش", "بنجلاديش": "بنجلاديش",
    "بنغلاديش": "بنجلاديش", "بنغلاديشية": "بنجلاديش", "بنجلاديشية": "بنجلاديش",
    "pakistan": "باكستان", "pakistani": "باكستان", "باكستان": "باكستان", "باكستانية": "باكستان",
    "sri lanka": "سريلانكا", "sri lankan": "سريلانكا", "srilanka": "سريلانكا",
    "سريلانكا": "سريلانكا", "سريلانكية": "سريلانكا",
    "nepal": "نيبال", "nepalese": "نيبال", "nepali": "نيبال", "نيبال": "نيبال", "نيبالية": "نيبال",
    "indonesia": "إندونيسيا", "indonesian": "إندونيسيا", "إندونيسيا": "إندونيسيا", "اندونيسيا": "إندونيسيا",
}

RELIGIONS = {
    "muslim": "مسلمة", "islam": "مسلمة", "moslem": "مسلمة", "مسلم": "مسلمة", "مسلمة": "مسلمة",
    "christian": "مسيحية", "christianity": "مسيحية", "مسيحي": "مسيحية", "مسيحية": "مسيحية",
    "catholic": "كاثوليكية", "كاثوليكي": "كاثوليكية", "كاثوليكية": "كاثوليكية",
    "protestant": "بروتستانتية", "بروتستانتي": "بروتستانتية", "بروتستانتية": "بروتستانتية",
    "hindu": "هندوسية", "هندوسية": "هندوسية",
    "buddhist": "بوذية", "buddhism": "بوذية", "بوذي": "بوذية", "بوذية": "بوذية",
}

JOBS = {
    "domestic worker": "عاملة منزلية", "domestic workers": "عاملة منزلية",
    "housemaid": "عاملة منزلية", "house maid": "عاملة منزلية", "maid": "عاملة منزلية",
    "عاملة منزلية": "عاملة منزلية", "خادمة منزلية": "عاملة منزلية",
    "nanny": "مربية أطفال", "babysitter": "مربية أطفال", "مربية أطفال": "مربية أطفال", "مربية اطفال": "مربية أطفال",
    "cook": "طباخة", "chef": "طباخة", "طباخة": "طباخة",
    "caregiver": "مقدمة رعاية", "care giver": "مقدمة رعاية", "مقدمة رعاية": "مقدمة رعاية",
}

# Guard the API boundary as well as the PDF parser. Some CV layouts contain
# standalone section headings directly below a "Name" label; they must not be
# presented as an employee name even if OCR mistakes the heading for a value.
_NON_NAME_VALUES = {
    "name", "full name", "complete name", "candidate name", "applicant name",
    "worker name", "employee name", "maid name", "address", "home address",
    "present address", "permanent address", "current address", "contact",
    "contact details", "personal details", "personal information", "profile",
    "personal profile", "nationality", "religion", "age", "experience",
    "work experience", "work experience خبرة العمل", "خبرة العمل", "الخبرة العملية",
    "الخبرة المهنية", "professional experience", "experience details", "employment history",
    "الاسم", "الاسم بالكامل", "الاسم الكامل", "اسم العاملة", "اسم العاملة المنزلية",
    "العنوان", "عنوان السكن", "بيانات التواصل", "معلومات الاتصال", "البيانات الشخصية",
    "المعلومات الشخصية", "الجنسية", "الديانة", "العمر", "الخبرة",
}

_ARABIC_DIGITS = str.maketrans("٠١٢٣٤٥٦٧٨٩۰۱۲۳۴۵۶۷۸۹", "01234567890123456789")


def _raw(value: Any) -> str | None:
    if value is None:
        return None
    text = str(value).strip()
    return text or None


def _key(value: str) -> str:
    text = unicodedata.normalize("NFKC", value).casefold()
    text = "".join(char for char in text if unicodedata.category(char) != "Mn" and char != "ـ")
    text = re.sub(r"[_\s\-]+", " ", text)
    return text.strip(" .,:;()[]{}\t\r\n")


def _numeric_text(value: str) -> str:
    return unicodedata.normalize("NFKC", value).translate(_ARABIC_DIGITS).replace("٬", ",").replace("٫", ".")


def _amount(value: str | None, *, allow_decimal: bool) -> int | float | None:
    if not value:
        return None
    text = _numeric_text(value)
    # A range is ambiguous; do not silently choose one endpoint.
    if re.search(r"\d\s*[-–—]\s*\d", text):
        return None
    match = re.search(r"(?<!\d)(\d{1,3}(?:,\d{3})+(?:\.\d+)?|\d+(?:\.\d+)?)(?!\d)", text)
    if not match:
        return None
    try:
        number = float(match.group(1).replace(",", ""))
    except ValueError:
        return None
    if number < 0:
        return None
    if not allow_decimal and not number.is_integer():
        return None
    return number if allow_decimal and not number.is_integer() else int(number)


def _experience(value: str | None) -> int | float | None:
    if not value:
        return None
    text = _numeric_text(value).casefold().replace("٫", ".")
    compact = re.sub(r"[\s_\-]+", " ", text).strip()
    zero_phrases = (
        "no experience", "no work experience", "fresh", "fresher", "first time", "new worker",
        "بدون خبرة", "لا توجد خبرة", "لا خبرة", "حديثة", "حديثة التخرج", "اول مرة", "أول مرة",
    )
    if any(phrase in compact for phrase in zero_phrases):
        return 0

    year = re.search(r"(\d+(?:[.,]\d+)?)\s*(?:years?|yrs?|yr|y\b|سنوات|سنة|سنين|عام|أعوام)", text)
    month = re.search(r"(\d+(?:[.,]\d+)?)\s*(?:months?|mos?|mo\b|أشهر|شهر|شهور)", text)
    if year or month:
        years = float(year.group(1).replace(",", ".")) if year else 0.0
        months = float(month.group(1).replace(",", ".")) if month else 0.0
        if months >= 12:
            years += months / 12
        elif month:
            years += months / 12
        rounded = round(years, 2)
        return int(rounded) if rounded.is_integer() else rounded

    # Handle compact duration forms such as "سنتين" and "عامين".
    if re.search(r"\b(?:سنتين|عامين)\b", text):
        return 2
    return None


def normalize_extracted_fields(extracted: dict[str, Any]) -> dict[str, Any]:
    """Return Arabic/typed field values and a parallel raw-value dictionary."""
    raw_fields = {key: _raw(extracted.get(key)) for key in (
        "name", "nationality", "religion", "experience", "salary", "age", "job", "passport_number"
    )}
    fields: dict[str, Any] = dict(extracted)
    unmapped: list[str] = []

    name = re.sub(r"\s+", " ", raw_fields["name"]).strip() if raw_fields["name"] else None
    name_key = _key(name) if name else ""
    fields["name"] = None if name_key in _NON_NAME_VALUES else name
    if raw_fields["name"] and fields["name"] is None:
        unmapped.append("name")

    nationality_raw = raw_fields["nationality"]
    nationality_key = _key(nationality_raw) if nationality_raw else ""
    fields["nationality"] = NATIONALITIES.get(nationality_key, nationality_raw) if nationality_raw else None
    if nationality_raw and nationality_key not in NATIONALITIES:
        unmapped.append("nationality")

    religion_raw = raw_fields["religion"]
    # Unknown religion stays blank for human review; it is never inferred.
    religion_key = _key(religion_raw) if religion_raw else ""
    fields["religion"] = RELIGIONS.get(religion_key) if religion_raw else None
    if religion_raw and religion_key not in RELIGIONS:
        unmapped.append("religion")

    job_raw = raw_fields["job"]
    job_key = _key(job_raw) if job_raw else ""
    fields["job"] = JOBS.get(job_key, job_raw) if job_raw else None
    if job_raw and job_key not in JOBS:
        unmapped.append("job")

    fields["salary"] = _amount(raw_fields["salary"], allow_decimal=True)
    fields["age"] = _amount(raw_fields["age"], allow_decimal=False)
    fields["experience"] = _experience(raw_fields["experience"])
    for field in ("salary", "age", "experience"):
        if raw_fields[field] and fields[field] is None:
            unmapped.append(field)

    return {"fields": fields, "raw_fields": raw_fields, "unmapped_fields": unmapped}
