"""Editorial proposals, deliberately distinct from human approval."""
import hashlib
import json
import re
from collections import Counter, defaultdict
from html import escape
from pathlib import Path
from datetime import datetime
from zoneinfo import ZoneInfo

from extract import normalized, json_write

LABELS = {"location": "Locație propusă", "experience": "Experiență propusă", "review": "De verificat", "exclude": "Excludere propusă"}
ACTIVITIES = [
    ("Atelier gastronomic", r"atelier\w* gastronom|master.?class.{0,35}(placint|paine|gatit)|coac\w*.{0,25}(paine|placint)"),
    ("Degustare de vin", r"degust\w*.{0,20}vin|vin.{0,20}degust|wine tasting"),
    ("Degustare de produse locale", r"degust"),
    ("Atelier de meșteșuguri", r"atelier\w*.{0,30}(olar|ceramic|mest|tesut|pict|creati)|master.?class|olarit"),
    ("Apiterapie", r"apiterap|cas\w* albin|terap\w*.{0,20}albin"),
    ("Vizită la prisacă", r"prisac|stupin|apicol"),
    ("Plimbare călare", r"calar|echitat|calarie"),
    ("Plimbare cu caiacul / barca", r"caiac|kayak|canoe|plimbar\w*.{0,20}barc"),
    ("Plimbare cu ATV", r"\batv\b|cvadricicl"),
    ("Tur ghidat / excursie", r"tur\w* ghid|excurs"),
    ("Baie în ciubăr / saună", r"ciubar|sauna"),
    ("Activitate la fermă", r"ferm[aă]|animal\w* domestic"),
]


def classify(record, overrides=None):
    name = normalized(record["name"])
    fields = record["fields"]
    service = fields.get("Meniu/ Servicii", "")
    provider_text = " ".join([record["description"], service, fields.get("Curiozitate", ""), fields.get("Sfat / Logistic", "")])
    text = normalized(provider_text)
    has_contact = bool(record["contact_text"].strip())
    # The source's category/activities checklists are tourism tags, not offers.
    heritage = r"muze\w*|biseric\w*|manastir\w*|monument\w*|memorial\w*|statu\w*|bust\w*|cavou\w*|cetat\w*|ruin\w*|arcul\w*|scoala|casa de cultura|centru\w* cultural|statia cu mozaic|podul|tabara regelui|cimitir|catedral|chilia|sanctuar|curtea domneasca|lumanarea recunostintei|stela|galeria colectiilor|moara de|conacul (?:boierului|ralli|gonata|manuc|dino|nicolae|lui nicolae)"
    venue = r"pensiun|casa rurala|casa de vacanta|casut\w*.{0,20}(vacanta|padure)|hotel|resort|eco.village|camping|glamping|terasa|restaurant|catering|vinar|crama|chateau|complex\w*.{0,20}(turistic|agrotur)|hanul|home\b"
    activity = r"atelier|prisac|stupin|apiterap|echitat|caiac|kayak|olarit|mest\w* popular|ceramic"
    nature = r"izvor|fantan|belvedere|beldevere|cascad|gura riului|gura raului|stanca|defileu|grota|recif|lac\w*|parc\w*|rezervati|padur\w*|vale\w*|dealul|cotul|movil|rapa|cheile|stejar|grumazul|puntea|butoiul|tara batlanilor"
    if re.search(heritage, name):
        bucket, category, reason = "exclude", None, "Muzeu, monument, lăcaș de cult sau patrimoniu de vizitare; în afara selecției cerute."
    elif re.search(venue, name):
        bucket = "location"
        category = "winery" if re.search(r"vinar|crama|chateau|wine", name) else "food" if re.search(r"terasa|restaurant|catering", name) else "stay"
        reason = "Unitate de cazare, gastronomie sau vinărie identificată în denumire; propusă ca locație pe hartă."
    elif re.search(activity, name) and has_contact:
        bucket, category, reason = "experience", "experience", "Furnizor de activitate identificabil și contact public; rezervarea efectivă trebuie confirmată."
    elif record["source_flags"]["business"] and service:
        bucket, category, reason = "location", "nature", "Fișa publică declară afacere și descrie servicii; propusă ca locație, cu verificarea tipului."
    elif re.search(nature, name) and not service:
        bucket, category, reason = "exclude", None, "Obiectiv natural de vizitare, fără serviciu organizat demonstrat în fișă."
    else:
        bucket, category, reason = "review", None, "Nu există suficiente indicii pentru o locație comercială sau o activitate rezervabilă."
    if overrides and record["id"] in overrides:
        override = overrides[record["id"]]
        bucket, category, reason = override["bucket"], override.get("category"), override["reason"]

    booking_mentions = []
    for label in ["Meniu/ Servicii", "Informații de Contact", "Sfat / Logistic", "Curiozitate"]:
        value = fields.get(label, "")
        if re.search(r"rezerv(?!ati[ae])|programar|prealabil|booking", normalized(value)):
            booking_mentions.append({"field": label, "text": value})
    booking_status = "explicit_request" if booking_mentions and has_contact else "mentioned_no_contact" if booking_mentions else "contact_only" if has_contact else "unverified"
    candidates = []
    if bucket in {"location", "experience", "review"}:
        tags = normalized(" ".join(record["activities"]))
        for label, pattern in ACTIVITIES:
            explicit = bool(re.search(pattern, text))
            tagged = bool(re.search(pattern, tags))
            if explicit or tagged:
                candidates.append({"name": label, "evidence_level": "description" if explicit else "tag_only", "reservation_confirmed": False})
    issues = []
    if not record["coordinates"]:
        issues.append("Coordonate exacte lipsă sau invalide; nu se ghicește poziția.")
    if not has_contact:
        issues.append("Contactul furnizorului lipsește.")
    if not record["images"]:
        issues.append("Fără fotografie publică în fișă.")
    elif any(i.get("error") for i in record["images"]):
        issues.append("Cel puțin o imagine nu poate fi descărcată de la sursă; vezi eroarea în catalog.json.")
    if not record["locality"] or not record["district"]:
        issues.append("Localitatea sau raionul lipsește la sursă; de completat înainte de import.")
    if re.search(r"\d{7}", re.sub(r"[\s()+.-]", "", record["contact_text"])) and not record["phones"]:
        issues.append("Numărul din Contact nu poate fi normalizat ca telefon valid; valoarea originală este păstrată.")
    if record["source_flags"]["approved"] is not True:
        issues.append("Fișa nu este aprobată de sursă.")
    if record["source_flags"]["available"] is not True:
        issues.append("Sursa nu confirmă disponibilitatea curentă.")
    if bucket != "exclude":
        issues.append("Prețul, durata, capacitatea și disponibilitatea rezervării nu sunt validate cu furnizorul.")
    if record["id"] == "vtb-156":
        issues.append("Meniu necorelat: fișa unui câmp de lavandă menționează preț de intrare în peșteră. Nu se reutilizează prețul.")
    if record["id"] == "vtb-127":
        issues.append("Telefonul din Contact este prea lung; în Logistic apare +373 67 913 401. De confirmat.")
    if record["id"] == "vtb-136":
        issues.append("Sezon contradictoriu în fișă: mai–septembrie versus mai–iunie și octombrie.")
    if record["id"] == "vtb-179":
        issues.append("Telefonul din Contact diferă de cel indicat pentru rezervare în Logistic. De confirmat.")
    if bucket == "experience" and not booking_mentions:
        issues.append("Nu există instrucțiuni explicite de rezervare; contactul singur nu confirmă rezervabilitatea.")
    return {"bucket": bucket, "suggested_kind": "experience" if bucket == "experience" else "location" if bucket == "location" else None, "suggested_category": category, "reason": reason, "booking_status": booking_status, "booking_evidence": booking_mentions, "experience_candidates": candidates, "issues": issues}


def write_review(output: Path, snapshot: dict):
    overrides = json.loads((Path(__file__).parent / "overrides.json").read_text(encoding="utf-8"))
    records = snapshot["records"]
    for record in records:
        record["recommendation"] = classify(record, overrides)
    # Suspected duplicates remain separate and require editorial review.
    groups = defaultdict(list)
    for record in records:
        key = re.sub(r"[^a-z0-9]", "", normalized(record["name"]))
        groups[key].append(record)
    for group in groups.values():
        if len(group) > 1:
            for record in group:
                record["possible_duplicates"] = [r["id"] for r in group if r["id"] != record["id"]]
    counts = dict(Counter(r["recommendation"]["bucket"] for r in records))
    snapshot["summary"] = {
        "by_recommendation": counts,
        "with_coordinates": sum(bool(r["coordinates"]) for r in records),
        "with_contact": sum(bool(r["contact_text"]) for r in records),
        "image_references": sum(len(r["images"]) for r in records),
        "downloaded_images": len({i["sha256"] for r in records for i in r["images"] if i.get("sha256")}),
        "image_errors": sum(bool(i.get("error")) for r in records for i in r["images"]),
        "approved_by_user": 0,
    }
    json_write(output / "catalog.json", snapshot)
    digest = hashlib.sha256((output / "catalog.json").read_bytes()).hexdigest()
    review = {"snapshot_sha256": digest, "source": snapshot["source"], "extracted_at": snapshot["extracted_at"], "summary": snapshot["summary"], "records": records}
    data = json.dumps(review, ensure_ascii=False).replace("<", "\\u003c").replace(">", "\\u003e").replace("&", "\\u0026")
    template = (Path(__file__).parent / "review.html").read_text(encoding="utf-8")
    local_date = datetime.fromisoformat(snapshot["extracted_at"]).astimezone(ZoneInfo("Europe/Chisinau")).date().isoformat()
    (output / "review.html").write_text(template.replace("__CATALOG_DATA__", data).replace("__SNAPSHOT_DATE__", local_date), encoding="utf-8")
    lines = ["# Village Travel Bot — selecție pentru validare", "", f"Sursă: {snapshot['source']}", f"Extragere: {snapshot['extracted_at']}", "", "Destinație: doar harta. Nicio fișă nu este aprobată, importată sau trimisă în Haide.", "", "Experiențele sunt propuneri; etichetele de activități și telefonul nu demonstrează că pot fi rezervate. Detaliile și imaginile sunt în review.html și catalog.json.", "", f"Total: {len(records)} fișe. Fotografii: {snapshot['summary']['image_references']} referințe, {snapshot['summary']['downloaded_images']} fișiere distincte descărcate.", ""]
    for bucket in ["location", "experience", "review", "exclude"]:
        selected = [r for r in records if r["recommendation"]["bucket"] == bucket]
        lines.extend([f"## {LABELS[bucket]} — {len(selected)}", "", "| ID | Denumire | Localitate / raion | Motiv |", "| --- | --- | --- | --- |"])
        for record in selected:
            def cell(value):
                return escape(value).replace("|", "&#124;").replace("\n", " ")
            lines.append(f"| {record['id']} | [{cell(record['name'])}]({record['source_url']}) | {cell(record['locality'] + ' / ' + record['district'])} | {cell(record['recommendation']['reason'])} |")
        lines.append("")
    (output / "lista-validare.md").write_text("\n".join(lines) + "\n", encoding="utf-8")


if __name__ == "__main__":
    import argparse
    parser = argparse.ArgumentParser(description="Regenerează lista locală fără cereri de rețea")
    parser.add_argument("output", type=Path)
    args = parser.parse_args()
    write_review(args.output, json.loads((args.output / "catalog.json").read_text(encoding="utf-8")))
