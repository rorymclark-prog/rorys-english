import { getBundle } from "@/lib/content";
import SpeakView from "@/components/views/SpeakView";
export default async function SpeakPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const unit = getBundle(code)?.activeUnit;
  return <SpeakView lines={unit?.speakingLines ?? []} unitTitle={unit?.title} />;
}
