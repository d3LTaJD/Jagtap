import unittest
from app.parsers.dictionary import normalize_size, normalize_class, normalize_valve_type, normalize_material
from app.parsers.spec_sheet_parser import parse_spec_text_or_blocks

class TestPythonExtractor(unittest.TestCase):
    def test_normalizers(self):
        self.assertEqual(normalize_size("50 NB"), "50 mm")
        self.assertEqual(normalize_size("80 NB"), "80 mm")
        self.assertEqual(normalize_size('2"'), "50 mm")
        self.assertEqual(normalize_size('DN 100'), "100 mm")
        self.assertEqual(normalize_class("Class 150"), "150#")
        self.assertEqual(normalize_class("300 LBS"), "300#")
        self.assertEqual(normalize_valve_type("Ball Valve"), "Ball Valve")
        self.assertEqual(normalize_valve_type("Swing Check Valve"), "Swing Check Valve")
        self.assertEqual(normalize_material("ASTM A216 WCB"), "ASTM A216 WCB")
        self.assertEqual(normalize_material("Cast Steel"), "ASTM A216 WCB")

    def test_spec_text_parsing(self):
        sample_text = """
        1. 50 NB Class 150 Ball Valve (Qty: 10 Nos)
        2. 80 NB Class 300 Gate Valve - 5 Nos
        3. 100 NB Class 150 Check Valve (Qty: 2 Nos)
        4. 2" 150# Globe Valve, Manual - Qty 4 Nos
        
        Material: ASTM A216 WCB
        End Connection: Flanged RF
        """
        items, root_specs = parse_spec_text_or_blocks(sample_text)
        self.assertEqual(len(items), 4)
        self.assertEqual(items[0].valve_size, "50 mm")
        self.assertEqual(items[0].valve_class, "150#")
        self.assertEqual(items[0].quantity, 10)
        self.assertEqual(items[0].valve_moc_body, "ASTM A216 WCB")
        self.assertEqual(items[0].valve_end_connection, "Flanged RF")

        self.assertEqual(items[1].valve_size, "80 mm")
        self.assertEqual(items[1].valve_class, "300#")
        self.assertEqual(items[1].quantity, 5)

if __name__ == "__main__":
    unittest.main()
