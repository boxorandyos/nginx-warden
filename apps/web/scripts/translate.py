#!/usr/bin/env python3
"""
Sync locale JSON files from src/locales/en.json using machine translation (Google via deep-translator).

Behaviour
  - Output keys and order always match en.json (extra keys in a locale file are dropped).
  - If a locale file is missing: create it with translated strings.
  - If it exists: keep any value that differs from the current English (treated as human-edited).
  - Otherwise: fill or refresh with translation from English (missing key, or still identical to en).

Options
  --locales vi,de,fr   Comma-separated ISO-ish codes (files: src/locales/<code>.json).
  --all               All *.json in src/local,es except en.json
  --dry-run           Print plan only; no writes
  --retranslate-all   Translate every key (ignores preserved non-English strings). Use with care.

Background usage
  Windows PowerShell:
    Start-Process python -ArgumentList 'scripts/translate.py','--all' `
      -WorkingDirectory (Resolve-Path .) -WindowStyle Hidden -RedirectStandardOutput sync-i18n.log

  Bash:
    cd apps/web && nohup python scripts/translate.py --all > sync-i18n.log 2>&1 &

Requires: pip install -r scripts/requirements-locales.txt
"""

from __future__ import annotations

import argparse
import json
import sys
import time
from pathlib import Path

try:
    from deep_translator import GoogleTranslator
except ImportError as e:
    print(
        "Missing dependency: pip install -r scripts/requirements-locales.txt",
        file=sys.stderr,
    )
    raise SystemExit(1) from e

ROOT = Path(__file__).resolve().parent.parent
LOCALES_DIR = ROOT / "src" / "locales"

# Google Translate target codes (override when they differ from our file suffix).
GOOGLE_TARGET_BY_LOCALE: dict[str, str] = {
    "zh": "zh-CN",
    "zh-CN": "zh-CN",
}


def discover_locale_files() -> list[str]:
    codes: list[str] = []
    for p in sorted(LOCALES_DIR.glob("*.json")):
        if p.name == "en.json":
            continue
        codes.append(p.stem)
    return codes


def google_target(locale_code: str) -> str:
    return GOOGLE_TARGET_BY_LOCALE.get(locale_code, locale_code)


def load_en() -> dict[str, str]:
    path = LOCALES_DIR / "en.json"
    return json.loads(path.read_text(encoding="utf-8"))


def load_existing(locale_code: str) -> dict[str, str]:
    path = LOCALES_DIR / f"{locale_code}.json"
    if not path.is_file():
        return {}
    return json.loads(path.read_text(encoding="utf-8"))


def translate_text(translator: GoogleTranslator, text: str, *, retries: int = 3) -> str:
    last = text
    for attempt in range(retries):
        try:
            return translator.translate(text)
        except Exception as e:
            last = e
            time.sleep(1.5 * (attempt + 1))
    print(f"  translate failed after {retries}: {last}", file=sys.stderr)
    return text


def translate_batch_safe(translator: GoogleTranslator, texts: list[str], chunk: int = 22) -> list[str]:
    if not texts:
        return []
    out: list[str] = []
    for i in range(0, len(texts), chunk):
        batch = texts[i : i + chunk]
        try:
            batch_out = translator.translate_batch(batch)
            if len(batch_out) != len(batch):
                raise ValueError("batch length mismatch")
            out.extend(batch_out)
        except Exception:
            for t in batch:
                out.append(translate_text(translator, t))
                time.sleep(0.1)
        time.sleep(0.35)
    return out


def build_todo_keys(
    en: dict[str, str],
    existing: dict[str, str],
    *,
    retranslate_all: bool,
) -> list[str]:
    keys_in_order = list(en.keys())
    if retranslate_all:
        return keys_in_order
    todo: list[str] = []
    for k in keys_in_order:
        if k not in existing:
            todo.append(k)
        elif existing.get(k) == en[k]:
            todo.append(k)
    return todo


def sync_one_locale(
    locale_code: str,
    en: dict[str, str],
    *,
    dry_run: bool,
    retranslate_all: bool,
) -> tuple[int, int]:
    """Returns (translated_count, preserved_count)."""
    target = google_target(locale_code)
    if not target:
        print(f"Skip unknown target mapping for {locale_code!r}", file=sys.stderr)
        return (0, 0)

    existing = load_existing(locale_code)
    todo_keys = build_todo_keys(en, existing, retranslate_all=retranslate_all)
    to_translate = len(todo_keys)
    preserved_est = len(en) - to_translate

    print(
        f"[{locale_code}] keys={len(en)} translate={to_translate} "
        f"preserve≈{preserved_est} dry_run={dry_run}",
        file=sys.stderr,
    )

    if not todo_keys:
        # All strings already diverge from English (or file empty with no keys — unused).
        merged = {k: existing[k] for k in en if k in existing}
        missing = [k for k in en if k not in existing]
        if missing:
            print(f"  error: missing keys without todo: {missing[:3]}…", file=sys.stderr)
            raise SystemExit(1)
        if not dry_run:
            write_json(LOCALES_DIR / f"{locale_code}.json", merged)
            print(f"  wrote {locale_code}.json (trim / reorder only)", file=sys.stderr)
        return (0, len(en))

    translator = GoogleTranslator(source="en", target=target)
    texts = [en[k] for k in todo_keys]
    if dry_run:
        return (len(texts), preserved_est)

    translated_values = translate_batch_safe(translator, texts)
    tv_map = dict(zip(todo_keys, translated_values))
    if len(tv_map) != len(todo_keys):
        raise RuntimeError("translation count mismatch")

    new_map: dict[str, str] = {}
    for k in en:
        if k in tv_map:
            new_map[k] = tv_map[k]
        else:
            new_map[k] = existing[k]

    out_path = LOCALES_DIR / f"{locale_code}.json"
    write_json(out_path, new_map)
    print(f"  wrote {out_path.name}", file=sys.stderr)
    return (to_translate, preserved_est)


def write_json(path: Path, data: dict[str, str]) -> None:
    text = json.dumps(data, ensure_ascii=False, indent=2) + "\n"
    tmp = path.with_suffix(path.suffix + ".tmp")
    tmp.write_text(text, encoding="utf-8")
    tmp.replace(path)


def parse_args() -> argparse.Namespace:
    p = argparse.ArgumentParser(description="Sync locale JSON files from en.json via MT.")
    p.add_argument(
        "--locales",
        type=str,
        default="",
        help="Comma-separated locale codes (e.g. vi,de,fr,pt)",
    )
    p.add_argument(
        "--all",
        dest="all_locales",
        action="store_true",
        help="Process every locale file in src/locales except en.json",
    )
    p.add_argument("--dry-run", action="store_true")
    p.add_argument(
        "--retranslate-all",
        action="store_true",
        help="Replace every value with a new translation (does not keep human edits).",
    )
    return p.parse_args()


def main() -> None:
    args = parse_args()
    en = load_en()

    if args.all_locales:
        codes = discover_locale_files()
    elif args.locales.strip():
        codes = [c.strip() for c in args.locales.split(",") if c.strip()]
    else:
        print("Specify --locales vi,de,... or --all", file=sys.stderr)
        raise SystemExit(2)

    if "en" in codes:
        print("Ignoring 'en' in target list.", file=sys.stderr)
        codes = [c for c in codes if c != "en"]

    total_t = 0
    for code in codes:
        t, _ = sync_one_locale(
            code,
            en,
            dry_run=args.dry_run,
            retranslate_all=args.retranslate_all,
        )
        total_t += t

    print(f"Done. Total strings translated this run ≈ {total_t}", file=sys.stderr)


if __name__ == "__main__":
    main()
