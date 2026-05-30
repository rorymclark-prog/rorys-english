import SettingsView from "@/components/views/SettingsView";

export default function SettingsPage() {
  // All settings live in context + localStorage; no per-page data needed.
  return <SettingsView />;
}
