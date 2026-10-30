import type { CoachSlide } from "@/lib/server/coach-material";

export type LocalCoachSlide = CoachSlide & { notes?: string };
type InflateRaw = (bytes: Uint8Array, maximum: number) => Promise<Uint8Array>;
type Options = { inflateRaw?: InflateRaw; parseXml?: (xml: string) => Document };
type Entry = { name: string; flags: number; method: number; size: number; expanded: number; local: number; crc: number };
const INPUT_LIMIT = 64_000_000, XML_LIMIT = 500_000, TOTAL_LIMIT = 6_000_000;
const bad = () => new Error("This PowerPoint is damaged or uses an unsupported ZIP format. Export a slide PDF or paste the current exercise instead.");
const tooLarge = () => new Error("Choose a PowerPoint below 64 MB with at most 300 slides and 6 MB of extracted slide XML.");
const utf8 = new TextDecoder("utf-8", { fatal: true });

/** Bound each inflation chunk before joining it; never buffer an unbounded ZIP entry. */
async function inflateBrowser(bytes: Uint8Array, maximum: number): Promise<Uint8Array> {
  let decompressor: DecompressionStream;
  try { decompressor = new DecompressionStream("deflate-raw"); }
  catch { throw new Error("This browser cannot read PowerPoint ZIP compression. Open a PDF export or paste the current slide text instead."); }
  const source = new ReadableStream<BufferSource>({ start(controller) { controller.enqueue(Uint8Array.from(bytes)); controller.close(); } });
  const reader = source.pipeThrough(decompressor).getReader();
  const chunks: Uint8Array[] = []; let count = 0;
  try {
    while (true) {
      const { value, done } = await reader.read(); if (done) break;
      count += value.byteLength;
      if (count > maximum) { await reader.cancel(); throw tooLarge(); }
      chunks.push(value);
    }
  } finally { reader.releaseLock(); }
  const output = new Uint8Array(count); let offset = 0;
  for (const chunk of chunks) { output.set(chunk, offset); offset += chunk.length; }
  return output;
}

function crc32(bytes: Uint8Array): number {
  let crc = 0xffffffff;
  for (const byte of bytes) { crc ^= byte; for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0); }
  return (crc ^ 0xffffffff) >>> 0;
}

/** Browser-local, text-only import: images, audio, animations and layouts are never decoded. */
export async function readCoachPptxLocally(file: Pick<File, "size" | "arrayBuffer">, options: Options = {}): Promise<LocalCoachSlide[]> {
  if (file.size < 22 || file.size > INPUT_LIMIT) throw tooLarge();
  const data = new Uint8Array(await file.arrayBuffer());
  if (data.byteLength < 22 || data.byteLength > INPUT_LIMIT) throw tooLarge();
  const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
  const u16 = (offset: number) => view.getUint16(offset, true), u32 = (offset: number) => view.getUint32(offset, true);
  let end = -1;
  for (let i = data.length - 22; i >= Math.max(0, data.length - 65_557); i--) {
    if (u32(i) === 0x06054b50 && i + 22 + u16(i + 20) === data.length) { end = i; break; }
  }
  if (end < 0) throw bad();
  const count = u16(end + 10), centralSize = u32(end + 12), centralOffset = u32(end + 16);
  // Split archives and ZIP64 are intentionally unsupported.
  if (u16(end + 4) || u16(end + 6) || u16(end + 8) !== count || count === 0xffff || centralSize === 0xffffffff || centralOffset === 0xffffffff) throw bad();
  if (count > 10_000) throw tooLarge();
  if (centralOffset + centralSize !== end) throw bad();
  const catalogue = new Map<string, Entry>(); let cursor = centralOffset;
  function extraFields(start: number, length: number) {
    const stop = start + length; let position = start;
    while (position < stop) {
      if (position + 4 > stop) throw bad();
      const id = u16(position), size = u16(position + 2); position += 4;
      if (id === 1 || position + size > stop) throw bad();
      position += size;
    }
  }
  for (let i = 0; i < count; i++) {
    if (cursor + 46 > end || u32(cursor) !== 0x02014b50) throw bad();
    const flags = u16(cursor + 8), method = u16(cursor + 10), size = u32(cursor + 20), expanded = u32(cursor + 24), local = u32(cursor + 42);
    const nameSize = u16(cursor + 28), extraSize = u16(cursor + 30), commentSize = u16(cursor + 32), nameEnd = cursor + 46 + nameSize;
    const next = nameEnd + extraSize + commentSize;
    if (!nameSize || next > end || (flags & ~0x080e) || ![0, 8].includes(method) || u16(cursor + 34) || [size, expanded, local].includes(0xffffffff)) throw bad();
    const name = utf8.decode(data.subarray(cursor + 46, nameEnd));
    if (/[\\\0:]/.test(name) || name.startsWith("/") || name.split("/").some(part => part === "." || part === "..") || catalogue.has(name)) throw bad();
    if (local + 30 > centralOffset) throw bad();
    extraFields(nameEnd, extraSize);
    catalogue.set(name, { name, flags, method, size, expanded, local, crc: u32(cursor + 16) });
    cursor = next;
  }
  if (cursor !== end) throw bad();
  function validateLocal(entry: Entry): { start: number; end: number } {
    const { local, size, expanded, flags, method, name } = entry;
    if (u32(local) !== 0x04034b50 || u16(local + 6) !== flags || u16(local + 8) !== method) throw bad();
    const nameSize = u16(local + 26), extraSize = u16(local + 28), nameStart = local + 30, start = nameStart + nameSize + extraSize;
    if (start + size > centralOffset || utf8.decode(data.subarray(nameStart, nameStart + nameSize)) !== name) throw bad();
    extraFields(nameStart + nameSize, extraSize);
    let stop = start + size;
    if (flags & 8) {
      if (stop + 12 > centralOffset) throw bad();
      if (u32(stop) === 0x08074b50) stop += 4;
      if (stop + 12 > centralOffset || u32(stop) !== entry.crc || u32(stop + 4) !== size || u32(stop + 8) !== expanded) throw bad();
      stop += 12;
      for (const [offset, expected] of [[14, entry.crc], [18, size], [22, expanded]]) if (u32(local + offset) && u32(local + offset) !== expected) throw bad();
    } else if (u32(local + 14) !== entry.crc || u32(local + 18) !== size || u32(local + 22) !== expanded) throw bad();
    return { start, end: stop };
  }
  const occupied = [...catalogue.values()].map(entry => ({ local: entry.local, ...validateLocal(entry) })).sort((a, b) => a.local - b.local);
  for (let i = 1; i < occupied.length; i++) if (occupied[i - 1].end > occupied[i].local) throw bad();
  const paths = [...catalogue.keys()].filter(name => /^ppt\/slides\/slide[1-9]\d*\.xml$/.test(name));
  if (!paths.length) throw new Error("No readable slides were found. Open a slide PDF or paste the current exercise instead.");
  if (paths.length > 300) throw tooLarge();
  let expandedTotal = 0;
  const cache = new Map<string, Document>();
  async function read(name: string, required = true): Promise<Document | null> {
    if (cache.has(name)) return cache.get(name)!;
    const entry = catalogue.get(name); if (!entry) { if (required) throw bad(); return null; }
    const { size, expanded, method } = entry;
    if (expanded > XML_LIMIT || size > 1_000_000 || expandedTotal + expanded > TOTAL_LIMIT) throw tooLarge();
    const { start } = validateLocal(entry);
    const compressed = data.subarray(start, start + size);
    const bytes = method === 8 ? await (options.inflateRaw || inflateBrowser)(compressed, Math.min(XML_LIMIT, TOTAL_LIMIT - expandedTotal)) : compressed;
    if (bytes.byteLength > XML_LIMIT || expandedTotal + bytes.byteLength > TOTAL_LIMIT) throw tooLarge();
    if (bytes.byteLength !== expanded || crc32(bytes) !== entry.crc) throw bad();
    expandedTotal += bytes.byteLength;
    const xml = utf8.decode(bytes);
    // No entity declarations, external references or recursive expansions are accepted.
    if (/<!DOCTYPE\b|<!ENTITY\b/i.test(xml)) throw bad();
    const parsed = options.parseXml ? options.parseXml(xml) : new DOMParser().parseFromString(xml, "application/xml");
    if (!parsed.documentElement || parsed.getElementsByTagName("parsererror").length) throw bad();
    cache.set(name, parsed); return parsed;
  }
  const elements = (doc: Document | Element, name: string) => Array.from(doc.getElementsByTagNameNS("*", name));
  function relationships(doc: Document) {
    const result = new Map<string, { target: string; type: string; external: boolean }>();
    for (const node of elements(doc, "Relationship")) {
      const id = node.getAttribute("Id"), target = node.getAttribute("Target"), type = node.getAttribute("Type") || "";
      if (!id || !target || result.has(id)) throw bad();
      result.set(id, { target, type, external: node.getAttribute("TargetMode") === "External" });
    }
    return result;
  }
  const presentation = (await read("ppt/presentation.xml"))!, relations = relationships((await read("ppt/_rels/presentation.xml.rels"))!);
  if (presentation.documentElement.localName !== "presentation") throw bad();
  const sequence: string[] = [];
  for (const node of elements(presentation, "sldId")) {
    const id = node.getAttributeNS("http://schemas.openxmlformats.org/officeDocument/2006/relationships", "id") || node.getAttributeNS("http://purl.oclc.org/ooxml/officeDocument/relationships", "id") || node.getAttribute("r:id");
    const relation = id && relations.get(id);
    if (!relation || relation.external || !/\/slide$/.test(relation.type) || !/^(?:\/ppt\/)?slides\/slide[1-9]\d*\.xml$/.test(relation.target)) throw bad();
    const path = relation.target.startsWith("/") ? relation.target.slice(1) : `ppt/${relation.target}`;
    if (!catalogue.has(path) || sequence.includes(path)) throw bad();
    sequence.push(path);
  }
  if (!sequence.length || sequence.length > 300) throw bad();
  const textOf = (doc: Document | Element) => elements(doc, "t").map(node => node.textContent || "").join("\n").slice(0, 12_000);
  const slides: LocalCoachSlide[] = [];
  for (const [index, path] of sequence.entries()) {
    const doc = (await read(path))!;
    if (doc.documentElement.localName !== "sld") throw bad();
    const slide: LocalCoachSlide = { number: index + 1, text: textOf(doc) };
    const relPath = path.replace("/slides/", "/slides/_rels/") + ".rels", relDoc = await read(relPath, false);
    if (relDoc) {
      const notes = [...relationships(relDoc).values()].filter(relation => /\/notesSlide$/.test(relation.type));
      if (notes.length > 1) throw bad();
      if (notes.length) {
        const relation = notes[0];
        if (relation.external || !/^(?:\.\.\/notesSlides\/|\/ppt\/notesSlides\/)notesSlide[1-9]\d*\.xml$/.test(relation.target)) throw bad();
        const notesPath = relation.target.startsWith("/") ? relation.target.slice(1) : `ppt/${relation.target.slice(3)}`;
        const notesDoc = (await read(notesPath))!;
        if (notesDoc.documentElement.localName !== "notes") throw bad();
        const shapes = elements(notesDoc, "sp").filter(shape => !elements(shape, "ph").some(node => node.getAttribute("type") === "sldNum"));
        const text = shapes.map(textOf).filter(Boolean).join("\n").slice(0, 12_000);
        if (text) slide.notes = text;
      }
    }
    slides.push(slide);
  }
  return slides;
}
