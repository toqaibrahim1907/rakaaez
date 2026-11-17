import unittest

from smart_cv.data_mapping import normalize_extracted_fields


class DataMappingTests(unittest.TestCase):
    def normalize(self, **fields):
        return normalize_extracted_fields(fields)

    def test_nationality_synonyms_and_case(self):
        for source in ("Kenyan", "KENYA", "Kenya"):
            with self.subTest(source=source):
                result = self.normalize(nationality=source)
                self.assertEqual(result["fields"]["nationality"], "كينيا")
                self.assertEqual(result["raw_fields"]["nationality"], source)
        self.assertEqual(self.normalize(nationality="  Filipino  ")["fields"]["nationality"], "الفلبين")

    def test_religion_synonyms(self):
        self.assertEqual(self.normalize(religion="Muslim")["fields"]["religion"], "مسلمة")
        self.assertEqual(self.normalize(religion="Christian")["fields"]["religion"], "مسيحية")

    def test_experience_years_months_and_zero(self):
        cases = {
            "5 years experience": 5,
            "2 years and 6 months": 2.5,
            "More than 7 years": 7,
            "Experienced for 4 years": 4,
            "No experience": 0,
            "Fresh": 0,
        }
        for source, expected in cases.items():
            with self.subTest(source=source):
                result = self.normalize(experience=source)
                self.assertEqual(result["fields"]["experience"], expected)
                self.assertEqual(result["raw_fields"]["experience"], source)

    def test_salary_and_age_are_numeric(self):
        self.assertEqual(self.normalize(salary="1200 SAR")["fields"]["salary"], 1200)
        self.assertEqual(self.normalize(salary="١٢٠٠ ريال")["fields"]["salary"], 1200)
        self.assertEqual(self.normalize(salary="SAR 1,500")["fields"]["salary"], 1500)
        self.assertEqual(self.normalize(age="44 years")["fields"]["age"], 44)
        self.assertEqual(self.normalize(age="Age: 38")["fields"]["age"], 38)

    def test_job_mapping_and_unknown_fallback(self):
        self.assertEqual(self.normalize(job="Housemaid")["fields"]["job"], "عاملة منزلية")
        self.assertEqual(self.normalize(job="Nanny")["fields"]["job"], "مربية أطفال")
        self.assertEqual(self.normalize(job="Unlisted Role")["fields"]["job"], "Unlisted Role")

    def test_unknown_values_are_not_guessed_and_raw_is_kept(self):
        result = self.normalize(nationality="Zanzibarian", religion="Unknown Faith")
        self.assertEqual(result["fields"]["nationality"], "Zanzibarian")
        self.assertIsNone(result["fields"]["religion"])
        self.assertEqual(result["raw_fields"]["nationality"], "Zanzibarian")
        self.assertEqual(result["raw_fields"]["religion"], "Unknown Faith")
        self.assertEqual(set(result["unmapped_fields"]), {"nationality", "religion"})

    def test_address_heading_is_not_returned_as_name_and_raw_is_preserved(self):
        for heading in ("ADDRESS", "Address", "العنوان", "WORK EXPERIENCE خبرة العمل"):
            with self.subTest(heading=heading):
                result = self.normalize(name=heading)
                self.assertIsNone(result["fields"]["name"])
                self.assertEqual(result["raw_fields"]["name"], heading)
                self.assertIn("name", result["unmapped_fields"])

    def test_unparseable_numeric_fields_remain_null_with_raw_value(self):
        result = self.normalize(salary="Negotiable", age="not stated", experience="Several years")
        for key in ("salary", "age", "experience"):
            self.assertIsNone(result["fields"][key])
            self.assertIsNotNone(result["raw_fields"][key])


if __name__ == "__main__":
    unittest.main()
