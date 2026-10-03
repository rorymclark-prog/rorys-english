import { getStudentByParentCode } from "@/lib/content";
import ProgressView from "@/components/views/ProgressView";

export default async function ParentProgressPage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = await params;
  const student = getStudentByParentCode(code)!; // layout 404s unknown codes
  return <><a className="ux-link-row p-5" href={`/p/${code}/calendar/`}>Open lesson calendar →</a><ProgressView fetchCode={code} displayName={student.displayName} mode="parent" /></>;
}
