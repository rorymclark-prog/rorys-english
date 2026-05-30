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
  { code: "ferdi-7h3k", name: "Ferdi" },
  { code: "valentin-q9m2", name: "Valentin" },
];

// Light anti-abuse shared secret. Set the SAME value as the app's
// NEXT_PUBLIC_SYNC_SECRET. Change it here and re-deploy if it ever leaks.
var SECRET = "change-me-rory-english-2026";

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
function doPost(e) {
  try {
    var data = JSON.parse(e.postData.contents);
    if (data.secret !== SECRET) return json_({ ok: false, error: "bad secret" });

    var sheetId = PropertiesService.getScriptProperties().getProperty("sheet_" + data.code);
    if (!sheetId) return json_({ ok: false, error: "unknown code" });
    var ss = SpreadsheetApp.openById(sheetId);

    if (data.type === "homework") {
      upsertHomework_(ss, data);
    } else if (data.type === "quiz") {
      appendQuiz_(ss, data);
    } else {
      return json_({ ok: false, error: "unknown type" });
    }
    return json_({ ok: true });
  } catch (err) {
    return json_({ ok: false, error: String(err) });
  }
}

function doGet() {
  return json_({ ok: true, service: "rorys-english progress-sync" });
}

// One row per homework week; completing/uncompleting updates it in place.
function upsertHomework_(ss, d) {
  var sheet = ss.getSheetByName("Homework");
  var key = d.unitId + "|" + d.week;
  var values = sheet.getDataRange().getValues();
  for (var i = 1; i < values.length; i++) {
    if (values[i][1] + "|" + values[i][2] === key) {
      sheet.getRange(i + 1, 1, 1, 5).setValues([[now_(), d.unitId, d.week, d.title, d.status]]);
      return;
    }
  }
  sheet.appendRow([now_(), d.unitId, d.week, d.title, d.status]);
}

// Each quiz round is a new row (a time series of scores).
function appendQuiz_(ss, d) {
  var sheet = ss.getSheetByName("Vocab & Quizzes");
  var pct = d.total ? Math.round((d.score / d.total) * 100) : "";
  sheet.appendRow([now_(), d.tool || "", d.section || "", d.score, d.total, pct]);
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
