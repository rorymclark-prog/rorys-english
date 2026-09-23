import type { Metadata } from "next";
import "./teacher.css";
import { SettingsProvider } from "@/components/SettingsContext";
import ServiceWorkerRegister from "@/components/ServiceWorkerRegister";
import TeacherDashboardView from "@/components/views/TeacherDashboardView";

export const metadata: Metadata = {
  title: "Teacher dashboard — Rory's English",
  manifest: `${process.env.NEXT_PUBLIC_BASE_PATH || ""}/m/teacher.webmanifest`,
  appleWebApp: { capable: true, statusBarStyle: "default", title: "Rory Teacher" },
  // Real access control is the server-side password check (Apps Script) —
  // this just keeps the URL out of search results.
  robots: { index: false, follow: false },
};

// Deliberately wider than the phone-locked student shell (max-w-md): this is
// the one screen a tutor is likely to actually open on a laptop or iPad.
export default function TeacherPage() {
  return (
    <div className="min-h-dvh re-teacher-shell">
      <SettingsProvider studentId="__teacher__"><TeacherDashboardView /></SettingsProvider>
      <ServiceWorkerRegister />
    </div>
  );
}
