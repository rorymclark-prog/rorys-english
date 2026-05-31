import { getStudentByParentCode } from "@/lib/content";
import ProgressView from "@/components/views/ProgressView";

export default async function ParentProgressPage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = await params;
  const student = getStudentByParentCode(code)!; // layout 404s unknown codes
  return <ProgressView fetchCode={code} displayName={student.displayName} mode="parent" />;
}
