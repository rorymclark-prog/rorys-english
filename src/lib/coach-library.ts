export const COACH_LIBRARY_ORIGIN = "https://rorys-english-lesson-library.rorymclark.chatgpt.site";
export type LibraryLearner = "Ferdi" | "Valentin";
export type LibraryPack = { id: string; learner: LibraryLearner; title: string; focus: string; format: string; files: { name: string; label: string; type: string; size: number }[] };
export type LibraryCatalogue = { edition: string; packs: LibraryPack[] };
export type LibraryContext = { pack: Omit<LibraryPack, "files">; guide: string; teacherNotes: string; notesHistorical: boolean; edition: string };
export type LibraryMaterial = { pack: Omit<LibraryPack, "files">; edition: string; name: string; type: string; size: number; data: ArrayBuffer; historical: boolean; warning: string };
type LibraryRequest = { action: "catalogue" | "lesson"; learner: LibraryLearner; packId?: string; asset?: "context" | "pdf" | "powerpoint" | "teacher-notes" };
type Pending = { resolve: (data: unknown) => void; reject: (error: Error) => void; timer: number };

const object = (value: unknown): value is Record<string, unknown> => !!value && typeof value === "object" && !Array.isArray(value);
const string = (value: unknown, max: number): value is string => typeof value === "string" && value.length <= max;
function packMetadata(value: unknown, learner: LibraryLearner): value is Omit<LibraryPack, "files"> {
  return object(value) && string(value.id, 400) && !!value.id && value.learner === learner && string(value.title, 500) && string(value.focus, 2000) && string(value.format, 120);
}

export function readLibraryCatalogue(value: unknown, learner: LibraryLearner): LibraryCatalogue {
  if (!object(value) || !string(value.edition, 300) || !Array.isArray(value.packs) || value.packs.length > 200) throw new Error("The private library returned an invalid lesson list.");
  for (const pack of value.packs) {
    const files: unknown = object(pack) ? pack.files : undefined;
    if (!packMetadata(pack, learner) || !Array.isArray(files) || files.length > 100 || !files.every((file: unknown) => object(file) && string(file.name, 500) && string(file.label, 500) && string(file.type, 120) && typeof file.size === "number" && Number.isFinite(file.size) && file.size >= 0)) throw new Error("The private library returned a lesson outside the selected learner or an invalid file list.");
  }
  return value as LibraryCatalogue;
}

export function readLibraryContext(value: unknown, learner: LibraryLearner, packId: string): LibraryContext {
  if (!object(value) || !packMetadata(value.pack, learner) || value.pack.id !== packId || !string(value.edition, 300) || !string(value.guide, 500000) || !string(value.teacherNotes, 500000) || typeof value.notesHistorical !== "boolean") throw new Error("The lesson reference did not match the selected learner and lesson.");
  return value as LibraryContext;
}

export function readLibraryMaterial(value: unknown, learner: LibraryLearner, packId: string, asset: "pdf" | "powerpoint" | "teacher-notes"): LibraryMaterial {
  const mime = asset === "powerpoint" ? "application/vnd.openxmlformats-officedocument.presentationml.presentation" : "application/pdf";
  let bytes = -1;
  try { bytes = Object.getOwnPropertyDescriptor(ArrayBuffer.prototype, "byteLength")!.get!.call(object(value) ? value.data : undefined); } catch { /* Not an ArrayBuffer. */ }
  if (!object(value) || !packMetadata(value.pack, learner) || value.pack.id !== packId || !string(value.edition, 300) || !string(value.name, 500) || !value.name || value.type !== mime || value.size !== bytes || bytes <= 0 || bytes > (asset === "powerpoint" ? 64_000_000 : 25_000_000) || typeof value.historical !== "boolean" || !string(value.warning, 3000)) throw new Error("The saved file could not be verified or is too large to open here.");
  return value as LibraryMaterial;
}

export function libraryReference(context: LibraryContext): string {
  const current = context.guide.trim();
  const notes = context.notesHistorical ? "" : context.teacherNotes.trim();
  return [
    `Private prepared lesson: ${context.pack.title}`,
    `Library edition: ${context.edition}`,
    "Preparation reference, not evidence of work completed or learner ability.",
    current ? "Current delivery guide below. Older teacher notes and supporting PDFs may differ; follow this guide for the revised route." : notes ? "Saved teacher preparation below; no current delivery guide was available." : "Only lesson metadata is available as current reference. Historical teacher notes are kept separately.",
    current || notes || context.pack.focus,
  ].join("\n\n").slice(0, 12000);
}

/** A browser-only, explicitly opened connection. No private bytes go via the app server. */
export class CoachLibraryClient {
  private popup: Window | null = null;
  private session = "";
  private ready = false;
  private pending = new Map<string, Pending>();
  private connectedPromise: { resolve: () => void; reject: (error: Error) => void; timer: number } | null = null;
  private poll: number | null = null;
  private listening = false;

  constructor(private host: Window, private onDisconnect: () => void = () => {}) {}

  private onMessage = (event: MessageEvent) => {
    const data: unknown = event.data;
    if (event.origin !== COACH_LIBRARY_ORIGIN || event.source !== this.popup || !object(data) || data.session !== this.session) return;
    if (data.type === "rory-library-ready" && this.connectedPromise) {
      this.ready = true;
      this.host.clearTimeout(this.connectedPromise.timer);
      this.connectedPromise.resolve(); this.connectedPromise = null;
      return;
    }
    if (data.type !== "rory-library-response" || !string(data.requestId, 100)) return;
    const request = this.pending.get(data.requestId);
    if (!request) return;
    this.pending.delete(data.requestId); this.host.clearTimeout(request.timer);
    if (data.ok === true) request.resolve(data.data);
    else request.reject(new Error(string(data.error, 2000) ? data.error : "The private lesson could not be opened."));
  };

  async connect(): Promise<void> {
    if (this.ready && this.popup && !this.popup.closed) { this.popup.focus(); return; }
    this.close();
    this.session = this.host.crypto.randomUUID();
    this.host.addEventListener("message", this.onMessage); this.listening = true;
    const url = `${COACH_LIBRARY_ORIGIN}/teaching-bridge.html#origin=${encodeURIComponent(this.host.location.origin)}&session=${encodeURIComponent(this.session)}`;
    this.popup = this.host.open(url, "rory-private-lesson-library", "popup,width=720,height=640");
    if (!this.popup) { this.close(); throw new Error("Allow the private library window to open, then connect again."); }
    this.poll = this.host.setInterval(() => { if (this.popup?.closed) this.close(); }, 1000);
    return new Promise<void>((resolve, reject) => {
      const timer = this.host.setTimeout(() => {
        const error = new Error("The library connection is not ready. Sign in to the library, then reconnect. If sign-in opened a new window, return here and reconnect after signing in. If the teaching connection is not yet available, use Open lesson library and import a document.");
        this.connectedPromise?.reject(error); this.connectedPromise = null; this.close();
      }, 60000);
      this.connectedPromise = { resolve, reject, timer };
    });
  }

  request(body: LibraryRequest): Promise<unknown> {
    if (!this.ready || !this.popup || this.popup.closed) return Promise.reject(new Error("Reconnect the private lesson library before opening another saved lesson."));
    const requestId = this.host.crypto.randomUUID();
    return new Promise((resolve, reject) => {
      const timer = this.host.setTimeout(() => {
        this.pending.delete(requestId);
        reject(new Error("The saved lesson took too long to open. Reconnect the library and try again."));
      }, 45000);
      this.pending.set(requestId, { resolve, reject, timer });
      try { this.popup!.postMessage({ type: "rory-library-request", session: this.session, requestId, ...body }, COACH_LIBRARY_ORIGIN); }
      catch { this.pending.delete(requestId); this.host.clearTimeout(timer); reject(new Error("The private library window disconnected. Reconnect and try again.")); }
    });
  }

  close(): void {
    this.ready = false;
    if (this.listening) this.host.removeEventListener("message", this.onMessage);
    this.listening = false;
    if (this.poll !== null) this.host.clearInterval(this.poll); this.poll = null;
    if (this.connectedPromise) {
      this.host.clearTimeout(this.connectedPromise.timer);
      this.connectedPromise.reject(new Error("The private library window closed. Reconnect after signing in to the library.")); this.connectedPromise = null;
    }
    for (const request of this.pending.values()) { this.host.clearTimeout(request.timer); request.reject(new Error("The private library connection changed. Choose the lesson again.")); }
    this.pending.clear();
    this.session = "";
    this.popup?.close(); this.popup = null;
    this.onDisconnect();
  }
}
