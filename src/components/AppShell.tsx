"use client";

import { StudentProvider, type StudentCtx } from "./StudentContext";
import { SettingsProvider } from "./SettingsContext";
import TabBar from "./TabBar";
import InstallHint from "./InstallHint";
import OfflineBanner from "./OfflineBanner";

/** Wraps every student screen: providers + scrollable content + bottom tabs. */
export default function AppShell({ ctx, children }: { ctx: StudentCtx; children: React.ReactNode }) {
  return (
    <StudentProvider value={ctx}>
      <SettingsProvider studentId={ctx.studentId}>
        <OfflineBanner />
        <div className="mx-auto min-h-dvh max-w-md pb-[calc(6rem+env(safe-area-inset-bottom))]">{children}</div>
        <InstallHint />
        <TabBar />
      </SettingsProvider>
    </StudentProvider>
  );
}
