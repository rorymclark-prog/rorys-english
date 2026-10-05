import { getStudentByParentCode } from "@/lib/content";
import ProgressView from "@/components/views/ProgressView";

export default async function ParentProgressPage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = await params;
  const student = getStudentByParentCode(code)!; // layout 404s unknown codes
  return <><header className="px-5 pt-5"><p className="re-eyebrow">PARENT PORTAL</p><h1 className="mt-2 text-2xl font-bold">{student.displayName}’s learning</h1><p className="mt-2 text-sm">Lesson recaps, work and feedback. Detailed lesson assessments appear after Rory reviews them.</p></header><a className="ux-link-row p-5" href={`/p/${code}/calendar/`}>Open lesson calendar →</a><ProgressView fetchCode={code} displayName={student.displayName} mode="parent" /></>;
}
