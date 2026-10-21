import { inflateRawSync } from "node:zlib";
export type CoachSlide = { number: number; text: string };

// Read only slide XML, never execute or publish an uploaded presentation.
// Both the compressed input and each inflated entry have explicit limits.
export function readCoachPptx(data: Buffer): CoachSlide[] {
  if (data.length < 22 || data.length > 3_000_000) throw new Error("Choose a PowerPoint smaller than 3 MB, or paste the current slide text.");
  let end = -1;
  for (let i = data.length - 22; i >= Math.max(0, data.length - 65557); i--) {
    if (data.readUInt32LE(i) === 0x06054b50) { end = i; break; }
  }
  if (end < 0) throw new Error("This file is not a supported .pptx presentation.");
  const count = data.readUInt16LE(end + 10), offset = data.readUInt32LE(end + 16);
  if (count > 5000 || offset > end) throw new Error("This presentation is too large.");
  let cursor = offset;
  const catalogue = new Map<string, {flags:number;method:number;size:number;uncompressed:number;local:number}>();
  let total = 0;
  for (let i = 0; i < count; i++) {
    if (cursor + 46 > end || data.readUInt32LE(cursor) !== 0x02014b50) throw new Error("The presentation could not be read.");
    const flags = data.readUInt16LE(cursor + 8), method = data.readUInt16LE(cursor + 10);
    const size = data.readUInt32LE(cursor + 20), uncompressed = data.readUInt32LE(cursor + 24);
    const nameSize = data.readUInt16LE(cursor + 28), extraSize = data.readUInt16LE(cursor + 30), commentSize = data.readUInt16LE(cursor + 32);
    const local = data.readUInt32LE(cursor + 42), nameEnd = cursor + 46 + nameSize;
    if (nameEnd > end) throw new Error("The presentation could not be read.");
    const name = data.subarray(cursor + 46, nameEnd).toString("utf8");
    cursor = nameEnd + extraSize + commentSize;
    if (/^ppt\/slides\/slide\d+\.xml$/.test(name) || name === "ppt/presentation.xml" || name === "ppt/_rels/presentation.xml.rels") catalogue.set(name, {flags,method,size,uncompressed,local});
  }
  function read(name: string): string {
    const entry = catalogue.get(name); if (!entry) return "";
    const {flags,method,size,uncompressed,local} = entry;
    if ((flags & 1) || ![0, 8].includes(method) || uncompressed > 500000 || (method === 0 && size > 500000)) throw new Error("This slide is too large or encrypted.");
    if (local + 30 > data.length || data.readUInt32LE(local) !== 0x04034b50) throw new Error("The presentation could not be read.");
    const start = local + 30 + data.readUInt16LE(local + 26) + data.readUInt16LE(local + 28);
    if (start + size > data.length || total + uncompressed > 3000000) throw new Error("This presentation is too large.");
    const bytes = data.subarray(start, start + size);
    const xml = (method === 8 ? inflateRawSync(bytes, { maxOutputLength: 500000 }) : bytes).toString("utf8");
    total += Buffer.byteLength(xml);
    if (total > 3000000) throw new Error("This presentation is too large.");
    return xml;
  }
  const paths = [...catalogue.keys()].filter(name => /^ppt\/slides\/slide\d+\.xml$/.test(name)).sort((a,b) => Number(a.match(/slide(\d+)/)![1])-Number(b.match(/slide(\d+)/)![1]));
  if (paths.length > 200) throw new Error("Use a presentation with no more than 200 slides.");
  const presentation = read("ppt/presentation.xml"), relationships = read("ppt/_rels/presentation.xml.rels");
  const relations = new Map<string,string>();
  for (const match of relationships.matchAll(/<Relationship\s[^>]*\/?[>]/g)) {
    const id = /\bId="([^"]+)"/.exec(match[0])?.[1], target = /\bTarget="([^"]+)"/.exec(match[0])?.[1];
    if (id && target && /^(?:\/ppt\/)?slides\/slide\d+\.xml$/.test(target)) relations.set(id, target.startsWith("/") ? target.slice(1) : `ppt/${target}`);
  }
  const ordered = [...presentation.matchAll(/<p:sldId\s[^>]*\br:id="([^"]+)"/g)].map(m => relations.get(m[1])).filter((name): name is string => !!name && catalogue.has(name));
  const sequence = ordered.length === paths.length ? ordered : paths;
  const slides: CoachSlide[] = [];
  for (const [index, name] of sequence.entries()) {
    const xml = read(name);
    const text = [...xml.matchAll(/<a:t(?:\s[^>]*)?>([\s\S]*?)<\/a:t>/g)].map(m => m[1]
      .replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, "&")
      .replace(/&#(\d+);/g, (_, n) => { const cp = Number(n); return cp > 0 && cp <= 0x10ffff ? String.fromCodePoint(cp) : ""; })).join("\n").slice(0, 12000);
    slides.push({ number: index + 1, text });
  }
  if (!slides.length) throw new Error("No readable slide text was found. Paste the current exercise instead.");
  return slides;
}
