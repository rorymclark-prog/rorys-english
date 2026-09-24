#!/usr/bin/env node
// Pull the first picture out of a slide deck and save it as that unit's cover.
//
// Decks are PDFs Rory exports from his lesson slides. The title slide's
// background is nearly always the best picture in the deck: it is chosen to
// carry the theme, and it is composed with empty space for a heading, which is
// exactly what a card banner needs.
//
//   node scripts/deck-cover.mjs public/lessons/valentin/2025-26/unit09/Student_Slides.pdf
//
// Writes cover.jpg next to the deck, then tells you the path to paste into
// content/<student>/units.json as "coverImage".
//
// Needs pdfimages (poppler) and sips (macOS). This is a one-off authoring step,
// not part of the build — the deploy must never depend on either being present.
import { execFileSync } from "node:child_process";
import { mkdtempSync, readdirSync, rmSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { tmpdir } from "node:os";

const deck = process.argv[2];
if (!deck) { console.error("Usage: node scripts/deck-cover.mjs <deck.pdf>"); process.exit(1); }

const need = (cmd) => {
  try { execFileSync("/usr/bin/env", ["which", cmd], { stdio: "ignore" }); }
  catch { console.error(`Missing ${cmd}. Install poppler (brew install poppler) and run this on a Mac.`); process.exit(1); }
};
need("pdfimages"); need("sips");

const scratch = mkdtempSync(join(tmpdir(), "deck-cover-"));
try {
  execFileSync("pdfimages", ["-j", "-p", "-f", "1", "-l", "4", resolve(deck), join(scratch, "img")]);
  // Page order, then size: the first page's picture wins, and among equals the
  // largest, so a logo in a corner never beats the real artwork.
  const found = readdirSync(scratch).filter(f => /\.(jpg|jpeg|ppm|png)$/i.test(f)).sort();
  if (!found.length) { console.error("No pictures in the first four slides. Nothing to use — leave coverImage out."); process.exit(2); }
  const out = join(dirname(resolve(deck)), "cover.jpg");
  execFileSync("sips", ["-Z", "1000", join(scratch, found[0]), "--out", out], { stdio: "ignore" });
  execFileSync("sips", ["-s", "format", "jpeg", "-s", "formatOptions", "72", out, "--out", out], { stdio: "ignore" });
  const web = out.slice(out.indexOf("/public/") + "/public".length);
  console.log(`Wrote ${out}`);
  console.log(`Add to that unit in units.json:  "coverImage": "${web}"`);
} finally { rmSync(scratch, { recursive: true, force: true }); }
