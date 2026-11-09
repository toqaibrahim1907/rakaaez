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

    def test_common_english_name_label_synonyms(self):
        rows = (
            "Full Name: Mary Jane Doe",
            "Name: Mary Jane Doe",
            "Candidate Name: Mary Jane Doe",
            "Applicant's Full Name: Mary Jane Doe",
            "Worker's Name: Mary Jane Doe",
            "Name of the Worker: Mary Jane Doe",
            "Full Name of the Worker: Mary Jane Doe",
            "Passport Holder Name: Mary Jane Doe",
            "Name on Passport: Mary Jane Doe",
        )
        for text in rows:
            with self.subTest(text=text):
                value, _ = extract_name(text, [])
                self.assertEqual(value, "Mary Jane Doe")

    def test_unpunctuated_full_name_of_worker_embedded_in_text(self):
        value, _ = extract_name("Applicant profile — Full name of the worker Mary Jane Doe", [])
        self.assertEqual(value, "Mary Jane Doe")

    def test_first_and_last_name_fields_are_combined(self):
        value, _ = extract_name("First Name: Mary\nLast Name: Jane", [])
        self.assertEqual(value, "Mary Jane")

    def test_does_not_guess_name_without_a_name_label(self):
        value, confidence = extract_name("PERSONAL PROFILE\nHousemaid with 5 years of experience", [])
        self.assertIsNone(value)
        self.assertEqual(confidence, 0.0)

    def test_address_heading_is_never_returned_as_worker_name(self):
        for text in ("Full Name\nADDRESS\nAddress: Nairobi", "Name: ADDRESS"):
            with self.subTest(text=text):
                value, _ = extract_name(text, [])
                self.assertIsNone(value)

    def test_address_heading_after_name_is_removed(self):
        value, _ = extract_name("Full Name: Mary Jane ADDRESS", [])
        self.assertEqual(value, "Mary Jane")


if __name__ == "__main__":
    unittest.main()
