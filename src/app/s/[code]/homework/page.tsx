import { getBundle } from "@/lib/content";
import HomeworkListView from "@/components/views/HomeworkListView";

export default async function HomeworkPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const bundle = getBundle(code)!;
  return <HomeworkListView unit={bundle.activeUnit} />;
}
