"""Parsing and filtering regressions, offline and without database access."""
import json
import sys
import tempfile
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "scripts/vtb"))
from extract import parse_detail, parse_index  # noqa: E402
from review import classify, write_review  # noqa: E402

FIXTURE = """
<html><nav><a href="/vtb/">VTB</a></nav>
<h1>Casa &lt;Test&gt; &amp; tradiții</h1><p class="h5">Descriere scurtă.</p>
<img src="/media/location_media/cover.jpg" alt="Copertă">
<div><h5>Categorii</h5><ul><li class="list-group-item"><ul><li>cazare 🏡</li></ul></li></ul></div>
<div><h5>Activități/ Subcategorii</h5><ul><li><ul><li>🍷 degustare vin</li><li>🎒 excursie</li></ul></li></ul></div>
<ul>
<li class="list-group-item"><strong>Localitate:</strong> Şerpeni</li>
<li class="list-group-item"><strong>Regiune:</strong> Anenii Noi</li>
<li class="list-group-item"><strong>Țară:</strong> Moldova</li>
<li class="list-group-item"><strong>Latitudine:</strong>47,0210625</li>
<li class="list-group-item"><strong>Longitudine:</strong>29,3596875</li>
<li class="list-group-item"><strong>Informații de Contact:</strong> +373 69 207 645</li>
<li class="list-group-item"><strong>Meniu/ Servicii:</strong>Rezervă masa la www.example.org.</li>
<li class="list-group-item"><strong>Istorie Poză:</strong><img src="/media/location_media/history.jpg"></li>
<li class="list-group-item"><strong>Orar de Functionare:</strong><div><strong>Este Deschis 24/7?</strong><input id="open24Switch" type="checkbox" disabled></div><ul><li>Luni: 09:00–17:00</li></ul></li>
</ul>
<input id="isBusinessSwitch" type="checkbox" disabled>
<input id="approvedSwitch" type="checkbox" checked disabled>
<input id="availableSwitch" type="checkbox" checked="" disabled>
<footer><img src="https://example.org/logo.jpg"><strong>Telefon:</strong>+373 60 803 221</footer>
</html>
"""


class VtbTest(unittest.TestCase):
    def record(self):
        return parse_detail(FIXTURE, "https://www.implicareplus.org/vtb/location/999/")

    def test_complete_detail_and_scope(self):
        r = self.record()
        self.assertEqual(r["name"], "Casa <Test> & tradiții")
        self.assertEqual(r["coordinates"], {"latitude": 47.0210625, "longitude": 29.3596875})
        self.assertEqual(r["phones"], ["+37369207645"])
        self.assertEqual(r["categories"], ["cazare 🏡"])
        self.assertEqual(len(r["activities"]), 2)
        self.assertEqual(r["source_flags"], {"business": False, "approved": True, "available": True, "open_24h": False})
        self.assertEqual(len(r["images"]), 2)
        self.assertEqual(r["images"][1]["role"], "Istorie Poză")
        self.assertEqual(r["fields"]["Orar de Functionare"], "Luni: 09:00–17:00")
        self.assertEqual(r["field_links"]["Meniu/ Servicii"], ["https://www.example.org"])
        self.assertEqual(r["publication_scope"], "map_only")
        self.assertFalse(r["sync_to_haide"])
        self.assertEqual(r["review_decision"], "pending")

    def test_index_unique_and_pagination(self):
        html = '<h3>Nord (2)</h3><a href="/vtb/location/1/">A</a><a href="/vtb/location/1/">B</a><a href="/vtb/location/2/">C</a><a href="?page=2">2</a><a href="https://evil.example/vtb/location/4/">X</a>'
        locations, pages, count = parse_index(html)
        self.assertEqual(set(locations), {"1", "2"})
        self.assertEqual(pages, ["https://www.implicareplus.org/vtb/?page=2"])
        self.assertEqual(count, 2)

    def test_no_title_fails_and_bad_coordinates_stay_missing(self):
        with self.assertRaises(ValueError):
            parse_detail("<form>Login</form>", "https://www.implicareplus.org/vtb/location/1/")
        self.assertIsNone(parse_detail(FIXTURE.replace("47,0210625", "0,0"), "https://www.implicareplus.org/vtb/location/1/")["coordinates"])

    def test_museum_with_contacts_tags_and_services_still_excluded(self):
        r = self.record()
        r["name"] = "Muzeul Satului"
        r["source_flags"]["business"] = True
        r["fields"]["Meniu/ Servicii"] = "Tur ghidat și degustare de vin, rezervare la telefon"
        self.assertEqual(classify(r)["bucket"], "exclude")

    def test_pension_with_museum_description_is_location(self):
        r = self.record()
        r["name"] = "Pensiunea La Cuptor"
        r["description"] = "Muzeul pâinii"
        self.assertEqual(classify(r)["bucket"], "location")

    def test_tags_never_confirm_reservability(self):
        r = self.record()
        r["name"] = "Pensiunea Test"
        r["fields"].pop("Meniu/ Servicii")
        result = classify(r)
        self.assertEqual(result["booking_status"], "contact_only")
        wine = next(a for a in result["experience_candidates"] if a["name"] == "Degustare de vin")
        self.assertEqual(wine["evidence_level"], "tag_only")
        self.assertFalse(wine["reservation_confirmed"])

    def test_reserve_nature_word_is_not_booking_evidence(self):
        r = self.record()
        r["fields"].pop("Meniu/ Servicii")
        r["fields"]["Curiozitate"] = "Priveliște spre rezervația naturală."
        self.assertEqual(classify(r)["booking_status"], "contact_only")

    def test_editorial_override_is_not_approval(self):
        r = self.record()
        result = classify(r, {r["id"]: {"bucket": "experience", "category": "experience", "reason": "Verificare editorială"}})
        self.assertEqual(result["suggested_kind"], "experience")
        self.assertEqual(r["review_decision"], "pending")

    def test_report_escapes_source_and_keeps_all_records(self):
        r = self.record()
        r["name"] = '</script><script>alert("unsafe")</script>'
        snapshot = {"records": [r], "source": "https://www.implicareplus.org/vtb/", "extracted_at": "2026-10-30T00:00:00+00:00", "complete": True}
        with tempfile.TemporaryDirectory() as folder:
            output = Path(folder)
            write_review(output, snapshot)
            html = (output / "review.html").read_text()
            self.assertNotIn(r["name"], html)
            saved = json.loads((output / "catalog.json").read_text())
            self.assertEqual(len(saved["records"]), 1)
            self.assertEqual(saved["summary"]["approved_by_user"], 0)
            self.assertEqual(saved["records"][0]["review_decision"], "pending")


if __name__ == "__main__":
    unittest.main()
