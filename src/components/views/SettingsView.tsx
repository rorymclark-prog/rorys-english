"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useStudent } from "@/components/StudentContext";
import { useSettings } from "@/components/SettingsContext";
import Screen from "@/components/Screen";
import { buildProgressSummary, resetProgress, type TextScale, type Theme } from "@/lib/storage";

const TEXT_SIZES: { value: TextScale; label: string }[] = [
  { value: "normal", label: "Normal" },
  { value: "large", label: "Large" },
  { value: "xl", label: "Extra large" },
];

const THEMES: { value: Theme; label: string }[] = [
  { value: "system", label: "Auto" },
  { value: "light", label: "Light" },
  { value: "dark", label: "Dark" },
];

export default function SettingsView() {
  const { studentId, displayName } = useStudent();
  const { settings, update } = useSettings();
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);

  const [shareNote, setShareNote] = useState<{ text: string; ok: boolean } | null>(null);

  const doReset = () => {
    resetProgress(studentId);
    setConfirming(false);
    router.refresh();
    // Reload so every screen re-reads cleared storage.
    if (typeof window !== "undefined") window.location.reload();
  };

  const shareProgress = async () => {
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
    <Screen title="Settings">
      <div className="mt-2 space-y-6">
        <Row label="Signed in as">
          <span className="font-bold text-navy dark:text-cream">{displayName}</span>
        </Row>

        <div>
          <p className="mb-2 text-xs font-bold uppercase tracking-wide text-navy-soft dark:text-navy-mist">Progress</p>
          <button
            onClick={shareProgress}
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

        <div>
          <p className="mb-2 text-xs font-bold uppercase tracking-wide text-navy-soft dark:text-navy-mist">Text size</p>
          <SegmentedControl
            options={TEXT_SIZES}
            value={settings.textScale}
            onChange={(v) => update({ textScale: v })}
          />
        </div>

        <div>
          <p className="mb-2 text-xs font-bold uppercase tracking-wide text-navy-soft dark:text-navy-mist">Appearance</p>
          <SegmentedControl
            options={THEMES}
            value={settings.theme}
            onChange={(v) => update({ theme: v })}
          />
        </div>

        <div className="pt-2">
          <p className="mb-2 text-xs font-bold uppercase tracking-wide text-navy-soft dark:text-navy-mist">Start fresh</p>
          {!confirming ? (
            <button
              onClick={() => setConfirming(true)}
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

function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <div className="flex gap-2">
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            onClick={() => onChange(o.value)}
            aria-pressed={active}
            className={`min-h-[48px] flex-1 rounded-xl px-2 text-sm font-bold transition active:scale-[.97] ${
              active
                ? "bg-amber-soft text-amber-deep dark:bg-amber-dusk dark:text-amber"
                : "bg-surface text-navy-soft shadow-card dark:bg-navy-raised dark:text-navy-mist dark:shadow-card-dark"
            }`}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
