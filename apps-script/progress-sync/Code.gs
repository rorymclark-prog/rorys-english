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
    // One generic auth error: no oracle distinguishing bad secret vs unknown code.
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
  return json_({ ok: true, service: "rorys-english progress-sync" });
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
