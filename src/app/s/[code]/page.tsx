import { getBundle } from "@/lib/content";
import TodayView from "@/components/views/TodayView";

export default async function TodayPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const bundle = getBundle(code)!; // layout already 404s unknown codes
  return <TodayView unit={bundle.activeUnit} />;
}
