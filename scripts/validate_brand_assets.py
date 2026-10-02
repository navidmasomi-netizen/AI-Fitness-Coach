#!/usr/bin/env python3
"""Validate RUNPUY brand assets and emit a machine-readable report."""

from __future__ import annotations

import hashlib
import json
import xml.etree.ElementTree as ET
from datetime import date
from pathlib import Path

from PIL import Image
from pypdf import PdfReader

ROOT = Path(__file__).resolve().parents[1]
EXPECTED_COLORS = {"#F7F7F4", "#111719", "#0D1417", "#163A52", "#18B887", "#E6F6EF", "#E5E7EB", "#667085"}


def main() -> None:
    checks = []
    errors = []
    files = [p for p in ROOT.rglob("*") if p.is_file() and ".git" not in p.parts and p.name not in {"SHA256SUMS", "validation.json"}]
    empty = [str(p.relative_to(ROOT)) for p in files if p.stat().st_size == 0]
    checks.append({"name": "no_empty_files", "passed": not empty, "details": empty})
    errors.extend(f"Empty file: {p}" for p in empty)

    svg_errors = []
    svgs = [p for p in files if p.suffix.lower() == ".svg"]
    for path in svgs:
        try:
            ET.parse(path)
        except Exception as exc:
            svg_errors.append(f"{path.relative_to(ROOT)}: {exc}")
    checks.append({"name": "svg_xml", "passed": not svg_errors, "count": len(svgs), "details": svg_errors})
    errors.extend(svg_errors)

    png_errors = []
    pngs = [p for p in files if p.suffix.lower() == ".png"]
    for path in pngs:
        try:
            with Image.open(path) as image:
                image.verify()
        except Exception as exc:
            png_errors.append(f"{path.relative_to(ROOT)}: {exc}")
    checks.append({"name": "png_decode", "passed": not png_errors, "count": len(pngs), "details": png_errors})
    errors.extend(png_errors)

    pdf_errors = []
    pdfs = [p for p in files if p.suffix.lower() == ".pdf"]
    for path in pdfs:
        try:
            if len(PdfReader(path).pages) < 1:
                raise ValueError("PDF has no pages")
        except Exception as exc:
            pdf_errors.append(f"{path.relative_to(ROOT)}: {exc}")
    checks.append({"name": "pdf_decode", "passed": not pdf_errors, "count": len(pdfs), "details": pdf_errors})
    errors.extend(pdf_errors)

    token_path = ROOT / "assets/brand/06-tokens/runpuy-brand-tokens.json"
    tokens = json.loads(token_path.read_text(encoding="utf-8"))
    found = set(tokens["color"]["primitive"].values())
    missing_colors = sorted(EXPECTED_COLORS - found)
    checks.append({"name": "approved_palette", "passed": not missing_colors, "details": missing_colors})
    errors.extend(f"Missing approved color: {c}" for c in missing_colors)

    ios = ROOT / "assets/brand/02-app-icons/ios/runpuy-app-icon-ios.png"
    with Image.open(ios) as image:
        opaque = image.mode == "RGB" or (image.mode == "RGBA" and image.getchannel("A").getextrema() == (255, 255))
        correct_size = image.size == (1024, 1024)
    checks.append({"name": "ios_icon", "passed": opaque and correct_size, "details": {"size": list(image.size), "opaque": opaque}})
    if not opaque or not correct_size:
        errors.append("iOS icon must be opaque 1024x1024")

    required = [
        "assets/brand/01-logo/svg/runpuy-primary-horizontal.svg",
        "assets/brand/02-app-icons/android/ic_launcher_foreground.svg",
        "assets/brand/02-app-icons/web/favicon.ico",
        "assets/brand/05-iconography/navigation/home.svg",
        "assets/brand/06-tokens/runpuy-tokens.css",
        "assets/brand/06-tokens/runpuy-tokens.ts",
        "docs/brand-system/16-final-brand-audit.md",
    ]
    absent = [path for path in required if not (ROOT / path).exists()]
    checks.append({"name": "required_assets", "passed": not absent, "details": absent})
    errors.extend(f"Missing required asset: {p}" for p in absent)

    report = {
        "brand": "RUNPUY",
        "release": "1.0.0-rc.1",
        "validated_on": date.today().isoformat(),
        "passed": not errors,
        "summary": {"files": len(files), "svg": len(svgs), "png": len(pngs), "pdf": len(pdfs)},
        "checks": checks,
        "errors": errors,
    }
    report_dir = ROOT / "reports"
    report_dir.mkdir(exist_ok=True)
    (report_dir / "validation.json").write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")

    manifest_files = [p for p in ROOT.rglob("*") if p.is_file() and ".git" not in p.parts and p.name not in {"SHA256SUMS", "validation.json"}]
    lines = []
    for path in sorted(manifest_files):
        digest = hashlib.sha256(path.read_bytes()).hexdigest()
        lines.append(f"{digest}  {path.relative_to(ROOT)}")
    (report_dir / "SHA256SUMS").write_text("\n".join(lines) + "\n", encoding="utf-8")
    print(json.dumps({"passed": report["passed"], **report["summary"]}))
    raise SystemExit(0 if report["passed"] else 1)


if __name__ == "__main__":
    main()

