"use client";

// Client-side calendar export. Turns an explicit ISO deadline
// into a downloadable .ics all-day event with a reminder,
// so a student can add the deadline to their phone calendar. No backend.

/** Dates must include a year. Never roll overdue work into the next year. */
export function parseDueDate(due: string): Date | null {
  const m = due.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return null;
  const year=Number(m[1]), mon=Number(m[2])-1, day=Number(m[3]);
  const d=new Date(year,mon,day);
  return d.getFullYear()===year && d.getMonth()===mon && d.getDate()===day ? d : null;
}

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

function icsDate(d: Date): string {
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}`;
}

function icsStamp(d: Date): string {
  // RFC 5545 requires DTSTAMP in UTC (trailing Z) — Outlook is strict about this.
  return (
    `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}` +
    `T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}Z`
  );
}

export function buildHomeworkIcs(summary: string, due: Date, uidSeed: string): string {
  const start = icsDate(due);
  const end = icsDate(new Date(due.getFullYear(), due.getMonth(), due.getDate() + 1));
  const stamp = icsStamp(new Date());
  const uid = `${uidSeed.replace(/[^a-zA-Z0-9_-]/g, "")}@rorys-english`;
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
    `SUMMARY:${summary.replace(/\\/g,"\\\\").replace(/\r?\n/g,"\\n").replace(/[,;]/g,"\\$&")}`,
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
