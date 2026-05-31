import { getBundle } from "@/lib/content";
import ProgressView from "@/components/views/ProgressView";

export default async function ProgressPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const bundle = getBundle(code)!;
  return (
    <ProgressView
      fetchCode={code}
      studentCode={code}
      displayName={bundle.student.displayName}
      mode="student"
      links={bundle.student.progressLinks ?? []}
    />
  );
}
