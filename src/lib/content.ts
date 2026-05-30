// ─────────────────────────────────────────────────────────────────────────────
// CONTENT LOADER (build-time, server-only)
//
// Reads /content from disk during static generation. Adding a unit, homework
// week, or study tool is a pure JSON edit — this loader picks it up with no code
// changes (acceptance checks §9). Uses `fs`, so only import from Server
// Components / generateStaticParams; hand the plain data to client components.
// ─────────────────────────────────────────────────────────────────────────────

import fs from "node:fs";
import path from "node:path";
import type { Student, StudentBundle, Unit, UnitDef, HomeworkWeek } from "./types";

const CONTENT_DIR = path.join(process.cwd(), "content");

function readJson<T>(filePath: string): T {
  return JSON.parse(fs.readFileSync(filePath, "utf-8")) as T;
}

function fileExists(p: string): boolean {
  return fs.existsSync(p);
}

export function getAllStudents(): Student[] {
  return readJson<Student[]>(path.join(CONTENT_DIR, "students.json"));
}

export function getStudentByCode(code: string): Student | undefined {
  return getAllStudents().find((s) => s.code === code);
}

export function getAllCodes(): string[] {
  return getAllStudents().map((s) => s.code);
}

function loadUnit(studentId: string, unitId: string): Unit | null {
  const unitsPath = path.join(CONTENT_DIR, studentId, "units.json");
  if (!fileExists(unitsPath)) return null;
  const defs = readJson<UnitDef[]>(unitsPath);
  const def = defs.find((u) => u.id === unitId);
  if (!def) return null;

  const hwPath = path.join(CONTENT_DIR, studentId, unitId, "homework.json");
  const homework: HomeworkWeek[] = fileExists(hwPath) ? readJson<HomeworkWeek[]>(hwPath) : [];
  homework.sort((a, b) => a.week - b.week);

  return { ...def, studyTools: def.studyTools ?? [], homework };
}

/** Resolve the full bundle for a student code, or null if the code is unknown. */
export function getBundle(code: string): StudentBundle | null {
  const student = getStudentByCode(code);
  if (!student) return null;

  const units = student.units
    .map((u) => loadUnit(student.id, u.id))
    .filter((u): u is Unit => u !== null);

  const activeUnit = units.find((u) => u.active) ?? units[0] ?? null;
  return { student, units, activeUnit };
}

/** Params for /s/[code]/homework/[week] — one entry per (code, active-unit week). */
export function getHomeworkParams(code: string): { week: string }[] {
  const bundle = getBundle(code);
  if (!bundle?.activeUnit) return [];
  return bundle.activeUnit.homework.map((h) => ({ week: String(h.week) }));
}
