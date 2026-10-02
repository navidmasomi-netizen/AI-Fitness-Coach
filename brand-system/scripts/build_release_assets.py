#!/usr/bin/env python3
"""Build deterministic RUNPUY platform assets, icons and code tokens."""

from __future__ import annotations

import json
import re
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
ASSETS = ROOT / "assets" / "brand"
INK = "#111719"
NIGHT = "#0D1417"
EMERALD = "#18B887"
WHITE = "#F7F7F4"


def write(path: Path, content: str) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(content.strip() + "\n", encoding="utf-8")


def export_png(svg: Path, png: Path, width: int) -> None:
    subprocess.run(
        ["inkscape", str(svg), "--export-filename", str(png), "--export-width", str(width)],
        check=True,
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
    )


def glyph_path() -> str:
    source = (ASSETS / "01-logo/svg/runpuy-glyph-white.svg").read_text(encoding="utf-8")
    match = re.search(r'<path d="([^"]+)"', source)
    if not match:
        raise RuntimeError("Approved R glyph path not found")
    return match.group(1)


def build_platform_icons() -> None:
    path_data = glyph_path()
    ios = ASSETS / "02-app-icons/ios/runpuy-app-icon-ios.svg"
    write(ios, f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" role="img" aria-label="RUNPUY iOS app icon master">
  <rect width="512" height="512" fill="{NIGHT}"/>
  <g transform="scale(4.5309734513)"><path d="{path_data}" fill="{WHITE}" fill-rule="evenodd" clip-rule="evenodd"/></g>
</svg>''')
    export_png(ios, ios.with_suffix(".png"), 1024)

    android = ASSETS / "02-app-icons/android"
    write(android / "ic_launcher_background.svg", f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 108 108"><rect width="108" height="108" fill="{NIGHT}"/></svg>''')
    write(android / "ic_launcher_foreground.svg", f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 108 108" role="img" aria-label="RUNPUY Android adaptive foreground">
  <g transform="translate(-2.5 -2.5)"><path d="{path_data}" fill="{WHITE}" fill-rule="evenodd" clip-rule="evenodd"/></g>
</svg>''')
    write(android / "ic_launcher_monochrome.svg", f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 108 108" role="img" aria-label="RUNPUY Android monochrome icon">
  <g transform="translate(-2.5 -2.5)"><path d="{path_data}" fill="#000000" fill-rule="evenodd" clip-rule="evenodd"/></g>
</svg>''')

    web = ASSETS / "02-app-icons/web"
    favicon_svg = web / "favicon.svg"
    write(favicon_svg, f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" role="img" aria-label="RUNPUY web icon">
  <rect width="512" height="512" rx="96" fill="{NIGHT}"/>
  <g transform="scale(4.5309734513)"><path d="{path_data}" fill="{WHITE}" fill-rule="evenodd" clip-rule="evenodd"/></g>
</svg>''')
    for size, name in [(16, "favicon-16.png"), (32, "favicon-32.png"), (180, "apple-touch-icon.png"), (192, "pwa-192.png"), (512, "pwa-512.png")]:
        export_png(favicon_svg, web / name, size)
    subprocess.run(
        ["convert", str(web / "favicon-16.png"), str(web / "favicon-32.png"), str(web / "favicon.ico")],
        check=True,
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
    )


def build_icons() -> None:
    source = (ASSETS / "05-iconography/reference/01-runpuy-iconography-system.svg").read_text(encoding="utf-8")
    groups = {
        "navigation": ["home", "workout", "progress", "coach", "profile"],
        "health": ["heart", "sleep", "recovery", "readiness", "steps", "calories", "timer"],
    }
    for group, names in groups.items():
        for name in names:
            match = re.search(rf'<symbol id="{name}" viewBox="0 0 24 24">(.*?)</symbol>', source)
            if not match:
                raise RuntimeError(f"Icon symbol not found: {name}")
            write(ASSETS / f"05-iconography/{group}/{name}.svg", f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" role="img" aria-label="RUNPUY {name} icon">
  <g fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">{match.group(1)}</g>
</svg>''')


def flatten(data: dict, prefix: str = "") -> dict[str, str | int | float | bool]:
    result = {}
    for key, value in data.items():
        name = f"{prefix}-{key}" if prefix else key
        if isinstance(value, dict):
            result.update(flatten(value, name))
        else:
            result[name] = value
    return result


def kebab(value: str) -> str:
    return re.sub(r"(?<!^)(?=[A-Z])", "-", value).lower()


def build_tokens() -> None:
    token_dir = ASSETS / "06-tokens"
    tokens = json.loads((token_dir / "runpuy-brand-tokens.json").read_text(encoding="utf-8"))
    flat = flatten(tokens)
    css_lines = [":root {"]
    for key, value in flat.items():
        if isinstance(value, bool):
            rendered = str(value).lower()
        elif isinstance(value, (int, float)):
            unit = "ms" if key.startswith("motion-") else ("px" if key.startswith(("spacing-", "radius-", "layout-", "typography-scale-")) and not key.endswith("weight") else "")
            rendered = f"{value}{unit}"
        else:
            rendered = str(value)
        css_lines.append(f"  --runpuy-{kebab(key)}: {rendered};")
    css_lines.append("}")
    write(token_dir / "runpuy-tokens.css", "\n".join(css_lines))
    write(token_dir / "runpuy-tokens.ts", "// Generated from runpuy-brand-tokens.json. Do not edit directly.\nexport const runpuyTokens = " + json.dumps(tokens, ensure_ascii=False, indent=2) + " as const;")


if __name__ == "__main__":
    build_platform_icons()
    build_icons()
    build_tokens()
    print("RUNPUY release assets built successfully")

