import type { Metadata } from "next";
import { getAllStudents, getBundle } from "@/lib/content";
import { SettingsProvider } from "@/components/SettingsContext";
import TeacherDashboardView from "@/components/views/TeacherDashboardView";
import { themeScript } from "@/lib/appearance";
import "../teacher.css";
export const metadata: Metadata = { title: "Live teaching — Rory’s English", robots: { index: false, follow: false } };
export default function LiveTeachingPage() {
  return <div className="min-h-dvh re-teacher-shell"><script dangerouslySetInnerHTML={{ __html: themeScript("__teacher__") }}/><SettingsProvider studentId="__teacher__"><TeacherDashboardView initialLive activeUnits={Object.fromEntries(getAllStudents().map(s => [s.code, getBundle(s.code)?.activeUnit || null]))}/></SettingsProvider></div>;
}
