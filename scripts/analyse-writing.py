#!/usr/bin/env python3
"""
Analyse a student's English writing with Claude and append the result to their
Google Sheet (Writing tab) via the existing Apps Script sync endpoint.

Zero dependencies — stdlib only. You need:
  • ANTHROPIC_API_KEY in your environment
  • .env.local present (NEXT_PUBLIC_SYNC_URL + NEXT_PUBLIC_SYNC_SECRET) — already there

Usage:
  export ANTHROPIC_API_KEY=sk-ant-...
  python3 scripts/analyse-writing.py --student ferdi --file sample.txt --title "HW2 essay"
  python3 scripts/analyse-writing.py --student valentin --text "My text here..."

It prints a summary and (unless --dry-run) writes one row to the student's
Writing tab. See MASTERPLAN.md §7.4 / §9 (Phase 2b).
"""
import argparse
import json
import os
import re
import sys
import urllib.error
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
ANTHROPIC_URL = "https://api.anthropic.com/v1/messages"
DEFAULT_MODEL = os.environ.get("ANTHROPIC_MODEL", "claude-sonnet-4-6")

SYSTEM_PROMPT = (
    "You are an experienced English-as-a-foreign-language tutor assessing a piece "
    "of writing by a teenage German-speaking (L1 German) learner, roughly A2–B1 "
    "level. Assess fairly and encouragingly. Use the CEFR scale. Identify the most "
    "useful recurring error patterns (not every slip) so the tutor knows what to "
    "teach next. Feedback must be warm and specific, never shaming. Always respond "
    "by calling the record_assessment tool."
)

ASSESSMENT_TOOL = {
    "name": "record_assessment",
    "description": "Record the structured assessment of the student's writing sample.",
    "input_schema": {
        "type": "object",
        "properties": {
            "cefr": {
                "type": "string",
                "enum": ["A1", "A2", "A2+", "B1", "B1+", "B2", "C1", "C2"],
                "description": "Overall CEFR level estimate for this sample.",
            },
            "grammar": {"type": "integer", "minimum": 0, "maximum": 10},
            "vocab": {"type": "integer", "minimum": 0, "maximum": 10},
            "coherence": {"type": "integer", "minimum": 0, "maximum": 10},
            "errors": {
                "type": "array",
                "items": {"type": "string"},
                "description": "Top 3–5 recurring error patterns, each a short phrase "
                "with a tiny example, e.g. \"3rd-person -s ('he go' → 'he goes')\".",
            },
            "feedback": {
                "type": "string",
                "description": "One encouraging paragraph (2–4 sentences) of tutor feedback.",
            },
        },
        "required": ["cefr", "grammar", "vocab", "coherence", "errors", "feedback"],
    },
}


def die(msg: str, code: int = 1):
    print(f"error: {msg}", file=sys.stderr)
    sys.exit(code)


def load_env_local() -> dict:
    """Parse .env.local into a dict (so we reuse the same sync URL + secret)."""
    env = {}
    path = ROOT / ".env.local"
    if not path.exists():
        die(".env.local not found — set up sync first (see HANDOVER.md §4).")
    for line in path.read_text().splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        k, _, v = line.partition("=")
        env[k.strip()] = v.strip()
    return env


def student_code(student_id: str) -> tuple[str, str]:
    """Map a student id (ferdi) → (code, displayName) from content/students.json."""
    data = json.loads((ROOT / "content" / "students.json").read_text())
    for s in data:
        if s["id"] == student_id or s["code"] == student_id:
            return s["code"], s["displayName"]
    die(f"unknown student '{student_id}'. Known: {', '.join(s['id'] for s in data)}")


def call_claude(text: str, name: str, model: str) -> dict:
    api_key = os.environ.get("ANTHROPIC_API_KEY")
    if not api_key:
        die("ANTHROPIC_API_KEY is not set in your environment.")

    body = {
        "model": model,
        "max_tokens": 1024,
        # System as a block list so we can cache the (stable) rubric across runs.
        "system": [{"type": "text", "text": SYSTEM_PROMPT, "cache_control": {"type": "ephemeral"}}],
        "tools": [ASSESSMENT_TOOL],
        "tool_choice": {"type": "tool", "name": "record_assessment"},
        "messages": [
            {
                "role": "user",
                "content": f"Student: {name}\n\nWriting sample:\n\"\"\"\n{text}\n\"\"\"",
            }
        ],
    }
    req = urllib.request.Request(
        ANTHROPIC_URL,
        data=json.dumps(body).encode("utf-8"),
        headers={
            "content-type": "application/json",
            "x-api-key": api_key,
            "anthropic-version": "2023-06-01",
        },
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=60) as resp:
            payload = json.loads(resp.read().decode("utf-8"))
    except urllib.error.HTTPError as e:
        die(f"Anthropic API {e.code}: {e.read().decode('utf-8', 'replace')[:400]}")
    except urllib.error.URLError as e:
        die(f"network error calling Anthropic API: {e}")

    for block in payload.get("content", []):
        if block.get("type") == "tool_use" and block.get("name") == "record_assessment":
            return block["input"]
    die("Claude did not return a structured assessment.")


def post_to_sheet(env: dict, code: str, title: str, a: dict, link: str):
    url = env.get("NEXT_PUBLIC_SYNC_URL")
    secret = env.get("NEXT_PUBLIC_SYNC_SECRET")
    if not url or not secret:
        die("NEXT_PUBLIC_SYNC_URL / NEXT_PUBLIC_SYNC_SECRET missing from .env.local.")
    body = {
        "secret": secret,
        "type": "writing",
        "code": code,
        "title": title,
        "cefr": a["cefr"],
        "grammar": a["grammar"],
        "vocab": a["vocab"],
        "coherence": a["coherence"],
        "errors": a["errors"],
        "feedback": a["feedback"],
        "link": link,
    }
    req = urllib.request.Request(
        url,
        data=json.dumps(body).encode("utf-8"),
        headers={"content-type": "application/json"},
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            return json.loads(resp.read().decode("utf-8", "replace"))
    except urllib.error.HTTPError as e:
        die(f"sheet write failed (HTTP {e.code}): {e.read().decode('utf-8', 'replace')[:300]}")
    except urllib.error.URLError as e:
        die(f"network error posting to sheet: {e}")


def main():
    ap = argparse.ArgumentParser(description="Analyse student writing → Google Sheet.")
    ap.add_argument("--student", required=True, help="student id or code (e.g. ferdi)")
    src = ap.add_mutually_exclusive_group(required=True)
    src.add_argument("--text", help="the writing sample as a string")
    src.add_argument("--file", help="path to a .txt file with the writing sample")
    ap.add_argument("--title", default="Writing sample", help="label for this piece")
    ap.add_argument("--link", default="", help="optional link (e.g. Drive URL)")
    ap.add_argument("--model", default=DEFAULT_MODEL)
    ap.add_argument("--dry-run", action="store_true", help="analyse + print, do NOT write to the sheet")
    args = ap.parse_args()

    text = Path(args.file).read_text() if args.file else args.text
    text = (text or "").strip()
    if len(text) < 20:
        die("writing sample looks too short (need at least ~20 characters).")

    code, name = student_code(args.student)
    words = len(re.findall(r"\b\w+\b", text))

    print(f"Analysing {name}'s writing ({words} words) with {args.model} …")
    a = call_claude(text, name, args.model)

    print("\n── Assessment ─────────────────────────────")
    print(f"  CEFR:       {a['cefr']}")
    print(f"  Grammar:    {a['grammar']}/10")
    print(f"  Vocabulary: {a['vocab']}/10")
    print(f"  Coherence:  {a['coherence']}/10")
    print("  Top errors:")
    for e in a["errors"]:
        print(f"    • {e}")
    print(f"  Feedback:   {a['feedback']}")
    print("───────────────────────────────────────────")

    if args.dry_run:
        print("\n(dry run — nothing written to the sheet)")
        return

    env = load_env_local()
    res = post_to_sheet(env, code, args.title, a, args.link)
    if res.get("ok"):
        print(f"\n✓ Written to {name}'s Writing tab. It now shows in the app + parent view.")
    else:
        die(f"sheet rejected the write: {res}")


if __name__ == "__main__":
    main()
