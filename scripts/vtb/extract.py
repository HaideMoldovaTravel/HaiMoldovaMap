#!/usr/bin/env python3
"""Public VTB catalogue snapshot and editorial review. Never writes to a database.

Python 3.10+, standard library only. Run from any working directory.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import re
import sys
import time
import unicodedata
from datetime import datetime, timezone
from html.parser import HTMLParser
from pathlib import Path
from urllib.error import HTTPError, URLError
from urllib.parse import urljoin, urlparse
from urllib.request import Request, urlopen
from zoneinfo import ZoneInfo

SOURCE = "https://www.implicareplus.org/vtb/"
ROOT = Path(__file__).resolve().parents[2]
VOID = {"area", "base", "br", "col", "embed", "hr", "img", "input", "link", "meta", "param", "source", "track", "wbr"}


class Node:
    def __init__(self, tag="root", attrs=(), parent=None):
        self.tag, self.attrs, self.parent = tag, dict(attrs), parent
        self.children = []

    def find(self, tag=None, **attrs):
        for child in self.children:
            if isinstance(child, Node):
                if (tag is None or child.tag == tag) and all(child.attrs.get(k) == v for k, v in attrs.items()):
                    yield child
                yield from child.find(tag, **attrs)

    def text(self):
        if self.tag in {"script", "style"}:
            return ""
        # Cloudflare email spans contain public contact information, not footer data.
        if "data-cfemail" in self.attrs:
            try:
                data = bytes.fromhex(self.attrs["data-cfemail"])
                return bytes(c ^ data[0] for c in data[1:]).decode("utf-8")
            except (ValueError, UnicodeDecodeError):
                pass
        return re.sub(r"\s+", " ", " ".join(c.text() if isinstance(c, Node) else c for c in self.children)).strip()


class Document(HTMLParser):
    def __init__(self, html):
        super().__init__(convert_charrefs=True)
        self.root = Node()
        self.current = self.root
        self.feed(html)

    def handle_starttag(self, tag, attrs):
        child = Node(tag, attrs, self.current)
        self.current.children.append(child)
        if tag not in VOID:
            self.current = child

    def handle_startendtag(self, tag, attrs):
        self.handle_starttag(tag, attrs)
        if tag not in VOID:
            self.handle_endtag(tag)

    def handle_endtag(self, tag):
        node = self.current
        while node.parent:
            if node.tag == tag:
                self.current = node.parent
                return
            node = node.parent

    def handle_data(self, data):
        self.current.children.append(data)


def normalized(text):
    return "".join(c for c in unicodedata.normalize("NFKD", text.lower()) if not unicodedata.combining(c))


def safe_url(value, base=SOURCE):
    url = urljoin(base, value)
    return url if urlparse(url).scheme in {"https", "http"} else None


def checkbox(root, id):
    element = next(root.find("input", id=id), None)
    return None if element is None else "checked" in element.attrs


def parse_index(html, url=SOURCE):
    root = Document(html).root
    locations, pages = {}, set()
    for a in root.find("a"):
        target = safe_url(a.attrs.get("href", ""), url)
        if not target or urlparse(target).netloc != urlparse(SOURCE).netloc:
            continue
        match = re.fullmatch(r"/vtb/location/(\d+)/?", urlparse(target).path)
        if match:
            locations[match[1]] = target
        elif urlparse(target).path == "/vtb/" and re.search(r"(?:\?|&)page=\d+", target):
            pages.add(target)
    # The current source groups every record by region and declares group counts.
    counts = [int(m[1]) for h in root.find("h3") if (m := re.search(r"\((\d+)\)\s*$", h.text()))]
    return locations, sorted(pages), sum(counts) if counts else None


def parse_detail(html, source_url):
    root = Document(html).root
    title = next(root.find("h1"), None)
    if title is None or not title.text():
        raise ValueError("Fișă fără titlu: posibilă pagină de autentificare sau eroare")
    fields, field_links = {}, {}
    for li in root.find("li"):
        if "list-group-item" not in li.attrs.get("class", "").split():
            continue
        strong = next((c for c in li.children if isinstance(c, Node) and c.tag == "strong"), None)
        if strong is None:
            continue
        label = strong.text().rstrip(":").strip()
        # Remove only the field label, preserve Unicode and all source values.
        value = li.text()[len(strong.text()):].strip()
        if label == "Orar de Functionare":
            value = " · ".join(n.text() for n in li.find("li"))
        fields[label] = value
        links = [u for a in li.find("a") if (u := safe_url(a.attrs.get("href", ""), source_url)) and "/cdn-cgi/" not in u]
        for match in re.finditer(r'''(?:https?://|www\.)[^\s<>"']+''', value):
            raw_url = match[0].rstrip(".,;!?)")
            if u := safe_url(raw_url if raw_url.startswith("http") else "https://" + raw_url):
                links.append(u)
        if links:
            field_links[label] = list(dict.fromkeys(links))
    sections = {}
    for heading in root.find("h5"):
        if heading.text() not in {"Categorii", "Activități/ Subcategorii"}:
            continue
        body = heading.parent
        sections[heading.text()] = [li.text() for li in body.find("li") if not list(li.find("li"))]
    images = []
    for img in root.find("img"):
        src = safe_url(img.attrs.get("src", ""), source_url)
        if src and "/media/location_media/" in src:
            ancestor, role = img.parent, "cover"
            while ancestor and ancestor.tag != "li":
                ancestor = ancestor.parent
            if ancestor:
                label = next(ancestor.find("strong"), None)
                role = label.text().rstrip(":") if label else "supplementary"
            images.append({"url": src, "alt": img.attrs.get("alt", title.text()), "role": role})
    # Some records may expose additional media through gallery links.
    for a in root.find("a"):
        src = safe_url(a.attrs.get("href", ""), source_url)
        if src and "/media/location_media/" in src and re.search(r"\.(jpg|jpeg|png|webp|gif)(?:\?|$)", src, re.I):
            images.append({"url": src, "alt": title.text(), "role": "gallery"})
    images = list({i["url"]: i for i in images}.values())
    description = next((p.text() for p in root.find("p") if "h5" in p.attrs.get("class", "").split()), "")
    def number(label):
        try:
            return float(fields.get(label, "").replace(",", "."))
        except ValueError:
            return None
    lat, lng = number("Latitudine"), number("Longitudine")
    coordinates = {"latitude": lat, "longitude": lng} if lat is not None and lng is not None and 45 <= lat <= 49 and 26 <= lng <= 31 else None
    contact_raw = fields.get("Informații de Contact", "")
    contact = Document(contact_raw).root.text() if re.search(r"</?(?:a|b|p|span|br)\b", contact_raw) else contact_raw
    phones = []
    for match in re.finditer(r"(?<!\d)(?:\+\s*\d|0)[\d\s().-]{7,18}\d", contact):
        digits = re.sub(r"\D", "", match[0])
        if len(digits) == 9 and digits.startswith("0"):
            digits = "373" + digits[1:]
        if len(digits) == 11 and digits.startswith("373"):
            phones.append("+" + digits)
        elif match[0].lstrip().startswith("+") and not digits.startswith("373") and 8 <= len(digits) <= 15:
            phones.append("+" + digits)
    return {
        "id": "vtb-" + re.search(r"/location/(\d+)", source_url)[1],
        "source_url": source_url, "name": title.text(), "description": description,
        "locality": fields.get("Localitate", ""), "district": fields.get("Regiune", ""),
        "country": fields.get("Țară", ""), "coordinates": coordinates,
        "categories": sections.get("Categorii", []), "activities": sections.get("Activități/ Subcategorii", []),
        "contact_text": contact, "phones": list(dict.fromkeys(phones)),
        "emails": sorted(set(re.findall(r"[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}", contact))),
        "source_flags": {"business": checkbox(root, "isBusinessSwitch"), "approved": checkbox(root, "approvedSwitch"), "available": checkbox(root, "availableSwitch"), "open_24h": checkbox(root, "open24Switch")},
        "images": images, "fields": fields, "field_links": field_links,
        "media_links": list(dict.fromkeys(u for tag in ("source", "video", "audio") for element in root.find(tag) if (u := safe_url(element.attrs.get("src", ""), source_url)) and element.attrs.get("src"))),
        "publication_scope": "map_only", "sync_to_haide": False,
        "review_decision": "pending", "review_notes": "",
    }


def fetch(url, limit=30 * 1024 * 1024):
    for attempt in range(3):
        try:
            request = Request(url, headers={"User-Agent": "Mozilla/5.0 (compatible; MapTravelMoldovaCatalogReview/1.0)", "Accept": "*/*"})
            with urlopen(request, timeout=35) as response:
                data = response.read(limit + 1)
                if len(data) > limit:
                    raise ValueError(f"Răspuns prea mare: {url}")
                return data, response.headers.get_content_type()
        except (HTTPError, URLError, TimeoutError):
            if attempt == 2:
                raise
            time.sleep(1 + attempt * 2)
    raise RuntimeError("unreachable")


def json_write(path, data):
    path.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def run(args):
    output = args.output.resolve()
    raw = output / "raw"
    raw.mkdir(parents=True, exist_ok=True)
    pending, visited, found, errors = [SOURCE], set(), {}, []
    declared = None
    while pending:
        url = pending.pop(0)
        if url in visited:
            continue
        visited.add(url)
        if len(visited) > 100:
            raise ValueError("Paginare excesivă")
        path = raw / f"index-{len(visited)}.html"
        if not path.exists() or args.refresh:
            data, _ = fetch(url)
            path.write_bytes(data)
            time.sleep(args.delay)
        locations, pages, count = parse_index(path.read_text(encoding="utf-8"), url)
        found.update(locations)
        pending.extend(p for p in pages if p not in visited)
        if count is not None:
            declared = (declared or 0) + count
    if not found:
        raise ValueError("Catalog gol: extragerea se oprește")
    records = []
    for i, (id, url) in enumerate(found.items(), 1):
        path = raw / f"location-{id}.html"
        try:
            if not path.exists() or args.refresh:
                data, _ = fetch(url)
                path.write_bytes(data)
                time.sleep(args.delay)
            record = parse_detail(path.read_text(encoding="utf-8"), url)
            record["retrieved_at"] = datetime.fromtimestamp(path.stat().st_mtime, timezone.utc).isoformat()
            records.append(record)
        except Exception as error:
            errors.append({"url": url, "stage": "detail", "error": str(error)})
        if i % 25 == 0 or i == len(found):
            print(f"Fișe: {i}/{len(found)}; erori: {len(errors)}", flush=True)
    snapshot = {"schema_version": 1, "source": SOURCE, "extracted_at": datetime.fromtimestamp((raw / "index-1.html").stat().st_mtime, timezone.utc).isoformat(), "discovered": len(found), "declared_count": declared, "index_pages": sorted(visited), "complete": not errors and (declared is None or declared == len(found)), "errors": errors, "records": records}
    # Save early so a failed later media download never loses the inventory.
    json_write(output / "catalog.json", snapshot)
    if not snapshot["complete"]:
        print("Inventar incomplet; consultați catalog.json. Reexecutarea reia fișele lipsă.", file=sys.stderr)
        return 1
    if args.images:
        media = output / "images"
        media.mkdir(exist_ok=True)
        for i, record in enumerate(records, 1):
            for image in record["images"]:
                suffix = Path(urlparse(image["url"]).path).suffix.lower()
                path = media / (hashlib.sha256(image["url"].encode()).hexdigest()[:24] + suffix)
                try:
                    if not path.exists():
                        data, content_type = fetch(image["url"])
                        if content_type not in {"image/jpeg", "image/png", "image/webp", "image/gif"}:
                            raise ValueError("Tip media neașteptat: " + content_type)
                        path.write_bytes(data)
                        time.sleep(args.delay)
                    image.update({"local_path": str(path.relative_to(output)), "bytes": path.stat().st_size, "sha256": hashlib.sha256(path.read_bytes()).hexdigest()})
                except Exception as error:
                    image["error"] = str(error)
                    errors.append({"url": image["url"], "stage": "image", "error": str(error)})
            if i % 25 == 0 or i == len(records):
                print(f"Imagini: fișa {i}/{len(records)}", flush=True)
        json_write(output / "catalog.json", snapshot)
    # Editorial classification/reporting is separate from network extraction.
    from review import write_review
    write_review(output, snapshot)
    print(f"Rezultat: {output}; fișe {len(records)}; erori {len(errors)}", flush=True)
    return 1 if errors else 0


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output", type=Path, default=ROOT / "data/vtb" / datetime.now(ZoneInfo("Europe/Chisinau")).date().isoformat())
    parser.add_argument("--images", action="store_true", help="Descarcă fotografiile originale publice")
    parser.add_argument("--refresh", action="store_true", help="Reîncarcă paginile; implicit reutilizează snapshotul")
    parser.add_argument("--delay", type=float, default=0.3, help="Pauză între cereri, în secunde")
    args = parser.parse_args()
    if args.delay < 0.1:
        parser.error("--delay trebuie să fie minimum 0.1 secunde")
    sys.exit(run(args))
