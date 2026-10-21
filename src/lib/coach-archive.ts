import type { CoachContext, CoachEntry } from "./live-coach";

export type CoachTurn = { id: string; at: string; role: "learner" | "teacher" | "ai" | "unknown"; text: string; rehearsal?: boolean };
export type LessonSnapshot = { context: CoachContext; turns: CoachTurn[]; entries: CoachEntry[] };
export type ArchivedLesson = LessonSnapshot & {
  id: string; learnerCode: string; startedAt: string; updatedAt: string;
  state: "recording" | "complete" | "interrupted" | "notes";
  mimeType: string; audioBytes: number; durationMs: number; teacherNote: string;
};

const DB_NAME = "rory-private-teaching-v1";
let database: Promise<IDBDatabase> | undefined;

function openDatabase(): Promise<IDBDatabase> {
  if (typeof indexedDB === "undefined") return Promise.reject(new Error("This browser cannot save lesson history. Download your notes instead."));
  if (!database) {
    database = new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, 1);
      request.onupgradeneeded = () => {
        const db = request.result;
        db.createObjectStore("lessons", { keyPath: "id" });
        const chunks = db.createObjectStore("audio", { keyPath: ["lessonId", "sequence"] });
        chunks.createIndex("lessonId", "lessonId");
      };
      request.onsuccess = () => {
        const db = request.result;
        db.onversionchange = () => { db.close(); database = undefined; };
        resolve(db);
      };
      request.onerror = () => reject(new Error("Lesson storage could not open. Check this browser’s storage permissions."));
      request.onblocked = () => reject(new Error("Close other teaching tabs and try opening lesson history again."));
    }).catch(error => { database = undefined; throw error; });
  }
  return database;
}

function completed(transaction: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onabort = () => reject(new Error("Lesson storage failed or is full. Stop recording and download the available audio."));
    transaction.onerror = () => { /* onabort rejects after the failed transaction. */ };
  });
}

export function realLessonEvidence(snapshot: LessonSnapshot): LessonSnapshot {
  return {
    context: { ...snapshot.context },
    turns: snapshot.turns.filter(turn => !turn.rehearsal).map(turn => ({ ...turn })),
    entries: snapshot.entries.filter(entry => !entry.rehearsal).map(entry => ({ ...entry, context: { ...entry.context }, feedback: { ...entry.feedback } })),
  };
}

export function makeArchivedLesson(learnerCode: string, snapshot: LessonSnapshot, mimeType = ""): ArchivedLesson {
  const now = new Date().toISOString();
  return { ...realLessonEvidence(snapshot), id: crypto.randomUUID(), learnerCode, startedAt: now, updatedAt: now,
    state: mimeType ? "recording" : "notes", mimeType, audioBytes: 0, durationMs: 0, teacherNote: "" };
}

export async function saveArchivedLesson(lesson: ArchivedLesson): Promise<void> {
  const db = await openDatabase();
  const transaction = db.transaction("lessons", "readwrite");
  const done = completed(transaction);
  transaction.objectStore("lessons").put(lesson);
  await done;
}

export async function listArchivedLessons(learnerCode: string): Promise<ArchivedLesson[]> {
  const db = await openDatabase();
  const transaction = db.transaction("lessons", "readonly");
  const done = completed(transaction);
  const request = transaction.objectStore("lessons").getAll();
  await done;
  return (request.result as ArchivedLesson[]).filter(lesson => lesson.learnerCode === learnerCode)
    .sort((a, b) => b.startedAt.localeCompare(a.startedAt));
}

export async function saveAudioChunk(lessonId: string, sequence: number, blob: Blob): Promise<void> {
  const db = await openDatabase();
  const transaction = db.transaction("audio", "readwrite");
  const done = completed(transaction);
  transaction.objectStore("audio").put({ lessonId, sequence, blob });
  await done;
}

export async function archivedAudio(lesson: ArchivedLesson): Promise<Blob> {
  const db = await openDatabase();
  const transaction = db.transaction("audio", "readonly");
  const done = completed(transaction);
  const request = transaction.objectStore("audio").index("lessonId").getAll(lesson.id);
  await done;
  const chunks = request.result as { sequence: number; blob: Blob }[];
  chunks.sort((a, b) => a.sequence - b.sequence);
  return new Blob(chunks.map(chunk => chunk.blob), { type: lesson.mimeType });
}

export async function deleteArchivedLesson(id: string): Promise<void> {
  const db = await openDatabase();
  const transaction = db.transaction(["lessons", "audio"], "readwrite");
  const done = completed(transaction);
  transaction.objectStore("lessons").delete(id);
  const cursor = transaction.objectStore("audio").index("lessonId").openCursor(IDBKeyRange.only(id));
  cursor.onsuccess = () => { if (cursor.result) { cursor.result.delete(); cursor.result.continue(); } };
  await done;
}

// Serialise chunk commits so finalisation waits for every pending write. A
// rejected commit remains rejected: a failed chunk must never look saved.
export function audioChunkWriter(write: (sequence: number, blob: Blob) => Promise<void>) {
  let sequence = 0;
  let tail = Promise.resolve();
  return {
    append(blob: Blob) {
      const index = sequence++;
      tail = tail.then(() => write(index, blob));
      return tail;
    },
    flush: () => tail,
  };
}

export function lessonNotes(lesson: ArchivedLesson): string {
  const name = (role: CoachTurn["role"]) => role === "learner" ? lesson.context.learner : role === "teacher" ? "Rory" : role === "ai" ? "AI suggestion" : "Speaker unclear";
  return ["# Private lesson record", `${lesson.context.learner} · ${lesson.startedAt}`, `Activity: ${lesson.context.task}`, `Objective: ${lesson.context.objective}`,
    "Teacher review required. Machine captions may mishear speech. Text cannot establish pronunciation. Prepared rehearsal is excluded.",
    `Teacher note / next lesson: ${lesson.teacherNote || "Not yet added."}`,
    "## Conversation", ...lesson.turns.filter(turn => !turn.rehearsal).map(turn => `${turn.at} · ${name(turn.role)}\n${turn.text}`),
    "## Coaching evidence", ...lesson.entries.filter(entry => !entry.rehearsal).map(entry => `${entry.at} · ${entry.context.slide}\n${Object.entries(entry.feedback).filter(([, value]) => value).map(([key, value]) => `${key}: ${value}`).join("\n")}`),
  ].join("\n\n");
}
