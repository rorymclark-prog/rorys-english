import { getBundle } from "@/lib/content";
import StudyView from "@/components/views/StudyView";

export default async function StudyPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const bundle = getBundle(code)!;
  return <StudyView unit={bundle.activeUnit} />;
}
