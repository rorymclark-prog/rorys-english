"use client";

import { StudentProvider, type StudentCtx } from "./StudentContext";
import { SettingsProvider } from "./SettingsContext";
import TabBar from "./TabBar";
import InstallHint from "./InstallHint";
import OfflineBanner from "./OfflineBanner";
import SessionGate from "./SessionGate";
import OutboxStatus from "./OutboxStatus";
import AppMenu from "./AppMenu";
import StudentNavigation from "./StudentNavigation";
import QuickAppearance from "./QuickAppearance";
import ProfileAvatar from "./ProfileAvatar";
import { isStudentPreview, endStudentPreview } from "@/lib/student-preview";

/** Wraps every student screen: providers + scrollable content + bottom tabs. */
export default function AppShell({ ctx, children }: { ctx: StudentCtx; children: React.ReactNode }) {
  const preview=isStudentPreview(ctx.code);
  return (
    <SessionGate code={ctx.code}><StudentProvider value={ctx}>
      <SettingsProvider studentId={preview?"__teacher__":ctx.studentId}>
        <OfflineBanner />
        {!preview&&<OutboxStatus code={ctx.code}/> }
        <a href="#student-content" className="re-skip-link">Skip to content</a>
        <div className="re-shell"><StudentNavigation/><div id="student-content" className="re-shell-content" tabIndex={-1}>
          {preview&&<div className="preview-banner"><div><strong>Viewing as {ctx.displayName}</strong><p>Read-only preview · answers and progress stay unchanged.</p></div><button type="button" onClick={()=>{endStudentPreview();window.location.assign(`${process.env.NEXT_PUBLIC_BASE_PATH||""}/teacher/`);}}>Exit preview ↗</button></div>}
          <div className="re-topbar"><div className="re-mobile-brand"><span className="re-logo">r.</span><strong>Rory’s English</strong></div><span className="re-desktop-label">{ctx.displayName}’s learning space</span><div className="flex items-center gap-3"><ProfileAvatar code={ctx.code} name={ctx.displayName} className="re-topbar-profile"/><QuickAppearance/><AppMenu code={ctx.code}/></div></div><div className="re-page-content">{children}</div></div></div>
        {!preview&&<InstallHint />}
        <TabBar />
      </SettingsProvider>
    </StudentProvider></SessionGate>
  );
}
