"use client";

import { StudentProvider, type StudentCtx } from "./StudentContext";
import { SettingsProvider } from "./SettingsContext";
import TabBar from "./TabBar";
import InstallHint from "./InstallHint";

/** Wraps every student screen: providers + scrollable content + bottom tabs. */
export default function AppShell({ ctx, children }: { ctx: StudentCtx; children: React.ReactNode }) {
  return (
    <StudentProvider value={ctx}>
      <SettingsProvider studentId={ctx.studentId}>
        <div className="mx-auto min-h-dvh max-w-md pb-28">{children}</div>
        <InstallHint />
        <TabBar />
      </SettingsProvider>
    </StudentProvider>
  );
}
