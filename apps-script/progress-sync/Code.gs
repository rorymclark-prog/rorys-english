/**
 * Rory's English — Progress Sync
 * ------------------------------------------------------------------------
 * One Apps Script that does two jobs:
 *   1. setup()  — run ONCE: builds a Drive folder + a Progress Sheet per
 *                 student (with all the tabs), and remembers each Sheet's id.
 *   2. doPost() — the Web App endpoint the PWA + study tools POST to. It
 *                 validates the shared secret + student code and writes the
 *                 row into the right tab of that student's Sheet.
 *
 * No student passwords; the student CODE (same one in their app link) is the
 * key, and SECRET is light anti-abuse. Data lands straight in Google Sheets,
 * where you can add charts on the Dashboard tab.
 *
 * DEPLOY: see README.md in this folder.
 * ------------------------------------------------------------------------
 */

// ── Config ────────────────────────────────────────────────────────────────
// Keep this list in step with content/students.json (code → display name).
var STUDENTS = [
  { code: "ferdi-7h3k", parentCode: "ferdi-fam-3p9k", name: "Ferdi" },
  { code: "valentin-q9m2", parentCode: "valentin-fam-8w2d", name: "Valentin" },
];

// Resolve a student record from either their own code or their parent code.
function studentByAnyCode_(code) {
  for (var i = 0; i < STUDENTS.length; i++) {
    if (STUDENTS[i].code === code || STUDENTS[i].parentCode === code) return STUDENTS[i];
  }
  return null;
}

// Light anti-abuse shared secret. Set the SAME value as the app's
// NEXT_PUBLIC_SYNC_SECRET. Change it here and re-deploy if it ever leaks.
var SECRET = "re-sync-7b3h8d9f4";

var ROOT_FOLDER_NAME = "Rory's English — Progress";

// Tabs created in every student Sheet, with their header rows.
var TABS = {
  Dashboard: ["Metric", "Value"],
  Homework: ["Date", "Unit", "Week", "Title", "Status"],
  "Vocab & Quizzes": ["Date", "Tool", "Section", "Score", "Max", "%"],
  "School Tests": ["Date", "Test", "Score", "Max", "%", "Notes"],
  Writing: ["Date", "Title", "CEFR", "Grammar", "Vocab", "Coherence", "Key errors", "Feedback", "Link"],
  Speaking: ["Date", "Recording", "Fluency", "Pronunciation", "Grammar", "Vocab range", "Notes", "Link"],
  "Mock Tests": ["Date", "Paper", "Reading", "Listening", "Writing", "Speaking", "Use of English", "Total", "Notes"],
};

// ── 1. One-time provisioning ───────────────────────────────────────────────
/**
 * Run this ONCE from the Apps Script editor (authorise when prompted).
 * Idempotent: re-running reuses existing folders/sheets, just ensures tabs.
 */
function setup() {
  var root = getOrCreateFolder_(DriveApp.getRootFolder(), ROOT_FOLDER_NAME);
  var props = PropertiesService.getScriptProperties();

  STUDENTS.forEach(function (s) {
    var folder = getOrCreateFolder_(root, s.name);
    getOrCreateFolder_(folder, "recordings");
    getOrCreateFolder_(folder, "writing");

    var key = "sheet_" + s.code;
    var sheetId = props.getProperty(key);
    var ss = sheetId ? safeOpen_(sheetId) : null;

    if (!ss) {
      ss = SpreadsheetApp.create(s.name + " — Progress");
      DriveApp.getFileById(ss.getId()).moveTo(folder);
      props.setProperty(key, ss.getId());
    }
    ensureTabs_(ss);
    Logger.log(s.name + " → " + ss.getUrl());
  });

  Logger.log("Setup complete. Sheet ids stored in Script Properties.");
}

function ensureTabs_(ss) {
  Object.keys(TABS).forEach(function (name) {
    var sheet = ss.getSheetByName(name) || ss.insertSheet(name);
    var headers = TABS[name];
    if (sheet.getLastRow() === 0) {
      sheet.getRange(1, 1, 1, headers.length).setValues([headers]).setFontWeight("bold");
      sheet.setFrozenRows(1);
    }
  });
  // Remove the default empty "Sheet1" if present.
  var def = ss.getSheetByName("Sheet1");
  if (def && Object.keys(TABS).indexOf("Sheet1") === -1) ss.deleteSheet(def);
  writeDashboard_(ss);
}

// A simple formula dashboard; add charts by hand once data flows in.
// Only writes on first provisioning, so re-running setup() never clobbers
// annotations/charts the tutor added later.
function writeDashboard_(ss) {
  var d = ss.getSheetByName("Dashboard");
  if (d.getLastRow() >= 2) return;
  d.getRange("A1:B1").setValues([["Metric", "Value"]]).setFontWeight("bold");
  d.getRange("A2:B7").setValues([
    ["Homework weeks completed", '=COUNTIF(Homework!E2:E,"complete")'],
    ["Quiz rounds done", '=COUNTA(\'Vocab & Quizzes\'!A2:A)'],
    ["Best quiz %", '=IFERROR(MAX(\'Vocab & Quizzes\'!F2:F),"—")'],
    ["School tests recorded", '=COUNTA(\'School Tests\'!A2:A)'],
    ["Writing samples analysed", "=COUNTA(Writing!A2:A)"],
    ["Last updated", '=IFERROR(MAX(Homework!A2:A,\'Vocab & Quizzes\'!A2:A),"—")'],
  ]);
}

// ── 2. Ingestion endpoint ──────────────────────────────────────────────────
// Hardening notes: the secret is client-visible by design (light anti-abuse),
// so the real defences are below — payload caps, cell sanitization (formula
// injection), a write lock (duplicate-row races), and generic error responses.
var MAX_PAYLOAD_BYTES = 20000; // far above any legitimate event
var MAX_CELL_CHARS = 2000; // per-cell cap so one post can't bloat the Sheet

// Sheets executes strings starting with = + - @ as formulas when written.
// Prefix them with ' (renders as plain text) and cap the length.
function sanitize_(v) {
  if (v === null || v === undefined) return "";
  if (typeof v === "number" || typeof v === "boolean") return v;
  var s = String(v).slice(0, MAX_CELL_CHARS);
  return /^[=+\-@]/.test(s) ? "'" + s : s;
}

function doPost(e) {
  try {
    if (!e.postData || e.postData.contents.length > MAX_PAYLOAD_BYTES) {
      return json_({ ok: false, error: "rejected" });
    }
    var data = JSON.parse(e.postData.contents);

    // READS via POST (CORS-readable, so no URL-length limit and secret/text stay
    // out of the URL). The GET/JSONP variants below remain as a fallback.
    if (data.action === "progress") return getProgress_(data);
    if (data.action === "resources") return getResources_(data);
    if (data.action === "ai") return getAi_(data);
    // Teacher dashboard is POST-only, on purpose: no doGet/JSONP branch exists
    // for it anywhere in this file, so the password can never end up in a URL
    // (browser history, server access logs, a shared-link screenshot).
    if (data.action === "teacherDashboard") return getTeacherDashboard_(data);

    // WRITES (homework/quiz/writing). One generic auth error: no oracle.
    var sheetId =
      data.secret === SECRET
        ? PropertiesService.getScriptProperties().getProperty("sheet_" + data.code)
        : null;
    if (!sheetId) return json_({ ok: false, error: "unauthorized" });
    var ss = SpreadsheetApp.openById(sheetId);

    // Serialize writes: concurrent posts for the same homework key would
    // otherwise both read-then-append and create duplicate rows (TOCTOU).
    var lock = LockService.getScriptLock();
    lock.waitLock(10000);
    try {
      if (data.type === "homework") {
        upsertHomework_(ss, data);
      } else if (data.type === "quiz") {
        appendQuiz_(ss, data);
      } else if (data.type === "writing") {
        appendWriting_(ss, data);
      } else {
        return json_({ ok: false, error: "unknown type" });
      }
    } finally {
      lock.releaseLock();
    }
    return json_({ ok: true });
  } catch (err) {
    // Log the real error internally; never echo exception detail to callers.
    console.error("doPost error: " + err);
    return json_({ ok: false, error: "internal error" });
  }
}

// doGet serves a read-only progress snapshot as JSONP (so the static app +
// parent pages can read it cross-origin without CORS). Accepts either the
// student code or the parent code; both resolve to the same Sheet.
//   ?action=progress&code=<student-or-parent-code>&secret=<SECRET>&callback=<fn>
function doGet(e) {
  var p = (e && e.parameter) || {};
  if (p.action === "progress") return getProgress_(p);
  if (p.action === "resources") return getResources_(p);
  if (p.action === "ai") return getAi_(p);
  return json_({ ok: true, service: "rorys-english progress-sync" });
}

// ── AI layer (word helper + writing coach) ───────────────────────────────────
// The Anthropic key lives in Script Properties (ANTHROPIC_API_KEY) — server-side,
// never in the app. Rate-limited per student per day so a leaked secret can't run
// up the bill. Returns the model's text via JSONP.
var AI_DAILY_CAP = 40; // model calls per student per day
var AI_MAX_INPUT = 6000; // chars (POST body, not URL — full short essays fit)

var WORD_SYSTEM =
  "You are a warm English tutor for a German-speaking teenager (A2–B1). " +
  "Given an English word or phrase, reply briefly and in plain text (no markdown headings): " +
  "1) a simple-English meaning, 2) the German translation, 3) one natural example sentence, " +
  "4) one short usage tip only if helpful. Keep it short, clear and encouraging.";

var WRITING_SYSTEM =
  "You are an encouraging English writing coach for a German-speaking teenager (around B1). " +
  "This is the student's own PRACTICE writing, not graded homework — never give a grade or score. " +
  "Research shows B1 learners improve most from ONE targeted correction at a time, framed as a " +
  "strategy they can reuse, with praise for effort not talent. So reply in plain text, warmly and " +
  "briefly: (1) one genuine, specific thing they did well; (2) the SINGLE most useful pattern to fix " +
  "— name the rule simply, show their sentence corrected, and give one more mini-example; " +
  "(3) a short effort-based encouragement (e.g. 'you're really getting the hang of past tenses'). " +
  "Do NOT list many errors — pick the one that helps most. Keep it under ~120 words. " +
  "If the student writes something suggesting they are struggling personally, respond kindly and " +
  "suggest they talk to Rory or a trusted adult — do not act as a counsellor.";

var TUTOR_SYSTEM =
  "You are a friendly English tutor chatting with a German-speaking teenager (around B1), a student " +
  "of their teacher Rory. Answer questions about English: grammar, vocabulary, phrasing, differences " +
  "between words, how to say something, school-English topics. Explain in SIMPLE English with short " +
  "examples; add a German gloss in brackets when it genuinely helps. Keep answers short (under ~120 words) " +
  "and warm — this is a phone chat. If asked something unrelated to English or school English, answer in " +
  "one friendly sentence at most and steer back to English practice. Never give grades. " +
  "If the student seems to be struggling personally, respond kindly and suggest they talk to Rory or a " +
  "trusted adult — do not act as a counsellor. " +
  "Input may include a 'Previous conversation' block for context — continue it naturally.";

function getAi_(p) {
  var out;
  try {
    var student = p.secret === SECRET ? studentByAnyCode_(p.code) : null;
    // AI is student-only: a parent code can READ progress/resources but must not
    // spend the student's daily AI quota. Parent codes resolve to a student whose
    // .code differs from the code that was sent.
    if (!student || student.code !== p.code) {
      out = { ok: false, error: "unauthorized" };
    } else if (aiCount_(student.code) >= AI_DAILY_CAP) {
      out = { ok: false, error: "That's enough practice with the helper for today — try again tomorrow!" };
    } else {
      var q = String(p.q || "").slice(0, AI_MAX_INPUT).trim();
      if (!q) {
        out = { ok: false, error: "empty" };
      } else if (p.kind === "writing") {
        out = callClaude_("claude-sonnet-4-6", WRITING_SYSTEM, q, 800);
      } else if (p.kind === "tutor") {
        out = callClaude_("claude-haiku-4-5", TUTOR_SYSTEM, q, 500);
      } else {
        out = callClaude_("claude-haiku-4-5", WORD_SYSTEM, q, 350);
      }
      // Only spend a daily slot when Claude actually answered (not on a missing
      // key / error), and take a lock so concurrent calls can't both slip past
      // the cap. localStorage is the source of truth so nothing is lost.
      if (out && out.ok) aiInc_(student.code);
    }
  } catch (err) {
    console.error("getAi_ error: " + err);
    out = { ok: false, error: "internal error" };
  }
  return reply_(p.callback, out);
}

function aiKey_(code) {
  return "ai_" + code + "_" + Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "yyyy-MM-dd");
}
function aiCount_(code) {
  return parseInt(PropertiesService.getScriptProperties().getProperty(aiKey_(code)) || "0", 10);
}
// Atomic increment under a script lock so concurrent requests can't both bypass
// the daily cap. Best-effort: if the lock can't be taken, still count.
function aiInc_(code) {
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(5000);
  } catch (e) {}
  var props = PropertiesService.getScriptProperties();
  var k = aiKey_(code);
  var n = parseInt(props.getProperty(k) || "0", 10);
  props.setProperty(k, String(n + 1));
  if (n === 0) pruneAiCounters_(props); // first write of a new day → tidy old keys
  try {
    lock.releaseLock();
  } catch (e) {}
}

// Delete ai_<code>_<date> counters older than 2 days so Script Properties don't
// grow forever. Cheap: only runs on the first AI call of a new day.
function pruneAiCounters_(props) {
  try {
    var cutoff = Utilities.formatDate(
      new Date(Date.now() - 2 * 86400000),
      Session.getScriptTimeZone(),
      "yyyy-MM-dd",
    );
    var all = props.getKeys();
    for (var i = 0; i < all.length; i++) {
      var m = all[i].match(/^ai_.+_(\d{4}-\d{2}-\d{2})$/);
      if (m && m[1] < cutoff) props.deleteProperty(all[i]);
    }
  } catch (e) {}
}

function callClaude_(model, system, userText, maxTokens) {
  var key = PropertiesService.getScriptProperties().getProperty("ANTHROPIC_API_KEY");
  if (!key) return { ok: false, error: "The AI helper isn't switched on yet." };
  var res = UrlFetchApp.fetch("https://api.anthropic.com/v1/messages", {
    method: "post",
    contentType: "application/json",
    muteHttpExceptions: true,
    headers: { "x-api-key": key, "anthropic-version": "2023-06-01" },
    payload: JSON.stringify({
      model: model,
      max_tokens: maxTokens,
      system: system,
      messages: [{ role: "user", content: userText }],
    }),
  });
  if (res.getResponseCode() !== 200) {
    console.error("Anthropic " + res.getResponseCode() + ": " + res.getContentText().slice(0, 300));
    return { ok: false, error: "The helper couldn't answer just now — try again." };
  }
  var body = JSON.parse(res.getContentText());
  var text = (body.content || [])
    .filter(function (b) { return b.type === "text"; })
    .map(function (b) { return b.text; })
    .join("\n");
  // Be honest when the reply was cut off by the token limit.
  if (body.stop_reason === "max_tokens") text += "\n\n…(cut off — ask me to continue)";
  return { ok: true, text: text };
}

// Lists lesson slides / marked work / assessments for a student — AUTOMATICALLY,
// with no drag-and-drop. Two sources, deduped:
//   1. Any Drive file you OWN whose title contains the student's name
//      (your existing naming convention, e.g. "Ferdi_ESA_Debrief_Deck.pptx").
//   2. Anything dropped into their "Shared" subfolder (still supported).
// Each surfaced file is set link-viewable so the student can open it.
// NOTE: name your private files WITHOUT the student's name to keep them out.
function getResources_(p) {
  var out;
  try {
    var student = p.secret === SECRET ? studentByAnyCode_(p.code) : null;
    var sheetId = student
      ? PropertiesService.getScriptProperties().getProperty("sheet_" + student.code)
      : null;
    if (!sheetId) {
      out = { ok: false, error: "unauthorized" };
    } else {
      var seen = {}, cands = [];

      // 1. Files you own named with the student's display name (fast: metadata only).
      var safeName = student.name.replace(/'/g, "\\'");
      var q =
        "title contains '" + safeName + "' and trashed = false" +
        " and mimeType != 'application/vnd.google-apps.folder'" +
        " and 'me' in owners";
      var it = DriveApp.searchFiles(q);
      while (it.hasNext()) collectResource_(it.next(), cands, seen, student);

      // 2. The student's Shared subfolder (optional extra drop-zone).
      var parents = DriveApp.getFileById(sheetId).getParents();
      if (parents.hasNext()) {
        var sit = getOrCreateFolder_(parents.next(), "Shared").getFiles();
        while (sit.hasNext()) collectResource_(sit.next(), cands, seen, student);
      }

      // Newest first, cap to keep the list and the share-step manageable.
      cands.sort(function (a, b) {
        return a.modified < b.modified ? 1 : -1;
      });
      cands = cands.slice(0, 40);

      // Share each surfaced file ONCE (cached), so repeat loads are fast.
      ensureShared_(cands);

      var items = cands.map(function (c) {
        return { name: c.name, url: c.url, type: c.type, modified: c.modified };
      });
      out = { ok: true, name: student.name, resources: items };
    }
  } catch (err) {
    console.error("getResources_ error: " + err);
    out = { ok: false, error: "internal error" };
  }
  return reply_(p.callback, out);
}

// Files we WON'T auto-surface even if the name matches:
//  - Sheets (financial/business docs — invoices, trackers — are usually Sheets)
//  - Apps Script projects
// Everything a lesson/assessment normally is (Docs, Slides, PDF, images) stays.
var RESOURCE_BLOCK_MIME = {
  "application/vnd.google-apps.spreadsheet": 1,
  "application/vnd.google-apps.script": 1,
};

// Maintenance: revoke link-sharing on any previously-shared file that no longer
// matches a current student (renamed, deleted, or flagged [private]). Run this
// occasionally from the editor, or add a weekly time-driven trigger.
function unshareStale_() {
  var props = PropertiesService.getScriptProperties();
  var cached = {};
  try {
    JSON.parse(props.getProperty("shared_ids") || "[]").forEach(function (id) { cached[id] = 1; });
  } catch (e) {}
  var current = {};
  STUDENTS.forEach(function (s) {
    var esc = s.name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    var re = new RegExp("(^|[^A-Za-z])" + esc + "([^A-Za-z]|$)", "i");
    var it = DriveApp.searchFiles(
      "title contains '" + s.name.replace(/'/g, "\\'") + "' and trashed = false and 'me' in owners",
    );
    while (it.hasNext()) {
      var f = it.next();
      if (RESOURCE_BLOCK_MIME[f.getMimeType()]) continue;
      if (/\[private\]/i.test(f.getName())) continue;
      if (re.test(f.getName())) current[f.getId()] = 1;
    }
  });
  var keep = [], revoked = 0;
  Object.keys(cached).forEach(function (id) {
    if (current[id]) {
      keep.push(id);
      return;
    }
    try {
      DriveApp.getFileById(id).setSharing(DriveApp.Access.PRIVATE, DriveApp.Permission.NONE);
      revoked++;
    } catch (e) {}
  });
  props.setProperty("shared_ids", JSON.stringify(keep));
  Logger.log("unshareStale_: revoked " + revoked + ", kept " + keep.length);
}

// Collect metadata only (no Drive writes). Filters out risky / non-lesson files.
function collectResource_(f, cands, seen, student) {
  var id = f.getId();
  if (seen[id]) return;
  var mt = f.getMimeType();
  if (RESOURCE_BLOCK_MIME[mt]) return;
  var name = f.getName();
  // Name-token match: the student's name not flanked by other LETTERS. This
  // allows "Ferdi_ESA…" / "Ferdi Unit 9" (underscore/space are fine) but rejects
  // "Valentina's…" / "Ferdinand…" (a following letter = a different word).
  var esc = student.name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  var re = new RegExp("(^|[^A-Za-z])" + esc + "([^A-Za-z]|$)", "i");
  if (!re.test(name)) return;
  // Opt-out marker: name a file "…[private]…" to keep it out of the student's app.
  if (/\[private\]/i.test(name)) return;
  seen[id] = 1;
  cands.push({
    id: id,
    name: f.getName(),
    url: f.getUrl(),
    type: mt,
    modified: Utilities.formatDate(f.getLastUpdated(), Session.getScriptTimeZone(), "yyyy-MM-dd"),
    file: f,
  });
}

// Set link-viewable sharing only for files not already shared by us before.
// A cache of shared ids in Script Properties keeps repeat calls fast.
function ensureShared_(cands) {
  var props = PropertiesService.getScriptProperties();
  var shared = {};
  try {
    (JSON.parse(props.getProperty("shared_ids") || "[]")).forEach(function (id) { shared[id] = 1; });
  } catch (e) {}
  var changed = false;
  cands.forEach(function (c) {
    if (shared[c.id]) return;
    try {
      c.file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    } catch (e2) {
      /* couldn't change — still mark so we don't retry every load */
    }
    shared[c.id] = 1;
    changed = true;
  });
  if (changed) {
    var ids = Object.keys(shared);
    if (ids.length > 800) ids = ids.slice(ids.length - 800); // bound the cache
    props.setProperty("shared_ids", JSON.stringify(ids));
  }
}

function getProgress_(p) {
  var out;
  try {
    if (p.secret !== SECRET) {
      out = { ok: false, error: "unauthorized" };
    } else {
      var student = studentByAnyCode_(p.code);
      var sheetId = student
        ? PropertiesService.getScriptProperties().getProperty("sheet_" + student.code)
        : null;
      if (!sheetId) {
        // Same generic error as a bad secret — no code-enumeration oracle.
        out = { ok: false, error: "unauthorized" };
      } else {
        var ss = SpreadsheetApp.openById(sheetId);
        out = {
          ok: true,
          name: student.name,
          generatedAt: now_(),
          homework: rows_(ss, "Homework"),
          quizzes: rows_(ss, "Vocab & Quizzes"),
          schoolTests: rows_(ss, "School Tests"),
          writing: rows_(ss, "Writing"),
          speaking: rows_(ss, "Speaking"),
          mockTests: rows_(ss, "Mock Tests"),
        };
      }
    }
  } catch (err) {
    out = { ok: false, error: String(err) };
  }
  return reply_(p.callback, out);
}

// Returns {headers, rows} for a tab, dropping blank rows.
function rows_(ss, name) {
  var sh = ss.getSheetByName(name);
  if (!sh) return { headers: [], rows: [] };
  var v = sh.getDataRange().getValues();
  if (v.length < 1) return { headers: [], rows: [] };
  var rows = v.slice(1).filter(function (r) {
    return r.join("").trim() !== "";
  });
  return { headers: v[0], rows: rows };
}

// ── Teacher dashboard ─────────────────────────────────────────────────────
// One password gates ALL students' data at once — much higher value than any
// single student's SECRET — so it lives in its own Script Property, set by
// Rory directly in the Apps Script editor (Project Settings → Script
// Properties → TEACHER_PASSWORD), the same one-time-paste pattern as
// ANTHROPIC_API_KEY. Never set a default here; an unset property means the
// endpoint always rejects (fails closed, not open).
var TEACHER_PASSWORD_PROP = "TEACHER_PASSWORD";

function getTeacherDashboard_(p) {
  var out;
  try {
    var expected = PropertiesService.getScriptProperties().getProperty(TEACHER_PASSWORD_PROP);
    if (!expected || p.teacherSecret !== expected) {
      out = { ok: false, error: "unauthorized" };
    } else {
      var props = PropertiesService.getScriptProperties();
      var students = STUDENTS.map(function (s) {
        var sheetId = props.getProperty("sheet_" + s.code);
        var ss = sheetId ? safeOpen_(sheetId) : null;
        return { code: s.code, name: s.name, summary: ss ? studentSummary_(ss) : null };
      });
      out = { ok: true, generatedAt: now_(), students: students };
    }
  } catch (err) {
    console.error("getTeacherDashboard_ error: " + err);
    out = { ok: false, error: "internal error" };
  }
  // Plain JSON only (json_, not reply_) — this endpoint has no callback/JSONP
  // path, so a teacherSecret can never leak into a URL.
  return json_(out);
}

// Reads the Dashboard tab's already-computed formula values (COUNTIF/MAX over
// the other tabs) instead of recomputing from raw rows — reuses the exact
// numbers a tutor sees opening the Sheet directly, and stays correct if Rory
// ever hand-edits a row.
function studentSummary_(ss) {
  var d = ss.getSheetByName("Dashboard");
  if (!d || d.getLastRow() < 7) return null;
  var v = d.getRange("A2:B7").getValues(); // fixed order: see writeDashboard_
  var val = function (i) {
    var x = v[i][1];
    return x instanceof Date ? x.toISOString() : x;
  };
  return {
    homeworkDone: val(0),
    quizRounds: val(1),
    bestQuizPct: val(2),
    schoolTests: val(3),
    writingSamples: val(4),
    lastUpdated: val(5),
  };
}

// JSON when no callback; JSONP (text/javascript) when a callback is given.
function reply_(callback, obj) {
  var body = JSON.stringify(obj);
  if (callback) {
    var cb = String(callback).replace(/[^\w$.]/g, "");
    return ContentService.createTextOutput(cb + "(" + body + ")").setMimeType(
      ContentService.MimeType.JAVASCRIPT
    );
  }
  return ContentService.createTextOutput(body).setMimeType(ContentService.MimeType.JSON);
}

// One row per homework week; completing/uncompleting updates it in place.
function upsertHomework_(ss, d) {
  var sheet = ss.getSheetByName("Homework");
  var key = d.unitId + "|" + d.week;
  var row = [now_(), sanitize_(d.unitId), sanitize_(d.week), sanitize_(d.title), sanitize_(d.status)];
  var values = sheet.getDataRange().getValues();
  for (var i = 1; i < values.length; i++) {
    if (values[i][1] + "|" + values[i][2] === key) {
      sheet.getRange(i + 1, 1, 1, 5).setValues([row]);
      return;
    }
  }
  sheet.appendRow(row);
}

// Each quiz round is a new row (a time series of scores).
function appendQuiz_(ss, d) {
  var sheet = ss.getSheetByName("Vocab & Quizzes");
  var score = Number(d.score) || 0;
  var total = Number(d.total) || 0;
  var pct = total ? Math.round((score / total) * 100) : "";
  sheet.appendRow([now_(), sanitize_(d.tool), sanitize_(d.section), score, total, pct]);
}

// One row per analysed writing sample. Matches the Writing tab headers:
// Date, Title, CEFR, Grammar, Vocab, Coherence, Key errors, Feedback, Link
function appendWriting_(ss, d) {
  var sheet = ss.getSheetByName("Writing");
  var errors = Array.isArray(d.errors) ? d.errors.join("; ") : d.errors || "";
  sheet.appendRow([
    now_(),
    sanitize_(d.title || "Writing sample"),
    sanitize_(d.cefr),
    Number(d.grammar) || "",
    Number(d.vocab) || "",
    Number(d.coherence) || "",
    sanitize_(errors),
    sanitize_(d.feedback),
    sanitize_(d.link),
  ]);
}

// ── helpers ────────────────────────────────────────────────────────────────
function getOrCreateFolder_(parent, name) {
  var it = parent.getFoldersByName(name);
  return it.hasNext() ? it.next() : parent.createFolder(name);
}
function safeOpen_(id) {
  try {
    return SpreadsheetApp.openById(id);
  } catch (e) {
    return null;
  }
}
function now_() {
  return Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "yyyy-MM-dd HH:mm");
}
function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(
    ContentService.MimeType.JSON
  );
}
