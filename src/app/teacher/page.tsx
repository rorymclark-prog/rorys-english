import type { Metadata } from "next";
import ThemeInit from "@/components/ThemeInit";
import ServiceWorkerRegister from "@/components/ServiceWorkerRegister";
import TeacherDashboardView from "@/components/views/TeacherDashboardView";

export const metadata: Metadata = {
  title: "Teacher dashboard — Rory's English",
  // Real access control is the server-side password check (Apps Script) —
  // this just keeps the URL out of search results.
  robots: { index: false, follow: false },
};

// Deliberately wider than the phone-locked student shell (max-w-md): this is
// the one screen a tutor is likely to actually open on a laptop or iPad.
export default function TeacherPage() {
  return (
    <div className="mx-auto min-h-dvh max-w-3xl">
      <ThemeInit />
      <TeacherDashboardView />
      <ServiceWorkerRegister />
    </div>
  );
}
