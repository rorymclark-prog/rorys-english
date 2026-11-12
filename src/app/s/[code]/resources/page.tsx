import { getBundle } from "@/lib/content";
import ResourcesView from "@/components/views/ResourcesView";

export default async function ResourcesPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const bundle = getBundle(code)!; // 404 handled by the [code] layout
  const lessonResources=bundle.units.flatMap(unit=>(unit.resources||[]).map(r=>({...r,unit:unit.title,schoolYear:unit.schoolYear||"Previous year"})));
  return (
    <>
      <ResourcesView fetchCode={code} mode="student" lessonResources={lessonResources} />
    </>
  );
}
