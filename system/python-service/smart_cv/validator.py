"""
Validation and Quality Assurance.
Enforces business constraints, sanity checks field formats, builds warnings,
and formats final schema-compliant JSON output.
"""

import re
from typing import Dict, List, Any, Optional

VALID_SALARY_REGEX = re.compile(r"^\d{3,5}(?:\s*[A-Za-z\$\u0600-\u06FF\.]+)?$")
VALID_PASSPORT_REGEX = re.compile(r"^[A-Z0-9]{6,12}$", re.IGNORECASE)


def validate_extraction(
    raw_data: Dict[str, Any],
    photo_data: Dict[str, Any],
) -> Dict[str, Any]:
    """
    Validates extracted fields, adjusts confidence scores,
    and accumulates warnings for uncertain fields.
    """
    fields = dict(raw_data.get("fields", {}))
    confidence = dict(raw_data.get("confidence", {}))
    warnings: List[str] = []

    # Names are extracted only from explicit labels; never infer them from the file name.
    name = fields.get("name")
    if name:
        fields["name"] = re.sub(r"\s+", " ", str(name)).strip()[:80] or None
    else:
        fields["name"] = None
        confidence["name"] = 0.0

    # 1. Salary Validation
    salary = fields.get("salary")
    if salary:
        # Check if digits exist
        if not re.search(r"\d", salary):
            warnings.append(f"Invalid salary value '{salary}' removed; must contain numeric amount.")
            fields["salary"] = None
            confidence["salary"] = 0.0
        elif not any(curr in salary.upper() for curr in ["SR", "SAR", "AED", "QAR", "KD", "KWD", "USD", "$", "ريال"]):
            warnings.append(f"Salary '{salary}' lacks explicit currency code.")
            confidence["salary"] = min(confidence.get("salary", 0.0), 0.75)
    else:
        confidence["salary"] = 0.0

    # 2. Nationality Validation
    nat = fields.get("nationality")
    if nat:
        # Ensure it's not a generic word like 'Passport' or 'Details'
        if any(w in nat.upper() for w in ["PASSPORT", "DETAILS", "EMPLOYMENT", "SALARY", "NAME"]):
            warnings.append(f"Discarded erroneous nationality string: '{nat}'")
            fields["nationality"] = None
            confidence["nationality"] = 0.0
    else:
        confidence["nationality"] = 0.0

    # 3. Religion Validation
    rel = fields.get("religion")
    if rel:
        if any(w in rel.upper() for w in ["BIRTH", "DATE", "AGE", "SINGLE", "MARRIED", "STATUS"]):
            warnings.append(f"Discarded contaminated religion string: '{rel}'")
            fields["religion"] = None
            confidence["religion"] = 0.0
    else:
        confidence["religion"] = 0.0

    # 4. Age Validation
    age = fields.get("age")
    if age:
        try:
            age_int = int(re.sub(r"[^\d]", "", age))
            if age_int < 18 or age_int > 65:
                warnings.append(f"Age value '{age}' outside expected worker age range (18-65); set to null.")
                fields["age"] = None
                confidence["age"] = 0.0
            else:
                fields["age"] = str(age_int)
        except Exception:
            warnings.append(f"Could not parse numeric age from '{age}'.")
            confidence["age"] = min(confidence.get("age", 0.0), 0.6)
    else:
        confidence["age"] = 0.0

    # 5. Job Validation
    job = fields.get("job")
    if not job:
        confidence["job"] = 0.0

    # 6. Passport Number Validation
    pass_no = fields.get("passport_number")
    if pass_no:
        clean_p = re.sub(r"[^A-Za-z0-9]", "", pass_no).upper()
        if not (6 <= len(clean_p) <= 12):
            warnings.append(f"Passport number '{pass_no}' length unexpected; verify manually.")
            confidence["passport_number"] = min(confidence.get("passport_number", 0.0), 0.65)
        else:
            fields["passport_number"] = clean_p
    else:
        confidence["passport_number"] = 0.0

    # 7. Experience Validation
    exp = fields.get("experience")
    if not exp:
        confidence["experience"] = 0.0

    # 8. Worker Photo Validation
    worker_photo = photo_data.get("worker_photo")
    photo_conf = photo_data.get("confidence", 0.0)
    candidates = photo_data.get("candidate_photos", [])

    if not worker_photo:
        confidence["worker_photo"] = 0.0
        warnings.append("No suitable worker portrait detected. Manual worker photo selection is required.")
    else:
        confidence["worker_photo"] = round(photo_conf, 2)
        if len(candidates) > 1:
            warnings.append(
                f"Multiple candidate photos detected ({len(candidates)}). "
                "Main portrait selected automatically; review candidate_photos if needed."
            )

    return {
        "name": fields.get("name"),
        "salary": fields.get("salary"),
        "nationality": fields.get("nationality"),
        "religion": fields.get("religion"),
        "age": fields.get("age"),
        "job": fields.get("job"),
        "passport_number": fields.get("passport_number"),
        "experience": fields.get("experience"),
        "worker_photo": worker_photo,
        "confidence": {
            "name": confidence.get("name", 0.0),
            "salary": confidence.get("salary", 0.0),
            "nationality": confidence.get("nationality", 0.0),
            "religion": confidence.get("religion", 0.0),
            "age": confidence.get("age", 0.0),
            "job": confidence.get("job", 0.0),
            "passport_number": confidence.get("passport_number", 0.0),
            "experience": confidence.get("experience", 0.0),
            "worker_photo": confidence.get("worker_photo", 0.0),
        },
        "candidate_photos": candidates,
        "warnings": warnings,
    }
