import { getStudentByParentCode } from "@/lib/content";
import ParentDashboardView from "@/components/views/ParentDashboardView";

export default async function ParentProgressPage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = await params;
  const student = getStudentByParentCode(code)!; // layout 404s unknown codes
  return <ParentDashboardView code={code} name={student.displayName}/>;
}
