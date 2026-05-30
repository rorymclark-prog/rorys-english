"use client";

// Client-side calendar export. Turns a homework week's human due label
// (e.g. "Mon 8 June") into a downloadable .ics all-day event with a reminder,
// so a student can add the deadline to their phone calendar. No backend.

const MONTHS: Record<string, number> = {
  jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5,
  jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11,
};

/** Parse a label like "Mon 8 June" / "Tue 16 Jun" into a Date (this year, or
 *  next year if the day has already passed). Returns null if unparseable. */
export function parseDueDate(due: string, now = new Date()): Date | null {
  const m = due.match(/(\d{1,2})\s+([A-Za-z]{3,})/);
  if (!m) return null;
  const day = parseInt(m[1], 10);
  const mon = MONTHS[m[2].slice(0, 3).toLowerCase()];
  if (mon === undefined || day < 1 || day > 31) return null;
  let year = now.getFullYear();
  let d = new Date(year, mon, day);
  // If it's already well past, assume next year.
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  if (d.getTime() < today.getTime() - 1000 * 60 * 60 * 24) {
    year += 1;
    d = new Date(year, mon, day);
  }
  return d;
}

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

function icsDate(d: Date): string {
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}`;
}

function icsStamp(d: Date): string {
  return `${icsDate(d)}T${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
}

export function buildHomeworkIcs(summary: string, due: Date, uidSeed: string): string {
  const start = icsDate(due);
  const end = icsDate(new Date(due.getFullYear(), due.getMonth(), due.getDate() + 1));
  const stamp = icsStamp(new Date());
  const uid = `${uidSeed}-${stamp}@rorys-english`;
  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Rory's English//Homework//EN",
    "CALSCALE:GREGORIAN",
    "BEGIN:VEVENT",
    `UID:${uid}`,
    `DTSTAMP:${stamp}`,
    `DTSTART;VALUE=DATE:${start}`,
    `DTEND;VALUE=DATE:${end}`,
    `SUMMARY:${summary}`,
    "BEGIN:VALARM",
    "TRIGGER:-P1D",
    "ACTION:DISPLAY",
    "DESCRIPTION:Homework due tomorrow",
    "END:VALARM",
    "END:VEVENT",
    "END:VCALENDAR",
  ].join("\r\n");
}

export function downloadIcs(filename: string, content: string): void {
  const blob = new Blob([content], { type: "text/calendar;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}
