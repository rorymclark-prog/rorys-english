import { getBundle } from "@/lib/content";
import SpeakView from "@/components/views/SpeakView";
export default async function SpeakPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  return <SpeakView lines={getBundle(code)?.activeUnit?.speakingLines ?? []} />;
}
