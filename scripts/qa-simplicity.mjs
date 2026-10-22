// Isolated browser QA only: synthetic sessions, intercepted APIs, fake microphone.
// Run a local production build first; this script refuses non-loopback origins.
import puppeteer from "puppeteer-core";
import assert from "node:assert/strict";
import fs from "node:fs/promises";

const origin = process.env.QA_ORIGIN || "http://127.0.0.1:4198";
assert.equal(new URL(origin).hostname, "127.0.0.1", "QA must run against the isolated local app");
const output = process.env.QA_OUTPUT || "/tmp/rory-simplicity-qa";
await fs.mkdir(output, { recursive: true });
for (const name of await fs.readdir(output)) if (/^failure(?:[-.]|$)/.test(name)) await fs.rm(`${output}/${name}`);
const browser = await puppeteer.launch({
  executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  headless: true,
  args: ["--use-fake-device-for-media-stream", "--use-fake-ui-for-media-stream"],
});
const errors = [], requests = [], blocked = [], checks = [], unexpectedWrites = [];
let fixture = "pending";
const student = "ferdi-7h3k", unit = "english-in-context5-unit01-2026";
const feedback = {
  heard: "Yesterday I go by bus.", strength: "A clear time and means of transport.",
  focus: "Use a past-tense verb.", correction: "Yesterday I went by bus.",
  prompt: "Yesterday I …?", next: "Tell me where you went.", uncertainty: "Synthetic QA fixture.",
};
const section = { headers: [], rows: [] };
const submitted = week => ({ id: `qa-${week}`, unit, task: `hw:${week}`, submitted: "2026-10-21T12:00:00Z", answers: { writing: "Synthetic practice only." }, status: "reviewed", feedback: "Clear sequence. Try another example.", reviewed: "2026-10-21T13:00:00Z" });

function service(body) {
  switch (body.action) {
    case "teacherDashboard": return { ok: true, students: [{ code: student, name: "Ferdi", summary: null, focusNote: "Past forms" }, { code: "valentin-q9m2", name: "Valentin", summary: null, focusNote: "Reasons and detail" }], generatedAt: "Synthetic QA" };
    case "note": return { ok: true, note: "Synthetic QA lesson notice." };
    case "assignments": return { ok: true, assignments: section };
    case "submissions": return { ok: true, submissions: fixture === "reviewed" ? [submitted(1), submitted(2)] : [submitted(1)] };
    case "learningRecords": return { ok: true, records: [], replies: [] };
    case "learningMemory": return { ok: true, memory: { enabled: true, entries: [], focus: [] } };
    case "documents": return { ok: true, documents: [] };
    case "progress": return { ok: true, name: "Ferdi", homework: section, quizzes: section, schoolTests: section, writing: section, speaking: section, mockTests: section };
    case "calendarLessons": case "teacherCalendarLessons": return { ok: true, lessons: [], requests: [], breaks: [], tests: [] };
    case "resources": return { ok: true, resources: [] };
    default: unexpectedWrites.push(body.action); return { ok: false, error: "QA blocked this unexpected service action." };
  }
}

async function isolatedPage() {
  const page = await browser.newPage();
  page.on("pageerror", error => errors.push(error.message));
  await page.setBypassServiceWorker(true);
  await page.setRequestInterception(true);
  page.on("request", async request => {
    try {
      const url = new URL(request.url());
      if (["data:", "blob:"].includes(url.protocol)) { await request.continue(); return; }
      if (url.origin !== origin) { blocked.push(url.origin); await request.abort(); return; }
      if (/^\/api\//.test(url.pathname)) {
        const body = JSON.parse(request.postData() || "{}");
        requests.push({ path: url.pathname, action: body.action || request.method(), context: body.context, text: body.text, question: body.question, evidence: body.evidence });
        let result, status = 200;
        if (/^\/api\/service\/?$/.test(url.pathname)) result = service(body);
        else if (/^\/api\/live-coach\/?$/.test(url.pathname)) {
          if (body.action === "status") result = { available: true };
          else if (body.action === "analyse") result = { feedback };
          else if (body.action === "question") result = { answer: "Synthetic answer: ask for one reason and a fresh example." };
          else if (body.action === "connect") { status = 503; result = { error: "Synthetic QA connection reached; no live AI was contacted." }; }
          else { unexpectedWrites.push(`coach:${body.action}`); result = { error: "Unexpected QA action" }; status = 400; }
        } else if (/^\/api\/voice\/?$/.test(url.pathname)) { result = { available: true }; if (request.method() !== "GET") { status = 503; result = { error: "Synthetic voice fixture" }; } }
        else { unexpectedWrites.push(url.pathname); status = 400; result = { ok: false, error: "QA blocks unconfigured APIs" }; }
        await request.respond({ status, contentType: "application/json", body: JSON.stringify(result) }); return;
      }
      await request.continue();
    } catch (error) { errors.push(`Request interception: ${error.message}`); await request.abort().catch(() => {}); }
  });
  await page.evaluateOnNewDocument(() => {
    localStorage.setItem("re_install_hint_dismissed", "1");
    for (const [code, role] of [["ferdi-7h3k", "student"], ["valentin-q9m2", "student"], ["__teacher__", "teacher"]]) {
      localStorage.setItem(`re_session_v2_${code}`, JSON.stringify({ token: `synthetic-${role}-qa`, expires: Date.now() + 3600000, role }));
    }
    for (const id of ["ferdi", "valentin", "__teacher__"]) if (!localStorage.getItem(`${id}_settings`)) localStorage.setItem(`${id}_settings`, JSON.stringify({ theme: "light", textScale: "normal" }));
    window.__qaDisplayAudio = false;
    navigator.mediaDevices.getDisplayMedia = async () => {
      const canvas = document.createElement("canvas"); canvas.width = 320; canvas.height = 180;
      canvas.getContext("2d").fillRect(0, 0, 320, 180);
      const stream = canvas.captureStream(5);
      if (window.__qaDisplayAudio) {
        const audio = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
        audio.getAudioTracks().forEach(track => stream.addTrack(track));
      }
      return stream;
    };
  });
  return page;
}

async function go(page, path) { await page.goto(origin + path, { waitUntil: "networkidle0" }); await page.waitForSelector("main,#student-content,.live-coach"); }
async function click(page, text, scope = "body") {
  const selector = await page.evaluate(({ text, scope }) => {
    const element = [...document.querySelector(scope).querySelectorAll("button,summary")].find(e => e.textContent.trim() === text);
    if (!element) return "";
    element.setAttribute("data-qa-click", "target"); return '[data-qa-click="target"]';
  }, { text, scope });
  assert.ok(selector, `Control not found: ${text}`);
  await page.click(selector); await page.evaluate(() => document.querySelector('[data-qa-click="target"]')?.removeAttribute("data-qa-click"));
}
async function field(page, label, value, scope = "body") {
  const control = await page.evaluateHandle(({ label, scope }) => [...document.querySelector(scope).querySelectorAll("label")].find(e => e.firstChild?.textContent.trim() === label)?.querySelector("input,select,textarea"), { label, scope });
  const element = control.asElement(); assert.ok(element, `Field not found: ${label}`);
  if (await element.evaluate(e => e.tagName === "SELECT")) await element.select(value);
  else { await element.click({ clickCount: 3 }); await element.press("Backspace"); await element.type(value); }
  await control.dispose();
}
async function overflow(page, width, name) {
  await page.setViewport({ width, height: width === 390 ? 844 : 1100 });
  const layout = await page.evaluate(() => ({ scroll: document.documentElement.scrollWidth, viewport: innerWidth }));
  assert.ok(layout.scroll <= width + 1, `${name} overflows at ${width}: ${layout.scroll}`);
  await page.screenshot({ path: `${output}/${name}-${width}.png`, fullPage: true });
  checks.push({ name, width, ...layout });
}
async function database(page) {
  return page.evaluate(() => new Promise((resolve, reject) => {
    const request = indexedDB.open("rory-private-teaching-v1", 1);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      const db = request.result, transaction = db.transaction(["lessons", "audio"], "readonly");
      const lessons = transaction.objectStore("lessons").getAll(), chunks = transaction.objectStore("audio").getAll();
      transaction.oncomplete = () => { resolve({ lessons: lessons.result, chunks: chunks.result.map(chunk => ({ lessonId: chunk.lessonId, sequence: chunk.sequence, bytes: chunk.blob.size, type: chunk.blob.type })) }); db.close(); };
      transaction.onerror = () => reject(transaction.error);
    };
  }));
}

try {
  await browser.defaultBrowserContext().overridePermissions(origin, ["microphone", "camera"]);
  const page = await isolatedPage();
  await go(page, `/s/${student}/`);
  await page.waitForFunction(() => document.querySelector(".today-hero")?.getAttribute("aria-busy") === "false");
  assert.match(await page.$eval("#today-hero-title", e => e.textContent), /practice 2/);
  checks.push({ name: "pending homework comes before reviewed first task", passed: true });
  for (const width of [390, 820, 1440]) await overflow(page, width, "today-pending");
  fixture = "reviewed";
  await page.reload({ waitUntil: "networkidle0" });
  await page.waitForFunction(() => document.querySelector(".today-hero")?.getAttribute("aria-busy") === "false");
  assert.equal(await page.$eval(".today-hero .re-button", e => e.textContent), "View feedback");
  assert.equal(await page.$(".today-hero-more"), null);
  checks.push({ name: "all-reviewed homework offers feedback", passed: true });
  fixture = "pending";
  await go(page, `/s/${student}/`);
  const normal = await page.$eval(".today-hero h2", e => parseFloat(getComputedStyle(e).fontSize));
  await go(page, `/s/${student}/settings/`);
  await click(page, "AaExtra large");
  await click(page, "More appearance choices");
  await click(page, "Warm clay");
  assert.equal(await page.evaluate(() => document.documentElement.dataset.palette), "clay");
  await click(page, "Paper & blue");
  await go(page, `/s/${student}/`);
  const large = await page.$eval(".today-hero h2", e => parseFloat(getComputedStyle(e).fontSize));
  assert.ok(large >= normal * 1.30, `Text size did not scale: ${normal} -> ${large}`);
  checks.push({ name: "rewritten text follows Extra large and palette choice works", normal, large });
  await page.setViewport({ width: 390, height: 844 });
  await page.screenshot({ path: `${output}/today-extra-large-390.png`, fullPage: true });
  for (const path of ["year-plan/", "speak/", "lessons/", "documents/", "test-prep/", "homework/"]) {
    await go(page, `/s/${student}/${path}`);
    for (const width of [390, 820, 1440]) await overflow(page, width, path.replaceAll("/", ""));
  }

  const teacher = await isolatedPage();
  await go(teacher, "/teacher/live/");
  await teacher.waitForSelector(".live-coach");
  await teacher.waitForFunction(() => document.querySelector(".lc-connection")?.textContent.includes("AI connection configured"));
  for (const width of [390, 820, 1440]) await overflow(teacher, width, "teacher-setup");
  assert.equal(await teacher.$eval(".lc-controls .lc-consent input", e => e.checked), false);
  await click(teacher, "Try prepared rehearsal");
  await teacher.waitForFunction(() => document.querySelector(".lc-feedback")?.textContent.includes("Past simple"));
  await click(teacher, "Save lesson notes");
  await teacher.waitForFunction(() => document.querySelector(".lc-recording")?.textContent.includes("Prepared rehearsal is excluded"));
  assert.equal((await database(teacher)).lessons.length, 0);
  await teacher.click(".lc-controls .lc-consent input");
  await field(teacher, "Current slide / source text", "Synthetic slide: talk about yesterday using one past-tense verb.");
  await field(teacher, "Microphone speaker", "teacher");
  await field(teacher, "Microphone speaker", "learner");
  await click(teacher, "Enter an answer manually");
  await field(teacher, "Learner’s actual words", feedback.heard);
  await click(teacher, "Get teaching feedback");
  await teacher.waitForFunction(() => document.querySelector(".lc-feedback")?.textContent.includes("Synthetic QA fixture"));
  await field(teacher, "Ask the AI privately", "How can I explain the past tense?");
  await click(teacher, "Ask AI");
  await teacher.waitForFunction(() => document.querySelector(".lc-talk-feed")?.textContent.includes("Synthetic answer"));
  const question = requests.find(request => request.action === "question");
  assert.match(question.context.source, /Synthetic slide/);
  assert.doesNotMatch(question.evidence, /Yesterday I go to the park/);
  checks.push({ name: "prepared examples excluded; manual feedback and private question use selected source", passed: true });
  await teacher.click(".lc-recording .lc-consent input");
  await click(teacher, "Record lesson");
  await teacher.waitForSelector(".lc-record-state");
  await teacher.waitForFunction(() => document.querySelector(".lc-record-state")?.textContent.startsWith("Recording"));
  await new Promise(resolve => setTimeout(resolve, 1600));
  await click(teacher, "Stop & save recording");
  await teacher.waitForFunction(() => document.querySelector(".lc-recording")?.textContent.includes("Lesson audio and notes saved"));
  let saved = await database(teacher);
  assert.equal(saved.lessons.length, 1);
  assert.equal(saved.lessons[0].state, "complete");
  assert.ok(saved.lessons[0].audioBytes > 0 && saved.chunks.reduce((sum, chunk) => sum + chunk.bytes, 0) > 0);
  assert.ok(saved.lessons[0].durationMs >= 1400);
  assert.ok(saved.lessons[0].turns.some(turn => turn.text === feedback.heard));
  assert.ok(saved.lessons[0].turns.every(turn => !turn.rehearsal));
  await teacher.click(".lc-saved-lessons>summary");
  await click(teacher, "Play saved audio");
  await teacher.waitForSelector('audio[aria-label="Saved lesson audio"]');
  assert.match(await teacher.$eval('audio[aria-label="Saved lesson audio"]', e => e.src), /^blob:/);
  await field(teacher, "My review & next lesson focus", "Synthetic saved review: try two new past forms.");
  await click(teacher, "Save my review");
  await teacher.waitForFunction(() => document.querySelector(".lc-recording")?.textContent.includes("Teacher review saved"));
  saved = await database(teacher);
  assert.equal(saved.lessons[0].teacherNote, "Synthetic saved review: try two new past forms.");
  checks.push({ name: "native fake-microphone recording saves audio, real evidence and teacher review", bytes: saved.lessons[0].audioBytes, durationMs: saved.lessons[0].durationMs, turns: saved.lessons[0].turns.length });
  await field(teacher, "Where is this lesson?", "online");
  assert.equal(await teacher.$eval(".lc-controls .teacher-primary", e => e.disabled), true);
  await click(teacher, "Connect call audio");
  await teacher.waitForFunction(() => document.querySelector(".lc-error")?.textContent.includes("No call audio was shared"));
  assert.equal(await teacher.$eval(".lc-controls .teacher-primary", e => e.disabled), true);
  await click(teacher, "Record lesson");
  await teacher.waitForFunction(() => document.querySelector(".lc-recording .lc-error")?.textContent.includes("Connect your call tab audio"));
  assert.equal((await database(teacher)).lessons.length, 1);
  await teacher.evaluate(() => { window.__qaDisplayAudio = true; });
  await click(teacher, "Connect call audio");
  await teacher.waitForFunction(() => document.body.innerText.includes("Microphone + call audio ready"));
  assert.equal(await teacher.$eval(".lc-controls .teacher-primary", e => e.disabled), false);
  await click(teacher, "Start listening");
  await teacher.waitForFunction(() => document.querySelector(".lc-error")?.textContent.includes("Synthetic QA connection reached"));
  assert.ok(requests.some(request => request.action === "connect"));
  checks.push({ name: "online mode refuses missing tab audio, accepts an explicit shared audio source and reaches mocked connection", passed: true });
  await click(teacher, "Presenter view");
  for (const width of [390, 820, 1440]) await overflow(teacher, width, "teacher-presenter");
  await teacher.reload({ waitUntil: "networkidle0" });
  await teacher.waitForSelector(".lc-saved-lessons");
  await teacher.click(".lc-saved-lessons>summary");
  await teacher.waitForSelector(".lc-history-item");
  await teacher.click(".lc-history-item");
  assert.equal(await teacher.$eval(".lc-lesson-review textarea", e => e.value), "Synthetic saved review: try two new past forms.");
  checks.push({ name: "audio and review survive a page reload", passed: true });
  assert.deepEqual(unexpectedWrites, [], "No real record writes should even be attempted");
  assert.deepEqual(errors, []);
  const result = { passed: checks.length, checks, errors, unexpectedWrites, blockedRemoteOrigins: [...new Set(blocked)], mockedActions: [...new Set(requests.map(request => request.action))], output };
  await fs.writeFile(`${output}/results.json`, JSON.stringify(result, null, 2));
  console.log(JSON.stringify(result, null, 2));
} catch (error) {
  await fs.writeFile(`${output}/failure.json`, JSON.stringify({ message: error.message, stack: error.stack, checks, errors, unexpectedWrites, requests }, null, 2));
  for (const [index, page] of (await browser.pages()).entries()) {
    await page.screenshot({ path: `${output}/failure-${index}.png`, fullPage: true }).catch(() => {});
    await fs.writeFile(`${output}/failure-${index}.txt`, await page.evaluate(() => document.body.innerText).catch(() => ""));
  }
  throw error;
} finally { await browser.close(); }
