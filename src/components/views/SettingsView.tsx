"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useStudent } from "@/components/StudentContext";
import AppearanceSettings from "@/components/AppearanceSettings";
import {isStudentPreview} from "@/lib/student-preview";
import Screen from "@/components/Screen";
import { buildProgressSummary, resetProgress } from "@/lib/storage";

export default function SettingsView() {
  const { studentId, displayName } = useStudent();
  const preview=isStudentPreview();
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);

  const [shareNote, setShareNote] = useState<{ text: string; ok: boolean } | null>(null);

  const doReset = () => {
    if(preview)return;
    resetProgress(studentId);
    setConfirming(false);
    router.refresh();
    // Reload so every screen re-reads cleared storage.
    if (typeof window !== "undefined") window.location.reload();
  };

  const shareProgress = async () => {
    if(preview)return;
    const text = buildProgressSummary(studentId, displayName);
    try {
      if (navigator.share) {
        // Native share sheet — student picks WhatsApp (or anything). No backend,
        // nothing leaves the device unless the student chooses to send it.
        await navigator.share({ title: "My progress", text });
        return;
      }
      await navigator.clipboard.writeText(text);
      setShareNote({ text: "Copied! Paste it to Rory on WhatsApp.", ok: true });
    } catch {
      setShareNote({ text: "Couldn't open share — copy your progress manually.", ok: false });
    }
  };

  return (
    <Screen title="Settings" subtitle="Your account, appearance and device options.">
      <div className="settings-sections mt-2 space-y-6">
        <Row label="Signed in as">
          <span className="font-bold text-navy dark:text-cream">{displayName}</span>
        </Row>

        <div>
          <p className="mb-2 text-xs font-bold uppercase tracking-wide text-navy-soft dark:text-navy-mist">Share your progress</p>
          <button
            onClick={shareProgress}
            disabled={preview}
            className="flex min-h-[48px] w-full items-center justify-center gap-2 rounded-xl bg-[linear-gradient(135deg,#4F46E5,#4338CA)] px-4 font-bold text-white shadow-[0_1px_2px_rgba(0,0,0,.06),0_4px_12px_-4px_#4F46E5] transition active:scale-[.97] dark:bg-none dark:bg-amber dark:text-navy dark:shadow-none"
          >
            Send my progress to Rory
          </button>
          {shareNote && (
            <p
              className={`mt-2 text-center text-sm ${
                shareNote.ok ? "text-good dark:text-good-bright" : "text-bad dark:text-bad-bright"
              }`}
            >
              {shareNote.text}
            </p>
          )}
        </div>

        <AppearanceSettings/>

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
