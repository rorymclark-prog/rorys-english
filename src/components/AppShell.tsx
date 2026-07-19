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
        {/* max-w-md on phone; most of Rory's students (Ferdi incl.) are
            actually on iPad most of the time, so md:+ gets real breathing
            room instead of a phone-width column stranded on a big screen. */}
        <div className="mx-auto min-h-dvh max-w-md pb-[calc(6rem+env(safe-area-inset-bottom))] md:max-w-2xl">{children}</div>
        <InstallHint />
        <TabBar />
      </SettingsProvider>
    </StudentProvider>
  );
}
