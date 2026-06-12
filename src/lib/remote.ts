"use client";

// ─────────────────────────────────────────────────────────────────────────────
// REMOTE PROGRESS READ (JSONP)
//
// Reads a student's progress snapshot from the Apps Script doGet endpoint.
// Apps Script can't send CORS headers, so we use JSONP (inject a <script> with a
// callback) to read cross-origin. Same URL + secret as the write sync.
// Works on ANY device (this is what powers the parent view).
// ─────────────────────────────────────────────────────────────────────────────

const URL = process.env.NEXT_PUBLIC_SYNC_URL || "";
const SECRET = process.env.NEXT_PUBLIC_SYNC_SECRET || "";

export function remoteEnabled(): boolean {
  return URL.length > 0;
}

export interface Section {
  headers: string[];
  rows: (string | number)[][];
}

export interface Progress {
  ok: boolean;
  name?: string;
  generatedAt?: string;
  homework?: Section;
  quizzes?: Section;
  schoolTests?: Section;
  writing?: Section;
  speaking?: Section;
  mockTests?: Section;
  error?: string;
}

let counter = 0;

// Generic JSONP GET against the Apps Script doGet endpoint.
function jsonp<T>(action: string, code: string): Promise<T> {
  return new Promise((resolve, reject) => {
    if (!URL) {
      reject(new Error("sync not configured"));
      return;
    }
    const cb = `__re_${action}_${counter++}_${Date.now()}`;
    const script = document.createElement("script");
    const timer = window.setTimeout(() => {
      cleanup();
      reject(new Error("timeout"));
    }, 12000);

    function cleanup() {
      window.clearTimeout(timer);
      delete (window as unknown as Record<string, unknown>)[cb];
      script.remove();
    }

    (window as unknown as Record<string, unknown>)[cb] = (data: T) => {
      cleanup();
      resolve(data);
    };

    const params = new URLSearchParams({ action, code, secret: SECRET, callback: cb });
    script.src = `${URL}?${params.toString()}`;
    script.onerror = () => {
      cleanup();
      reject(new Error("network error"));
    };
    document.body.appendChild(script);
  });
}

/** Fetch a progress snapshot by student code OR parent code. */
export function fetchProgress(code: string): Promise<Progress> {
  return jsonp<Progress>("progress", code);
}

// ── Shared Drive resources (lesson slides, feedback, assessments) ────────────
export interface ResourceItem {
  name: string;
  url: string;
  type: string; // MIME type
  modified: string; // YYYY-MM-DD
}
export interface Resources {
  ok: boolean;
  name?: string;
  resources?: ResourceItem[];
  error?: string;
}

/** Fetch the student's shared Drive files by student code OR parent code. */
export function fetchResources(code: string): Promise<Resources> {
  return jsonp<Resources>("resources", code);
}
