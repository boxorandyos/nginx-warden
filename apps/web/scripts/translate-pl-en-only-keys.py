"""Translate pl.json entries that still match en.json (machine translation EN→PL)."""
import json
import sys
import time
from pathlib import Path

from deep_translator import GoogleTranslator

ROOT = Path(__file__).resolve().parent.parent
LOCALES = ROOT / "src" / "locales"


def main() -> None:
    en = json.loads((LOCALES / "en.json").read_text(encoding="utf-8"))
    pl = json.loads((LOCALES / "pl.json").read_text(encoding="utf-8"))
    todo = [k for k in en if pl.get(k) == en[k]]
    if not todo:
        print("Nothing to translate (no en==pl matches).", file=sys.stderr)
        return

    print(f"Translating {len(todo)} strings still in English…", file=sys.stderr)
    t = GoogleTranslator(source="en", target="pl")

    for i, key in enumerate(todo):
        try:
            pl[key] = t.translate(en[key])
        except Exception as e:
            print(f"  failed {key!r}: {e}", file=sys.stderr)
            pl[key] = en[key]
        if (i + 1) % 20 == 0:
            print(f"  {i + 1}/{len(todo)}", file=sys.stderr)
            time.sleep(0.4)
        else:
            time.sleep(0.12)

    out = {k: pl[k] for k in en}
    (LOCALES / "pl.json").write_text(json.dumps(out, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print("Wrote pl.json", file=sys.stderr)


if __name__ == "__main__":
    main()
