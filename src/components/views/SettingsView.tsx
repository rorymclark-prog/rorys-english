"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useStudent } from "@/components/StudentContext";
import AppearanceSettings from "@/components/AppearanceSettings";
import ProfileAvatar from "@/components/ProfileAvatar";
import {isStudentPreview} from "@/lib/student-preview";
import Screen from "@/components/Screen";
import { resetProgress } from "@/lib/storage";

export default function SettingsView() {
  const { studentId, code, displayName } = useStudent();
  const preview=isStudentPreview();
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);


  const doReset = () => {
    if(preview)return;
    resetProgress(studentId);
    setConfirming(false);
    router.refresh();
    // Reload so every screen re-reads cleared storage.
    if (typeof window !== "undefined") window.location.reload();
  };

  return (
    <Screen title="Settings" subtitle="Your account, appearance and device options.">
      <div className="settings-sections mt-2 space-y-6">
        <Row label="Signed in as">
          <span className="font-bold text-navy dark:text-cream">{displayName}</span>
        </Row>

        <div className="re-card"><p className="re-eyebrow">YOUR PROFILE</p><div className="mt-4"><ProfileAvatar code={code} name={displayName} editable={!preview}/></div><p className="re-small-copy mt-3">Your picture stays on this device. It is not sent to Rory or shown on another phone.</p></div>

        <AppearanceSettings/>

        <div className="re-card"><p className="re-eyebrow">MICROPHONE & CAMERA</p><p className="re-small-copy mt-2">Your device controls access. Choose Allow when you start a voice chat or scan a page.</p></div>

        <div className="pt-2">
          <p className="mb-2 text-xs font-bold uppercase tracking-wide text-navy-soft dark:text-navy-mist">This device’s saved answers</p>
          {!confirming ? (
            <button
              onClick={() => setConfirming(true)}
              disabled={preview}
              className="min-h-[48px] w-full rounded-xl bg-bad-soft px-4 font-bold text-bad transition active:scale-[.97] dark:bg-bad-dusk dark:text-bad-bright"
            >
              Reset my progress
            </button>
          ) : (
            <div className="rounded-card bg-surface p-4 shadow-card dark:bg-navy-raised dark:shadow-card-dark">
              <p className="mb-3 text-sm font-medium text-navy dark:text-cream">
                This clears all your ticks and written answers on this device. This can&apos;t be undone.
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => setConfirming(false)}
                  className="min-h-[48px] flex-1 rounded-xl bg-black/5 px-4 font-bold text-navy transition active:scale-[.97] dark:bg-white/10 dark:text-cream"
                >
                  Cancel
                </button>
                <button
                  onClick={doReset}
                  className="min-h-[48px] flex-1 rounded-xl bg-bad px-4 font-bold text-white transition active:scale-[.97] dark:bg-bad-bright dark:text-navy"
                >
                  Reset
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </Screen>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between rounded-card bg-surface p-4 shadow-card dark:bg-navy-raised dark:shadow-card-dark">
      <span className="text-sm font-medium text-navy-soft dark:text-navy-mist">{label}</span>
      {children}
    </div>
  );
}
