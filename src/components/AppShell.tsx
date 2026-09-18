"use client";

import { StudentProvider, type StudentCtx } from "./StudentContext";
import { SettingsProvider } from "./SettingsContext";
import TabBar from "./TabBar";
import InstallHint from "./InstallHint";
import OfflineBanner from "./OfflineBanner";
import SessionGate from "./SessionGate";
import OutboxStatus from "./OutboxStatus";
import AppMenu from "./AppMenu";
import { isStudentPreview, endStudentPreview } from "@/lib/student-preview";

/** Wraps every student screen: providers + scrollable content + bottom tabs. */
export default function AppShell({ ctx, children }: { ctx: StudentCtx; children: React.ReactNode }) {
  const preview=isStudentPreview(ctx.code);
  return (
    <SessionGate code={ctx.code}><StudentProvider value={ctx}>
      <SettingsProvider studentId={preview?"__teacher__":ctx.studentId}>
        <OfflineBanner />
        {!preview&&<OutboxStatus code={ctx.code}/> }
        {/* max-w-md on phone; most of Rory's students (Ferdi incl.) are
            actually on iPad most of the time, so md:+ gets real breathing
            room instead of a phone-width column stranded on a big screen. */}
        <div className="mx-auto min-h-dvh max-w-md pb-[calc(6rem+env(safe-area-inset-bottom))] md:max-w-2xl">
          {preview&&<div className="preview-banner"><div><strong>Viewing as {ctx.displayName}</strong><p>Read-only preview · answers and progress stay unchanged.</p></div><button type="button" onClick={()=>{endStudentPreview();window.location.assign(`${process.env.NEXT_PUBLIC_BASE_PATH||""}/teacher/`);}}>Exit preview ↗</button></div>}
          <div className="flex items-center justify-between gap-3 px-5 py-3"><span className="text-xs font-bold tracking-wide text-navy-soft dark:text-navy-mist">RORY’S ENGLISH</span><AppMenu code={ctx.code}/></div>{children}</div>
        {!preview&&<InstallHint />}
        <TabBar />
      </SettingsProvider>
    </StudentProvider></SessionGate>
  );
}
