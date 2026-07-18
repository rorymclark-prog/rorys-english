/**
 * Rory's English — Progress Sync
 * ------------------------------------------------------------------------
 * One Apps Script that does several jobs:
 *   1. setup()  — run ONCE: builds the Roster spreadsheet + a Drive folder +
 *                 Progress Sheet per student, and remembers each Sheet's id.
 *   2. doPost() — the Web App endpoint the PWA + study tools + teacher
 *                 dashboard POST to. Validates the shared secret (or teacher
 *                 password) + student code and reads/writes the right Sheet.
 *
 * No student passwords; the student CODE (same one in their app link) is the
 * key, and SECRET is light anti-abuse. Data lands straight in Google Sheets,
 * where you can add charts on the Dashboard tab.
 *
 * DEPLOY: see README.md in this folder.
 * ------------------------------------------------------------------------
 */

// ── Config ────────────────────────────────────────────────────────────────
// Seed roster — used ONLY to bootstrap the Roster Sheet the first time
// setup() runs. After that, the Roster Sheet (not this array) is the source
// of truth, so new students added via the teacher dashboard show up without
// a code change. Keep content/students.json in step for the STATIC app shell
// (per-student PWA route) — see scripts/add-student.mjs.
var STUDENTS = [
  { code: "ferdi-7h3k", parentCode: "ferdi-fam-3p9k", name: "Ferdi" },
  { code: "valentin-q9m2", parentCode: "valentin-fam-8w2d", name: "Valentin" },
];

// Roster Sheet: one spreadsheet, one tab, one row per student. Cached in
// CacheService (not a plain global — Apps Script has no persistent memory
// across separate web-app executions) so normal requests don't cost a Sheets
// read every time; a 5-minute TTL means a freshly-added student is visible
// everywhere within minutes with no redeploy.
var ROSTER_SHEET_ID_PROP = "ROSTER_SHEET_ID";
var ROSTER_CACHE_KEY = "roster_v1";
var ROSTER_CACHE_TTL = 300; // seconds

function getRoster_() {
  var cache = CacheService.getScriptCache();
  var cached = cache.get(ROSTER_CACHE_KEY);
  if (cached) {
    try {
      return JSON.parse(cached);
    } catch (e) {
      /* fall through to a fresh read */
    }
  }
  var roster = loadRosterFromSheet_();
  try {
    cache.put(ROSTER_CACHE_KEY, JSON.stringify(roster), ROSTER_CACHE_TTL);
  } catch (e) {
    /* value too large or cache unavailable — reads just cost a bit more */
  }
  return roster;
}

function invalidateRosterCache_() {
  try {
    CacheService.getScriptCache().remove(ROSTER_CACHE_KEY);
  } catch (e) {}
}

function loadRosterFromSheet_() {
  var id = PropertiesService.getScriptProperties().getProperty(ROSTER_SHEET_ID_PROP);
  var ss = id ? safeOpen_(id) : null;
  if (!ss) return STUDENTS; // roster not provisioned yet — fall back to the seed array
  var sh = ss.getSheetByName("Roster");
  if (!sh || sh.getLastRow() < 2) return STUDENTS;
  var v = sh.getRange(2, 1, sh.getLastRow() - 1, 3).getValues(); // Code, Parent Code, Name
  return v
    .filter(function (r) {
      return String(r[0] || "").trim() !== "";
    })
    .map(function (r) {
      return { code: String(r[0]), parentCode: String(r[1]), name: String(r[2]) };
    });
}

function appendRosterRow_(student) {
  var id = PropertiesService.getScriptProperties().getProperty(ROSTER_SHEET_ID_PROP);
  var ss = id ? safeOpen_(id) : null;
  if (!ss) throw new Error("roster not provisioned — run setup() first");
  var sh = ss.getSheetByName("Roster");
  // Sanitize here too (not just at the caller) — defense in depth, matching
  // every other write site in this file. addStudent_'s name regex currently
  // rules out formula-injection characters, but that safety shouldn't live
  // three call-frames away from the write.
  sh.appendRow([sanitize_(student.code), sanitize_(student.parentCode), sanitize_(student.name)]);
  invalidateRosterCache_();
}

// Resolve a student record from either their own code or their parent code.
function studentByAnyCode_(code) {
  var roster = getRoster_();
  for (var i = 0; i < roster.length; i++) {
    if (roster[i].code === code || roster[i].parentCode === code) return roster[i];
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
  // Tutor-assigned tasks — separate from Homework because these are pushed
  // dynamically from the teacher dashboard, not tied to static unit content.
  Assignments: ["Date", "Title", "Details", "Due", "Status", "Id"],
};

// ── 1. One-time provisioning ───────────────────────────────────────────────
/**
 * Run this ONCE from the Apps Script editor (authorise when prompted).
 * Idempotent: re-running reuses existing folders/sheets/roster, just ensures
 * tabs and seeds the Roster Sheet if it's still empty.
 */
function setup() {
  ensureRoster_();
  var root = getOrCreateFolder_(DriveApp.getRootFolder(), ROOT_FOLDER_NAME);
  STUDENTS.forEach(function (s) {
    provisionStudent_(s, root);
  });
  Logger.log("Setup complete. Sheet ids stored in Script Properties.");
}

// Creates the Roster spreadsheet if missing, and seeds it from the STUDENTS
// array the first time only (never overwrites rows already added — by hand
// or via the teacher dashboard's "add student" action).
function ensureRoster_() {
  var props = PropertiesService.getScriptProperties();
  var id = props.getProperty(ROSTER_SHEET_ID_PROP);
  var ss = id ? safeOpen_(id) : null;
  if (!ss) {
    var root = getOrCreateFolder_(DriveApp.getRootFolder(), ROOT_FOLDER_NAME);
    ss = SpreadsheetApp.create("Rory's English — Roster");
    DriveApp.getFileById(ss.getId()).moveTo(root);
    props.setProperty(ROSTER_SHEET_ID_PROP, ss.getId());
  }
  var sh = ss.getSheetByName("Roster") || ss.insertSheet("Roster");
  if (sh.getLastRow() === 0) {
    sh.getRange(1, 1, 1, 3).setValues([["Code", "Parent Code", "Name"]]).setFontWeight("bold");
    sh.setFrozenRows(1);
    STUDENTS.forEach(function (s) {
      sh.appendRow([s.code, s.parentCode, s.name]);
    });
  }
  var def = ss.getSheetByName("Sheet1");
  if (def && ss.getSheets().length > 1) ss.deleteSheet(def);
  invalidateRosterCache_();
}

// Creates (or reuses) a student's Drive folder + Progress Sheet. Factored out
// of setup()'s loop so the teacher-dashboard "add student" endpoint can call
// the exact same provisioning logic at request time.
function provisionStudent_(s, root) {
  root = root || getOrCreateFolder_(DriveApp.getRootFolder(), ROOT_FOLDER_NAME);
  var folder = getOrCreateFolder_(root, s.name);
  getOrCreateFolder_(folder, "recordings");
  getOrCreateFolder_(folder, "writing");

  var props = PropertiesService.getScriptProperties();
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
  return ss;
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
    if (data.action === "assignments") return getAssignments_(data);
    if (data.action === "note") return getNote_(data);

    // Teacher-only actions are POST-only, on purpose: no doGet/JSONP branch
    // exists for ANY of these anywhere in this file, so the teacher password
    // can never end up in a URL (browser history, server access logs).
    if (data.action === "teacherDashboard") return getTeacherDashboard_(data);
    if (data.action === "teacherAddStudent") return addStudent_(data);
    if (data.action === "teacherAssignHomework") return assignHomework_(data);
    if (data.action === "teacherSetFocusNote") return setFocusNote_(data);
    if (data.action === "teacherLogSchoolTest") return logSchoolTest_(data);
    if (data.action === "teacherLogMockTest") return logMockTest_(data);
    if (data.action === "teacherAnalyseWriting") return analyseWriting_(data);

    // WRITES (homework/quiz/writing/assignment). One generic auth error: no oracle.
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
      } else if (data.type === "assignment") {
        setAssignmentStatus_(ss, data);
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

// doGet serves read-only snapshots as JSONP (so the static app + parent pages
// can read cross-origin without CORS). Accepts either the student code or the
// parent code; both resolve to the same Sheet. Teacher-only actions are
// deliberately absent here — see the doPost comment above.
//   ?action=progress&code=<student-or-parent-code>&secret=<SECRET>&callback=<fn>
function doGet(e) {
  var p = (e && e.parameter) || {};
  if (p.action === "progress") return getProgress_(p);
  if (p.action === "resources") return getResources_(p);
  if (p.action === "ai") return getAi_(p);
  if (p.action === "assignments") return getAssignments_(p);
  if (p.action === "note") return getNote_(p);
  return json_({ ok: true, service: "rorys-english progress-sync" });
}

// ── AI layer (word helper + writing coach) ───────────────────────────────────
// The Anthropic key lives in Script Properties (ANTHROPIC_API_KEY) — server-side,
// never in the app. Rate-limited per student per day so a leaked secret can't run
// up the bill. Returns the model's text via JSONP.
var AI_DAILY_CAP = 40; // model calls per student per day
var AI_MAX_INPUT = 6000; // chars (POST body, not URL — full short essays fit)
var FOCUS_NOTE_MAX_CHARS = 500; // injected into the AI system prompt — keep it short

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
      } else {
        // A tutor-flagged focus point (set from the dashboard) is woven into
        // the system prompt as soft context — never forced, never mentioned
        // as "your teacher is watching" (would undercut the practice-not-
        // graded framing already established for writing/tutor chat).
        var note = focusNoteFor_(student.code);
        var focusSuffix = note
          ? "\n\nThe student's tutor (Rory) flagged this as a current focus area for them — " +
            "weave it in naturally if relevant to what they ask, but don't force it or mention " +
            "that Rory flagged it: " + note
          : "";
        if (p.kind === "writing") {
          out = callClaude_("claude-sonnet-4-6", WRITING_SYSTEM + focusSuffix, q, 800);
        } else if (p.kind === "tutor") {
          out = callClaude_("claude-haiku-4-5", TUTOR_SYSTEM + focusSuffix, q, 500);
        } else {
          out = callClaude_("claude-haiku-4-5", WORD_SYSTEM + focusSuffix, q, 350);
        }
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
  getRoster_().forEach(function (s) {
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

// ── Assignments (tutor-pushed tasks — the "assign from the dashboard" pair) ──
// Unlike Homework (static per-unit content, Sheet only logs completion),
// Assignments are fully Sheet-driven both ways: the dashboard appends a row,
// the student app reads open ones, and the student's completion writes back
// to the same row (matched by a generated Id, not by title — two assignments
// can share a title).
function getAssignments_(p) {
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
        out = { ok: false, error: "unauthorized" };
      } else {
        var ss = SpreadsheetApp.openById(sheetId);
        var all = rows_(ss, "Assignments");
        // Status column index 4 (0-based) per TABS.Assignments header order.
        var open = all.rows.filter(function (r) {
          return String(r[4]).toLowerCase() !== "done";
        });
        out = { ok: true, assignments: { headers: all.headers, rows: open } };
      }
    }
  } catch (err) {
    out = { ok: false, error: "internal error" };
  }
  return reply_(p.callback, out);
}

// Student-side write: mark one assignment done/open by Id (Assignments!F).
function setAssignmentStatus_(ss, d) {
  var sheet = ss.getSheetByName("Assignments");
  if (!sheet) return; // tab doesn't exist yet — nothing to update, fail silently
  var values = sheet.getDataRange().getValues();
  var id = String(d.id || "");
  for (var i = 1; i < values.length; i++) {
    if (String(values[i][5]) === id) {
      sheet.getRange(i + 1, 5).setValue(sanitize_(d.status));
      return;
    }
  }
  // Id not found (stale/edited row) — fail silently, matches the "generic,
  // no oracle" posture used everywhere else in this file.
}

// Teacher-only: push a new assignment into a student's Assignments tab.
function assignHomework_(p) {
  var out;
  try {
    var expected = PropertiesService.getScriptProperties().getProperty(TEACHER_PASSWORD_PROP);
    if (!expected || p.teacherSecret !== expected) {
      out = { ok: false, error: "unauthorized" };
    } else {
      var student = studentByAnyCode_(p.code);
      var sheetId = student
        ? PropertiesService.getScriptProperties().getProperty("sheet_" + student.code)
        : null;
      var title = String(p.title || "").trim().slice(0, MAX_CELL_CHARS);
      if (!sheetId || !title) {
        out = { ok: false, error: !sheetId ? "unknown student" : "title required" };
      } else {
        var ss = SpreadsheetApp.openById(sheetId);
        // Self-heal: students provisioned before the Assignments tab existed
        // (Ferdi/Valentin's original Sheets) won't have it yet, and setup()
        // can't be re-run remotely to add it. ensureTabs_ only creates tabs
        // that are MISSING — never touches existing data — so this is safe
        // to call on every assign, not just once.
        ensureTabs_(ss);
        var lock = LockService.getScriptLock();
        lock.waitLock(10000);
        try {
          var id = Utilities.getUuid().slice(0, 8);
          ss.getSheetByName("Assignments").appendRow([
            now_(),
            sanitize_(title),
            sanitize_(p.details || ""),
            sanitize_(p.due || ""),
            "open",
            id,
          ]);
        } finally {
          lock.releaseLock();
        }
        out = { ok: true };
      }
    }
  } catch (err) {
    console.error("assignHomework_ error: " + err);
    out = { ok: false, error: "internal error" };
  }
  return json_(out); // POST-only, same as every teacher* action
}

// Shared guard for every teacher-only action — centralized so a new
// teacher* action added later can't accidentally skip the check via a
// copy-paste that drops the `!expected` fail-closed condition.
function teacherAuthed_(p) {
  var expected = PropertiesService.getScriptProperties().getProperty(TEACHER_PASSWORD_PROP);
  return !!expected && p.teacherSecret === expected;
}

// ── School test / Mock test logging (plain score entry — no AI needed; a
// test score is just a number, unlike writing which benefits from analysis) ──
function logSchoolTest_(p) {
  var out;
  try {
    if (!teacherAuthed_(p)) {
      out = { ok: false, error: "unauthorized" };
    } else {
      var student = studentByAnyCode_(p.code);
      var sheetId = student
        ? PropertiesService.getScriptProperties().getProperty("sheet_" + student.code)
        : null;
      var test = String(p.test || "").trim().slice(0, MAX_CELL_CHARS);
      // Check for blank BEFORE Number() coercion: Number("") is 0 (finite,
      // not negative), so an omitted score would otherwise silently pass
      // validation and get written as a real, indistinguishable score of 0.
      var scoreRaw = String(p.score === undefined || p.score === null ? "" : p.score).trim();
      var maxRaw = String(p.max === undefined || p.max === null ? "" : p.max).trim();
      var score = Number(scoreRaw);
      var max = Number(maxRaw);
      if (!sheetId || !test) {
        out = { ok: false, error: !sheetId ? "unknown student" : "test name required" };
      } else if (!scoreRaw || !maxRaw || !isFinite(score) || !isFinite(max) || max <= 0 || score < 0) {
        out = { ok: false, error: "enter valid numbers for score and max" };
      } else {
        var ss = SpreadsheetApp.openById(sheetId);
        var pct = Math.round((score / max) * 100);
        var lock = LockService.getScriptLock();
        lock.waitLock(10000);
        try {
          ss.getSheetByName("School Tests").appendRow([
            now_(), sanitize_(test), score, max, pct, sanitize_(p.notes || ""),
          ]);
        } finally {
          lock.releaseLock();
        }
        out = { ok: true };
      }
    }
  } catch (err) {
    console.error("logSchoolTest_ error: " + err);
    out = { ok: false, error: "internal error" };
  }
  return json_(out); // POST-only
}

function logMockTest_(p) {
  var out;
  try {
    if (!teacherAuthed_(p)) {
      out = { ok: false, error: "unauthorized" };
    } else {
      var student = studentByAnyCode_(p.code);
      var sheetId = student
        ? PropertiesService.getScriptProperties().getProperty("sheet_" + student.code)
        : null;
      var paper = String(p.paper || "").trim().slice(0, MAX_CELL_CHARS);
      var fields = ["reading", "listening", "writing", "speaking", "useOfEnglish"];
      var scores = {};
      var valid = true;
      fields.forEach(function (f) {
        // Same blank-before-coercion check as logSchoolTest_: Number("") is
        // 0, which would otherwise pass isFinite/>=0 and silently zero out
        // an omitted skill score instead of rejecting the submission.
        var raw = String(p[f] === undefined || p[f] === null ? "" : p[f]).trim();
        var n = Number(raw);
        if (!raw || !isFinite(n) || n < 0) valid = false;
        scores[f] = n;
      });
      if (!sheetId || !paper) {
        out = { ok: false, error: !sheetId ? "unknown student" : "paper name required" };
      } else if (!valid) {
        out = { ok: false, error: "enter a valid number for every skill score" };
      } else {
        var total = scores.reading + scores.listening + scores.writing + scores.speaking + scores.useOfEnglish;
        var ss = SpreadsheetApp.openById(sheetId);
        var lock = LockService.getScriptLock();
        lock.waitLock(10000);
        try {
          ss.getSheetByName("Mock Tests").appendRow([
            now_(),
            sanitize_(paper),
            scores.reading,
            scores.listening,
            scores.writing,
            scores.speaking,
            scores.useOfEnglish,
            total,
            sanitize_(p.notes || ""),
          ]);
        } finally {
          lock.releaseLock();
        }
        out = { ok: true };
      }
    }
  } catch (err) {
    console.error("logMockTest_ error: " + err);
    out = { ok: false, error: "internal error" };
  }
  return json_(out); // POST-only
}

// ── Writing analysis (teacher-triggered formal assessment) ──────────────────
// Distinct from the student's own in-app practice writing coach (WRITING_SYSTEM,
// never graded). This is Rory analysing a real submitted piece — same rubric
// as scripts/analyse-writing.py (the local script this complements, not
// replaces) so results are consistent whichever way he runs it.
var WRITING_ANALYSIS_MAX_INPUT = 8000; // a full essay/test response, body not URL

var WRITING_ASSESS_SYSTEM =
  "You are an experienced English-as-a-foreign-language tutor assessing a piece " +
  "of writing by a teenage German-speaking (L1 German) learner, roughly A2–B1 " +
  "level. Assess fairly and encouragingly. Use the CEFR scale. Identify the most " +
  "useful recurring error patterns (not every slip) so the tutor knows what to " +
  "teach next. Feedback must be warm and specific, never shaming. Always respond " +
  "by calling the record_assessment tool.";

var WRITING_ASSESS_TOOL = {
  name: "record_assessment",
  description: "Record the structured assessment of the student's writing sample.",
  input_schema: {
    type: "object",
    properties: {
      cefr: { type: "string", enum: ["A1", "A2", "A2+", "B1", "B1+", "B2", "C1", "C2"] },
      grammar: { type: "integer", minimum: 0, maximum: 10 },
      vocab: { type: "integer", minimum: 0, maximum: 10 },
      coherence: { type: "integer", minimum: 0, maximum: 10 },
      errors: {
        type: "array",
        items: { type: "string" },
        description: "Top 3–5 recurring error patterns, each a short phrase with a tiny example.",
      },
      feedback: { type: "string", description: "One encouraging paragraph (2–4 sentences) of tutor feedback." },
    },
    required: ["cefr", "grammar", "vocab", "coherence", "errors", "feedback"],
  },
};

// Returns the assessment object, or null on any failure (no key, HTTP error,
// or Claude didn't call the tool) — caller decides the user-facing message.
function analyseWritingWithClaude_(text, studentName) {
  var key = PropertiesService.getScriptProperties().getProperty("ANTHROPIC_API_KEY");
  if (!key) return null;
  var res = UrlFetchApp.fetch("https://api.anthropic.com/v1/messages", {
    method: "post",
    contentType: "application/json",
    muteHttpExceptions: true,
    headers: { "x-api-key": key, "anthropic-version": "2023-06-01" },
    payload: JSON.stringify({
      model: "claude-sonnet-4-6",
      max_tokens: 1024,
      system: WRITING_ASSESS_SYSTEM,
      tools: [WRITING_ASSESS_TOOL],
      tool_choice: { type: "tool", name: "record_assessment" },
      messages: [
        { role: "user", content: "Student: " + studentName + "\n\nWriting sample:\n\"\"\"\n" + text + "\n\"\"\"" },
      ],
    }),
  });
  if (res.getResponseCode() !== 200) {
    console.error("Anthropic (writing analysis) " + res.getResponseCode() + ": " + res.getContentText().slice(0, 300));
    return null;
  }
  var body = JSON.parse(res.getContentText());
  var content = body.content || [];
  for (var i = 0; i < content.length; i++) {
    if (content[i].type === "tool_use" && content[i].name === "record_assessment") return content[i].input;
  }
  return null;
}

function analyseWriting_(p) {
  var out;
  try {
    if (!teacherAuthed_(p)) {
      out = { ok: false, error: "unauthorized" };
    } else {
      var student = studentByAnyCode_(p.code);
      var sheetId = student
        ? PropertiesService.getScriptProperties().getProperty("sheet_" + student.code)
        : null;
      var text = String(p.text || "").trim().slice(0, WRITING_ANALYSIS_MAX_INPUT);
      if (!sheetId) {
        out = { ok: false, error: "unknown student" };
      } else if (text.length < 20) {
        out = { ok: false, error: "writing sample looks too short" };
      } else {
        var a = analyseWritingWithClaude_(text, student.name);
        if (!a) {
          out = { ok: false, error: "The AI helper isn't switched on yet, or couldn't answer just now." };
        } else {
          var ss = SpreadsheetApp.openById(sheetId);
          var lock = LockService.getScriptLock();
          lock.waitLock(10000);
          try {
            appendWriting_(ss, {
              title: p.title || "Writing sample",
              cefr: a.cefr,
              grammar: a.grammar,
              vocab: a.vocab,
              coherence: a.coherence,
              errors: a.errors,
              feedback: a.feedback,
              link: p.link || "",
            });
          } finally {
            lock.releaseLock();
          }
          out = { ok: true, assessment: a };
        }
      }
    }
  } catch (err) {
    console.error("analyseWriting_ error: " + err);
    out = { ok: false, error: "internal error" };
  }
  return json_(out); // POST-only
}

// ── Focus note (the "flag a focus point" pair — surfaces in-app AND in AI) ──
// One short note per student, settable from the dashboard. Shown on the
// student's Today screen ("From Rory") and woven into the AI system prompt
// (see getAi_). Stored in Script Properties, not a Sheet — short-lived,
// frequently overwritten, no history needed.
function focusNoteKey_(code) {
  return "focus_" + code;
}
function focusNoteFor_(code) {
  return PropertiesService.getScriptProperties().getProperty(focusNoteKey_(code)) || "";
}

function getNote_(p) {
  var out;
  try {
    var student = p.secret === SECRET ? studentByAnyCode_(p.code) : null;
    out = student ? { ok: true, note: focusNoteFor_(student.code) } : { ok: false, error: "unauthorized" };
  } catch (err) {
    out = { ok: false, error: "internal error" };
  }
  return reply_(p.callback, out);
}

function setFocusNote_(p) {
  var out;
  try {
    var expected = PropertiesService.getScriptProperties().getProperty(TEACHER_PASSWORD_PROP);
    if (!expected || p.teacherSecret !== expected) {
      out = { ok: false, error: "unauthorized" };
    } else {
      var student = studentByAnyCode_(p.code);
      if (!student) {
        out = { ok: false, error: "unknown student" };
      } else {
        var note = String(p.note || "").trim().slice(0, FOCUS_NOTE_MAX_CHARS);
        var key = focusNoteKey_(student.code);
        if (note) {
          PropertiesService.getScriptProperties().setProperty(key, note);
        } else {
          PropertiesService.getScriptProperties().deleteProperty(key); // empty = clear
        }
        out = { ok: true };
      }
    }
  } catch (err) {
    console.error("setFocusNote_ error: " + err);
    out = { ok: false, error: "internal error" };
  }
  return json_(out); // POST-only
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
      var students = getRoster_().map(function (s) {
        var sheetId = props.getProperty("sheet_" + s.code);
        var ss = sheetId ? safeOpen_(sheetId) : null;
        return {
          code: s.code,
          name: s.name,
          summary: ss ? studentSummary_(ss) : null,
          focusNote: focusNoteFor_(s.code),
        };
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

// Teacher-only: provision a brand-new student (Drive folder + Sheet + Roster
// row) at request time — no code change, no redeploy needed for their data
// infrastructure to work. The STATIC app shell (their /s/<code>/ route) still
// needs one `npm run deploy` — see scripts/add-student.mjs, which scaffolds
// the content/ files from the code+name this returns.
function addStudent_(p) {
  var out;
  try {
    var expected = PropertiesService.getScriptProperties().getProperty(TEACHER_PASSWORD_PROP);
    if (!expected || p.teacherSecret !== expected) {
      out = { ok: false, error: "unauthorized" };
    } else {
      var name = String(p.name || "").trim().slice(0, 60);
      if (!name || !/^[A-Za-z][A-Za-z '-]*$/.test(name)) {
        out = { ok: false, error: "enter a valid first name" };
      } else {
        var lock = LockService.getScriptLock();
        lock.waitLock(10000);
        try {
          ensureRoster_(); // idempotent — safe even if setup() was never run; also
                            // invalidates the cache, so the check below is fresh.
          // Reject same-name duplicates INSIDE the lock (not just before it) —
          // two near-simultaneous "Add student" submits (double-tap, a retried
          // request) would otherwise both pass a pre-lock check and each
          // provision their own folder/Sheet/Roster row for what's meant to be
          // one student. Same name also matters beyond the race: Drive folders
          // and the Lessons&feedback name-search are keyed by display name, so
          // two same-named students would collide there regardless of code.
          var existing = getRoster_().some(function (s) {
            return s.name.toLowerCase() === name.toLowerCase();
          });
          if (existing) {
            out = { ok: false, error: "a student named " + name + " already exists — try adding a last initial" };
          } else {
            var code = uniqueCode_(name);
            var parentCode = uniqueCode_(name + "-fam");
            var student = { code: code, parentCode: parentCode, name: name };
            provisionStudent_(student);
            appendRosterRow_(student);
            out = { ok: true, code: code, parentCode: parentCode, name: name };
          }
        } finally {
          lock.releaseLock();
        }
      }
    }
  } catch (err) {
    console.error("addStudent_ error: " + err);
    out = { ok: false, error: "internal error" };
  }
  return json_(out); // POST-only
}

// "ferdi-7h3k" style: lowercase first name + a random 4-char suffix, retried
// until it doesn't collide with an existing code (collision is astronomically
// unlikely at this scale, but the loop makes it a non-issue either way).
function uniqueCode_(name) {
  var base = name
    .toLowerCase()
    .replace(/[^a-z]+/g, "")
    .slice(0, 20) || "student";
  for (var i = 0; i < 20; i++) {
    var suffix = Utilities.getUuid().replace(/-/g, "").slice(0, 4);
    var candidate = base + "-" + suffix;
    if (!studentByAnyCode_(candidate)) return candidate;
  }
  throw new Error("could not generate a unique code");
}

// Reads the Dashboard tab's already-computed formula values (COUNTIF/MAX over
// the other tabs) instead of recomputing from raw rows — reuses the exact
// numbers a tutor sees opening the Sheet directly, and stays correct if Rory
// ever hand-edits a row. Also derives a simple triage signal (days since any
// activity) from the same "Last updated" value, so the dashboard can flag a
// quiet student without a second Sheet read.
function studentSummary_(ss) {
  var d = ss.getSheetByName("Dashboard");
  if (!d || d.getLastRow() < 7) return null;
  var v = d.getRange("A2:B7").getValues(); // fixed order: see writeDashboard_
  var val = function (i) {
    var x = v[i][1];
    return x instanceof Date ? x.toISOString() : x;
  };
  var lastUpdated = val(5);
  // Only trust a REAL Date cell. The "Last updated" formula is
  // =IFERROR(MAX(Homework!A2:A,'Vocab & Quizzes'!A2:A),"—") — MAX() over two
  // genuinely empty ranges (a brand-new student, or one whose only activity
  // is in School Tests/Writing/Speaking/Mock Tests, which this formula
  // doesn't cover) evaluates to the NUMBER 0, not an error, so IFERROR never
  // fires and it's never the "—" string either. `new Date(0)` is a VALID
  // Date (the Unix epoch) — coercing that would flag every such student as
  // "quiet" for ~20,000 days. Anything that isn't a Date cell means "no
  // activity yet", not "epoch", so daysSinceActivity stays null.
  var daysSinceActivity = v[5][1] instanceof Date
    ? Math.floor((Date.now() - v[5][1].getTime()) / 86400000)
    : null;
  return {
    homeworkDone: val(0),
    quizRounds: val(1),
    bestQuizPct: val(2),
    schoolTests: val(3),
    writingSamples: val(4),
    lastUpdated: lastUpdated,
    daysSinceActivity: daysSinceActivity,
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
