"""
Stage D: Intelligent Multilingual Field Matching.
Extracts the worker name and seven profile fields:
1. Name (الاسم)
2. Salary (الراتب)
3. Nationality (الجنسية)
4. Religion (الديانة)
5. Age (العمر)
6. Job / Position (الوظيفة)
7. Passport Number (رقم الجواز)
8. Experience (الخبرة)

Uses spatial proximity, tabular row/column alignment, regex patterns,
and cross-field validation. Returns None if unconfident.
"""

import re
import logging
from typing import Dict, List, Any, Optional, Tuple

logger = logging.getLogger("smart_cv.fields")

# Comprehensive Dictionary of Field Labels
FIELD_LABELS = {
    "salary": [
        "monthly salary", "basic salary", "salary", "wage",
        "الراتب الشهري", "الراتب", "معاش", "المعاش", "الأجر"
    ],
    "nationality": [
        "nationality", "national", "citizenship",
        "الجنسية", "الجنس", "بلد الاصل"
    ],
    "religion": [
        "religion", "faith", "religious",
        "الديانة", "الدين", "المعتقد"
    ],
    "age": [
        "age", "years old", "العمر", "السن"
    ],
    "job": [
        "post applied for", "position applied for", "position", "job title",
        "occupation", "job", "post", "الوظيفة", "المهنة", "العمل المطلوب", "طلب توظيف"
    ],
    "passport_number": [
        "passport number", "passport no", "passport details", "passport",
        "رقم الجواز", "رقم جواز السفر", "بيان جواز السفر", "وثيقة السفر", "جواز السفر"
    ],
    "experience": [
        "work experience", "working experience", "experiences", "experience",
        "previous employment", "period", "country & period",
        "خبرة العمل", "الخبرة", "سنوات الخبرة", "الخبرة خارج البلاد", "مدة الخبرة", "المدة"
    ]
}

# Known Domain Lexicons for Direct Verification
KNOWN_NATIONALITIES = {
    "kenyan": "KENYAN", "kenya": "KENYAN", "كينيا": "كينية", "كينية": "كينية",
    "filipino": "FILIPINO", "philippines": "FILIPINO", "فلبينية": "فلبينية", "الفلبين": "فلبينية",
    "ethiopian": "ETHIOPIAN", "ethiopia": "ETHIOPIAN", "إثيوبية": "إثيوبية", "اثيوبية": "اثيوبية",
    "ugandan": "UGANDAN", "uganda": "UGANDAN", "أوغندية": "أوغندية", "اوغندية": "اوغندية",
    "indonesian": "INDONESIAN", "indonesia": "INDONESIAN", "إندونيسية": "إندونيسية", "اندونيسية": "اندونيسية",
    "sri lankan": "SRI LANKAN", "sri lanka": "SRI LANKAN", "سريلانكية": "سريلانكية",
    "indian": "INDIAN", "india": "INDIAN", "هندية": "هندية",
    "nepalese": "NEPALESE", "nepal": "NEPALESE", "نيبالية": "نيبالية",
    "bangladeshi": "BANGLADESHI", "bangladesh": "BANGLADESHI", "بنغلاديشية": "بنغلاديشية",
}

KNOWN_RELIGIONS = {
    "christian": "CHRISTIAN", "christianity": "CHRISTIAN", "مسيحية": "مسيحية", "مسيحي": "مسيحية",
    "muslim": "MUSLIM", "islam": "MUSLIM", "islamic": "MUSLIM", "مسلمة": "مسلمة", "مسلم": "مسلمة",
    "non-muslim": "NON-MUSLIM", "non muslim": "NON-MUSLIM", "غير مسلم": "غير مسلم", "غير مسلمة": "غير مسلمة",
    "catholic": "CATHOLIC", "protestant": "PROTESTANT",
    "hindu": "HINDU", "هندوسية": "هندوسية",
    "buddhist": "BUDDHIST", "بوذية": "بوذية",
}

KNOWN_JOBS = [
    "HOUSE MAID", "HOUSEMAID", "DOMESTIC WORKER", "CLEANER", "COOK",
    "BABYSITTER", "NANNY", "CAREGIVER", "PRIVATE DRIVER", "DRIVER", "LABORER",
    "خادمة منزلية", "عاملة منزلية", "طباخة", "مربية", "سائق خاص", "سائق", "عاملة", "خادمة"
]

PASSPORT_REGEX = re.compile(r"\b([A-Z]{1,2}[0-9]{6,8})\b", re.IGNORECASE)
SALARY_REGEX = re.compile(r"\b([0-9]{3,5})\s*(SR|SAR|AED|QAR|KWD|KD|OMR|BHD|USD|\$|ريال|ر\.س)?\b", re.IGNORECASE)
AGE_REGEX = re.compile(r"\b(1[89]|[2-5][0-9]|6[0-5])\b")
EXPERIENCE_YEARS_REGEX = re.compile(r"\b([0-9]{1,2})\s*(YEARS?|YEAR|YRS|Y|سنوات|سنة|عامين|سنتين)\b", re.IGNORECASE)


def clean_field_value(value: str) -> str:
    """Removes leftover delimiters, symbols, and extra whitespace."""
    value = re.sub(r"^[\s:：\|\-\[\]]+", "", value)
    value = re.sub(r"[\s:：\|\-\[\]]+$", "", value)
    return value.strip()


def strip_adjacent_labels(value: str) -> str:
    """
    Strips any label from FIELD_LABELS that might have leaked into the value string
    (e.g., 'KENYAN الجنس' -> 'KENYAN', 'CHRISTIAN الديانة' -> 'CHRISTIAN').
    """
    for field_name, labels in FIELD_LABELS.items():
        for label in sorted(labels, key=len, reverse=True):
            pattern = rf"(?i)(?:\b|_){re.escape(label)}(?:\b|_)|{re.escape(label)}"
            value = re.sub(pattern, "", value)
    return clean_field_value(value)


def _clean_candidate_name(value: str) -> Optional[str]:
    """Reject labels and unrelated profile fields before accepting a name."""
    candidate = re.sub(r"\s+", " ", value).strip(" \t:：|/,-–—.;")
    # A few CVs print several fields on the same line; keep only the name part.
    candidate = re.split(
        r"\s+(?=(?:nationality|religion|gender|sex|date\s+of\s+(?:birth|joining)|dob|passport(?:\s+(?:number|no))?|age|profession|occupation|experience|marital\s+status|الجنسية|الديانة|الدين|النوع|الجنس|تاريخ\s+الميلاد|العمر|السن|رقم\s+الجواز|المهنة|الخبرة)\s*[:：=])",
        candidate,
        maxsplit=1,
        flags=re.IGNORECASE,
    )[0].strip(" \t:：|/,-–—.;")
    if not 2 <= len(candidate) <= 80 or re.search(r"\d", candidate):
        return None
    if not re.search(r"[A-Za-z\u0600-\u06FF]", candidate):
        return None
    rejected = {
        "name", "full name", "candidate name", "applicant name", "worker name",
        "employee name", "name of employee", "name of maid", "maid name",
        "domestic worker", "domestic worker name", "profile", "personal profile",
        "personal details", "curriculum vitae", "resume", "passport details",
        "curriculum vitae resume", "personal information", "professional summary",
        "nationality", "religion", "date of birth", "marital status", "single", "married",
        "experience", "education", "employment history", "housemaid", "caregiver",
        "worker", "employee", "maid", "candidate", "applicant", "first name", "last name",
        "الاسم", "الاسم الكامل", "الاسم الثلاثي", "الاسم الرباعي", "اسم العاملة",
        "اسم العاملة المنزلية", "اسم المرشحة", "اسم الموظفة", "البيانات الشخصية",
        "المعلومات الشخصية", "السيرة الذاتية", "الخبرة", "الجنسية", "الديانة",
        "العمر", "رقم الجواز", "عاملة منزلية", "مربية أطفال",
    }
    if candidate.casefold() in rejected:
        return None
    return candidate


def extract_name(text: str, tokens: List[Dict[str, Any]]) -> Tuple[Optional[str], float]:
    """Extract a worker name only when a name label or split name fields are found."""
    labels = (
        r"(?:candidate|worker|applicant|employee|maid|domestic\s+worker)(?:'s)?\s+(?:full\s+)?name",
        r"name\s+of\s+(?:the\s+)?(?:candidate|worker|applicant|employee|maid|domestic\s+worker)",
        r"full\s+name(?:\s+of\s+(?:candidate|worker|applicant|employee))?", r"complete\s+name",
        r"name\s+as\s+per\s+passport", r"name",
        r"الاسم\s+(?:الكامل|كامل|الثلاثي|الرباعي)",
        r"اسم\s+(?:العاملة\s+المنزلية|العاملة|العامله|المرشحة|المرشحه|المرشح|الموظفة|الموظفه|العامل)", r"الاسم",
    )
    label_pattern = re.compile(r"^(?:\d+[.)-]?\s*)?(?:" + "|".join(labels) + r")(?=\s|[:：=|/,-]|$)", re.IGNORECASE)
    # Keep physical lines separate so labels with a value on the following line work too.
    lines = [re.sub(r"[\t\u00a0]+", " ", line).strip() for line in text.splitlines()]
    for index, line in enumerate(lines):
        if not line:
            continue
        match = label_pattern.match(line)
        if not match:
            continue
        remainder = line[match.end():].strip(" \t:：=|/,-–—")
        if remainder:
            candidate = _clean_candidate_name(remainder)
            if candidate:
                return candidate, 0.95
        for following in lines[index + 1:index + 3]:
            if not following:
                continue
            candidate = _clean_candidate_name(following)
            if candidate:
                return candidate, 0.84
            break

    # Some PDF text layers put the label after a title or other text on the
    # same line, so also search the whole document for explicit labelled names.
    # Requiring a delimiter avoids treating prose such as "my name is" as a field.
    anywhere_labels = (
        r"full\s+name", r"complete\s+name",
        r"name\s+of\s+(?:the\s+)?(?:candidate|worker|applicant|employee|maid|domestic\s+worker)",
        r"(?:candidate|worker|applicant|employee|maid|domestic\s+worker)(?:'s)?\s+(?:full\s+)?name",
        r"name\s+as\s+per\s+passport", r"name",
        r"الاسم\s+(?:الكامل|كامل|الثلاثي|الرباعي)",
        r"اسم\s+(?:العاملة\s+المنزلية|العاملة|العامله|المرشحة|المرشحه|المرشح|الموظفة|الموظفه|العامل)", r"الاسم",
    )
    anywhere_pattern = re.compile(
        r"(?i)(?<![A-Za-z\u0600-\u06FF])(?:" + "|".join(anywhere_labels) +
        r")(?![A-Za-z\u0600-\u06FF])\s*[:：=–—-]\s*"
    )
    for match in anywhere_pattern.finditer(text):
        remainder = text[match.end():].splitlines()[0] if text[match.end():].splitlines() else ""
        candidate = _clean_candidate_name(remainder)
        if candidate:
            return candidate, 0.93

    # Also match descriptive labels without punctuation when embedded in a line.
    # The generic label "name" is deliberately excluded here to avoid prose matches.
    inline_anywhere_pattern = re.compile(
        r"(?i)(?<![A-Za-z\u0600-\u06FF])(?:full\s+name|complete\s+name|"
        r"name\s+of\s+(?:the\s+)?(?:candidate|worker|applicant|employee|maid|domestic\s+worker)|"
        r"(?:candidate|worker|applicant|employee|maid|domestic\s+worker)(?:'s)?\s+(?:full\s+)?name|"
        r"الاسم\s+(?:الكامل|كامل|الثلاثي|الرباعي)|"
        r"اسم\s+(?:العاملة(?:\s+المنزلية)?|العامله|المرشحة|المرشحه|الموظفة|الموظفه|العامل))"
        r"(?![A-Za-z\u0600-\u06FF])\s+([A-Za-z\u0600-\u06FF][A-Za-z\u0600-\u06FF .’'_-]{1,78})"
    )
    for match in inline_anywhere_pattern.finditer(text):
        candidate = _clean_candidate_name(match.group(1))
        if candidate:
            return candidate, 0.86

    # Combine split first/last-name fields where both labels are present.
    first = re.search(r"(?im)^\s*(?:first\s+name|given\s+name|الاسم\s+الأول|الاسم\s+الاول)\s*[:：=–—-]\s*([^\r\n]+)", text)
    last = re.search(r"(?im)^\s*(?:last\s+name|family\s+name|surname|اسم\s+العائلة|اللقب)\s*[:：=–—-]\s*([^\r\n]+)", text)
    if first and last:
        first_name = _clean_candidate_name(first.group(1))
        last_name = _clean_candidate_name(last.group(1))
        if first_name and last_name:
            return f"{first_name} {last_name}", 0.92

    # Some text extractors join a label and its value without punctuation.
    inline_pattern = re.compile(
        r"(?im)^\s*(?:(?:candidate|worker|applicant|employee|maid)(?:'s)?\s+(?:full\s+)?name|name\s+of\s+(?:the\s+)?(?:candidate|worker|applicant|employee|maid)|full\s+name|complete\s+name|name|الاسم\s+(?:الكامل|كامل|الثلاثي|الرباعي)|اسم\s+(?:العاملة\s+المنزلية|العاملة|المرشحة|المرشح|الموظفة|العامل)|الاسم)\s+([A-Za-z\u0600-\u06FF][A-Za-z\u0600-\u06FF .’'_-]{1,78})\s*$"
    )
    for match in inline_pattern.finditer(text):
        candidate = _clean_candidate_name(match.group(1))
        if candidate:
            return candidate, 0.82

    # Use spatially aligned OCR/native spans when line reconstruction split the value.
    for token in tokens:
        label = token.get("text", "").strip().casefold()
        if not re.fullmatch(r"(?:full\s+name|complete\s+name|name\s+of\s+(?:the\s+)?(?:candidate|worker|employee|applicant|maid)|candidate\s+name|worker\s+name|employee\s+name|applicant\s+name|maid\s+name|name|الاسم(?:\s+(?:الكامل|كامل|الثلاثي|الرباعي))?|اسم\s+(?:العاملة(?:\s+المنزلية)?|المرشحة|العامل|الموظفة))", label, re.IGNORECASE):
            continue
        bbox = token.get("bbox") or (0, 0, 0, 0)
        same_line = [
            other for other in tokens
            if other is not token and abs((other.get("bbox") or (0, 0, 0, 0))[1] - bbox[1]) <= 8
        ]
        same_line.sort(key=lambda item: (item.get("bbox") or (0, 0, 0, 0))[0])
        row_text = " ".join(item.get("text", "") for item in same_line)
        row_text = re.sub(
            r"(?i)^\s*(?:full\s+name|complete\s+name|(?:candidate|worker|employee|applicant|maid)\s+name|name)\s*[:：=–—-]?\s*",
            "", row_text,
        )
        row_text = re.sub(r"^\s*(?:الاسم|اسم\s+(?:العاملة|المرشحة|العامل))\s*[:：=–—-]?\s*", "", row_text)
        candidate = _clean_candidate_name(row_text)
        if candidate:
            return candidate, 0.72
    return None, 0.0


def extract_salary(text: str, tokens: List[Dict[str, Any]]) -> Tuple[Optional[str], float]:
    """Extracts salary with currency and amount."""
    # 1. Regex search near salary keywords in full text
    salary_line_pattern = re.compile(
        r"(?:salary|monthly\s+salary|basic\s+salary|الراتب\s*الشهري|الراتب|معاش)"
        r"[\s:\|\-]*([0-9]{3,5}\s*(?:SR|SAR|AED|QAR|KWD|KD|OMR|BHD|USD|\$|ريال|ر\.س)?)",
        re.IGNORECASE
    )
    match = salary_line_pattern.search(text)
    if match:
        val = clean_field_value(match.group(1))
        # Ensure currency if missing but clear
        return val, 0.95

    # 2. Check tokens near 'salary' or 'الراتب'
    for i, t in enumerate(tokens):
        t_low = t["text"].lower()
        if any(lbl in t_low for lbl in ["salary", "الراتب", "معاش"]):
            lbl_bbox = t["bbox"]
            # Look for adjacent numeric token within y-range (+/- 15pt) and x-distance (< 150pt)
            for j, val_t in enumerate(tokens):
                if i == j:
                    continue
                v_bbox = val_t["bbox"]
                if abs(v_bbox[1] - lbl_bbox[1]) <= 18:
                    m = SALARY_REGEX.search(val_t["text"])
                    if m:
                        val = m.group(0).strip()
                        return val, 0.90

    # 3. Fallback: find any token with clear currency like 900SR
    for t in tokens:
        m = re.search(r"\b([0-9]{3,4}\s*(?:SR|SAR|AED|QAR|KWD|KD|OMR|ريال))\b", t["text"], re.IGNORECASE)
        if m:
            return m.group(1).strip(), 0.85

    return None, 0.0


def extract_nationality(text: str, tokens: List[Dict[str, Any]]) -> Tuple[Optional[str], float]:
    """Extracts nationality, distinguishing from previous employment country."""
    # 1. First check if any known demonym appears in the text in proximity to a nationality label
    nat_line_pattern = re.compile(
        r"(?:nationality|national|الجنسية|الجنس|بلد\s*الاصل)[\s:\|\-\n/]+([^\n\r]+)",
        re.IGNORECASE
    )
    for m in nat_line_pattern.finditer(text):
        candidate = m.group(1).strip()
        # Look for known demonym inside this candidate
        for key, std_name in KNOWN_NATIONALITIES.items():
            if re.search(rf"(?:\b|_){re.escape(key)}(?:\b|_)|{re.escape(key)}", candidate, re.IGNORECASE):
                return std_name, 0.95
        cleaned = strip_adjacent_labels(candidate)
        if cleaned and len(cleaned) <= 20:
            return cleaned.upper(), 0.80

    # 2. Token proximity to nationality label
    for i, t in enumerate(tokens):
        t_low = t["text"].lower()
        if any(lbl in t_low for lbl in ["nationality", "national", "الجنسية", "الجنس"]):
            lbl_bbox = t["bbox"]
            for val_t in tokens:
                v_bbox = val_t["bbox"]
                if (abs(v_bbox[1] - lbl_bbox[1]) <= 25 or 0 <= (v_bbox[1] - lbl_bbox[3]) <= 30):
                    v_low = val_t["text"].lower().strip()
                    for k, std_name in KNOWN_NATIONALITIES.items():
                        if k in v_low:
                            return std_name, 0.95

    # 3. Direct lexicon search if explicit nationality appears anywhere in document
    for word, std_name in KNOWN_NATIONALITIES.items():
        if word.endswith("n") or word.endswith("o") or word.endswith("ة") or word.endswith("ية"):
            if re.search(rf"\b{re.escape(word)}\b", text, re.IGNORECASE):
                return std_name, 0.85

    return None, 0.0


def extract_religion(text: str, tokens: List[Dict[str, Any]]) -> Tuple[Optional[str], float]:
    """Extracts religion only when explicitly stated."""
    # 1. Line pattern search
    rel_line_pattern = re.compile(
        r"(?:religion|faith|الديانة|الدين|المعتقد)[\s:\|\-\n/]+([^\n\r]+)",
        re.IGNORECASE
    )
    for m in rel_line_pattern.finditer(text):
        candidate = m.group(1).strip()
        for key, std_name in KNOWN_RELIGIONS.items():
            if re.search(rf"(?:\b|_){re.escape(key)}(?:\b|_)|{re.escape(key)}", candidate, re.IGNORECASE):
                return std_name, 0.95
        cleaned = strip_adjacent_labels(candidate)
        if cleaned and len(cleaned) <= 20:
            return cleaned.upper(), 0.80

    # 2. Token proximity
    for i, t in enumerate(tokens):
        t_low = t["text"].lower()
        if any(lbl in t_low for lbl in ["religion", "faith", "الديانة", "الدين"]):
            lbl_bbox = t["bbox"]
            for val_t in tokens:
                v_bbox = val_t["bbox"]
                if (abs(v_bbox[1] - lbl_bbox[1]) <= 25 or 0 <= (v_bbox[1] - lbl_bbox[3]) <= 30):
                    v_low = val_t["text"].lower().strip()
                    for k, std_name in KNOWN_RELIGIONS.items():
                        if k in v_low:
                            return std_name, 0.95

    # 3. Direct match for explicit religious denomination in text
    for key, std_name in KNOWN_RELIGIONS.items():
        if re.search(rf"\b{re.escape(key)}\b", text, re.IGNORECASE):
            return std_name, 0.85

    return None, 0.0


def extract_age(text: str, tokens: List[Dict[str, Any]]) -> Tuple[Optional[str], float]:
    """Extracts age as numeric value, avoiding dates of birth and periods."""
    # 1. Line pattern search for Age
    age_line_pattern = re.compile(
        r"(?:^|\b)(?:age|years\s+old|العمر|السن)[\s:\|\-\n/]+([0-9]{1,2})\b",
        re.IGNORECASE
    )
    m = age_line_pattern.search(text)
    if m:
        age_val = int(m.group(1))
        if 18 <= age_val <= 65:
            return str(age_val), 0.95

    # 2. Token proximity
    for i, t in enumerate(tokens):
        t_low = t["text"].lower().strip()
        if any(lbl in t_low for lbl in ["age", "العمر", "السن"]):
            lbl_bbox = t["bbox"]
            for val_t in tokens:
                v_bbox = val_t["bbox"]
                if (abs(v_bbox[1] - lbl_bbox[1]) <= 20 or 0 <= (v_bbox[1] - lbl_bbox[3]) <= 30):
                    m_age = AGE_REGEX.search(val_t["text"].strip())
                    if m_age:
                        age_val = int(m_age.group(1))
                        if 18 <= age_val <= 65:
                            return str(age_val), 0.92

    return None, 0.0


def extract_job(text: str, tokens: List[Dict[str, Any]]) -> Tuple[Optional[str], float]:
    """Extracts applied job / position."""
    # 1. Check known domestic worker jobs in full text with label proximity
    job_line_pattern = re.compile(
        r"(?:post\s+applied\s+for|job\s+applied(?:\s+for)?|position\s+applied\s+for|position|job\s+title|occupation|job|الوظيفة|المهنة|طلب\s*توظيف)"
        r"[\s:\|\-\[\n/]+([A-Za-z\u0600-\u06FF\s]{3,35})",
        re.IGNORECASE
    )
    for m in job_line_pattern.finditer(text):
        candidate = m.group(1).strip()
        for kj in sorted(KNOWN_JOBS, key=len, reverse=True):
            if kj.lower() in candidate.lower():
                return kj, 0.95

    # 2. Check for known job strings anywhere in tokens or text (longest matches first)
    for kj in sorted(KNOWN_JOBS, key=len, reverse=True):
        if re.search(rf"\b{re.escape(kj)}\b", text, re.IGNORECASE):
            return kj, 0.92

    # 3. Check for multi-token jobs like 'HOUSE' + 'MAID'
    for i in range(len(tokens) - 1):
        combined = f"{tokens[i]['text']} {tokens[i+1]['text']}".upper()
        if "HOUSE MAID" in combined or "HOUSEMAID" in combined:
            return "HOUSE MAID", 0.95

    return None, 0.0


def extract_passport_number(text: str, tokens: List[Dict[str, Any]]) -> Tuple[Optional[str], float]:
    """Extracts passport number preserving letters and digits."""
    # 1. Line pattern search near passport keywords (handling Arabic word-order variations)
    pass_line_pattern = re.compile(
        r"(?:passport\s*(?:number|no|details)?|رقم\s*الجواز|الجواز\s*رقم|رقم\s*جواز\s*السفر|جواز\s*السفر|بيان\s*جواز\s*السفر)"
        r"[\s:\|\-\n/]*([A-Z]{1,2}[0-9]{6,8})\b",
        re.IGNORECASE
    )
    m = pass_line_pattern.search(text)
    if m:
        return m.group(1).upper().strip(), 0.95

    # 2. Find passport token near passport labels
    for i, t in enumerate(tokens):
        t_low = t["text"].lower()
        if any(lbl in t_low for lbl in ["passport", "الجواز", "السفر"]):
            lbl_bbox = t["bbox"]
            for val_t in tokens:
                v_bbox = val_t["bbox"]
                dist = ((v_bbox[0] - lbl_bbox[0])**2 + (v_bbox[1] - lbl_bbox[1])**2)**0.5
                if dist < 250:
                    m_p = PASSPORT_REGEX.search(val_t["text"].strip())
                    if m_p:
                        return m_p.group(1).upper(), 0.92

    # 3. Fallback: match standalone passport pattern in token stream
    for t in tokens:
        val = t["text"].strip()
        m_p = PASSPORT_REGEX.match(val)
        if m_p:
            cand = m_p.group(1).upper()
            if not any(cand.startswith(m) for m in ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"]):
                return cand, 0.85

    return None, 0.0


def extract_experience(text: str, tokens: List[Dict[str, Any]]) -> Tuple[Optional[str], float]:
    """Extracts experience preserving original value and units."""
    # 1. Check for period + country
    period_match = re.search(r"(?:period|المدة)[\s:\|\-\n/]*([0-9]{1,2}\s*(?:years?|y|سنوات|سنة|عامين|سنتين))", text, re.IGNORECASE)
    country_match = re.search(r"(?:country|البلد)[\s:\|\-\n/]*([A-Za-z\u0600-\u06FF]+)", text, re.IGNORECASE)

    if period_match and country_match:
        period = clean_field_value(period_match.group(1)).upper()
        country = clean_field_value(country_match.group(1)).upper()
        country = strip_adjacent_labels(country)
        return f"{period} ({country})", 0.92
    elif period_match:
        return clean_field_value(period_match.group(1)).upper(), 0.90

    # 2. Check for experience line pattern
    exp_line_pattern = re.compile(
        r"(?:work\s+experience|experience|الخبرة|خبرة\s*العمل|سنوات\s*الخبرة)"
        r"[\s:\|\-\n/]*([0-9]{1,2}\s*(?:years?|y|سنوات|سنة|عامين|سنتين)|سنتين|عامين|first\s*time|new|بدون\s*خبرة|اول\s*مرة)",
        re.IGNORECASE
    )
    m = exp_line_pattern.search(text)
    if m:
        return clean_field_value(m.group(1)).upper(), 0.90

    # 3. Check for standalone keywords
    if re.search(r"\b(first\s*time|new|بدون\s*خبرة|اول\s*مرة)\b", text, re.IGNORECASE):
        return "FIRST TIME", 0.85
    if re.search(r"\b(سنتين|عامين)\b", text):
        return "سنتين", 0.90

    return None, 0.0


def extract_all_fields(full_text: str, tokens: List[Dict[str, Any]]) -> Dict[str, Any]:
    """
    Extracts the name and profile fields with confidence scores.
    """
    name, conf_name = extract_name(full_text, tokens)
    salary, conf_salary = extract_salary(full_text, tokens)
    nationality, conf_nat = extract_nationality(full_text, tokens)
    religion, conf_rel = extract_religion(full_text, tokens)
    age, conf_age = extract_age(full_text, tokens)
    job, conf_job = extract_job(full_text, tokens)
    passport, conf_pass = extract_passport_number(full_text, tokens)
    experience, conf_exp = extract_experience(full_text, tokens)

    return {
        "fields": {
            "name": name,
            "salary": salary,
            "nationality": nationality,
            "religion": religion,
            "age": age,
            "job": job,
            "passport_number": passport,
            "experience": experience,
        },
        "confidence": {
            "name": round(conf_name, 2),
            "salary": round(conf_salary, 2),
            "nationality": round(conf_nat, 2),
            "religion": round(conf_rel, 2),
            "age": round(conf_age, 2),
            "job": round(conf_job, 2),
            "passport_number": round(conf_pass, 2),
            "experience": round(conf_exp, 2),
        }
    }
