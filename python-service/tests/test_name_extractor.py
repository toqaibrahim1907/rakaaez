import unittest

from smart_cv.field_extractor import extract_name


class NameExtractorTests(unittest.TestCase):
    def test_bilingual_full_name_row_removes_ocr_arabic_label(self):
        value, confidence = extract_name(
            "Full name SAMPLE CANDIDATE NAME االسم بالكامل",
            [],
        )
        self.assertEqual(value, "SAMPLE CANDIDATE NAME")
        self.assertGreaterEqual(confidence, 0.8)

    def test_arabic_worker_name_label(self):
        value, _ = extract_name("اسم العاملة: سارة محمد", [])
        self.assertEqual(value, "سارة محمد")

    def test_name_label_embedded_in_line(self):
        value, _ = extract_name("Applicant Profile — Full name: Mary Jane Doe", [])
        self.assertEqual(value, "Mary Jane Doe")

    def test_first_and_last_name_fields_are_combined(self):
        value, _ = extract_name("First Name: Mary\nLast Name: Jane", [])
        self.assertEqual(value, "Mary Jane")

    def test_does_not_guess_name_without_a_name_label(self):
        value, confidence = extract_name("PERSONAL PROFILE\nHousemaid with 5 years of experience", [])
        self.assertIsNone(value)
        self.assertEqual(confidence, 0.0)


if __name__ == "__main__":
    unittest.main()
