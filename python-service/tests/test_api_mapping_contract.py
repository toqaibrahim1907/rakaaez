import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

import fitz
from PIL import Image

from app import process_pdf


class ApiMappingContractTests(unittest.TestCase):
    def test_process_pdf_normalizes_fields_and_preserves_photo_candidates(self):
        document = fitz.open()
        document.new_page()
        pdf = document.tobytes()
        document.close()

        class ParserStub:
            def __init__(self, output_dir):
                self.output_dir = Path(output_dir)

            def parse(self, path, save_json=False):
                self.output_dir.mkdir(parents=True, exist_ok=True)
                Image.new("RGB", (120, 160), "white").save(self.output_dir / "portrait.jpg")
                return {
                    "salary": "SAR 1,500",
                    "nationality": "Kenyan",
                    "religion": "Muslim",
                    "age": "38 years",
                    "job": "Housemaid",
                    "passport_number": "AB123456",
                    "experience": "2 years and 6 months",
                    "worker_photo": "portrait.jpg",
                    "candidate_photos": [{
                        "path": "portrait.jpg", "type": "portrait", "score": 0.9,
                        "page": 1, "dimensions": [120, 160],
                    }],
                    "confidence": {key: 0.9 for key in (
                        "salary", "nationality", "religion", "age", "job",
                        "passport_number", "experience", "worker_photo"
                    )},
                    "warnings": [],
                }

        with patch("app.SmartCVParser", ParserStub):
            result = process_pdf(pdf, "candidate.pdf")

        self.assertEqual(result["fields"]["salary"], 1500)
        self.assertEqual(result["fields"]["nationality"], "كينيا")
        self.assertEqual(result["fields"]["religion"], "مسلمة")
        self.assertEqual(result["fields"]["age"], 38)
        self.assertEqual(result["fields"]["job"], "عاملة منزلية")
        self.assertEqual(result["fields"]["experience"], 2.5)
        self.assertEqual(result["raw_fields"]["nationality"], "Kenyan")
        self.assertEqual(result["raw_fields"]["experience"], "2 years and 6 months")
        self.assertEqual(len(result["photos"]), 1)
        self.assertEqual(result["selected_photo"], "photo-1")


if __name__ == "__main__":
    unittest.main()
