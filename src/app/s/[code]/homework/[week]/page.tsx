import { notFound } from "next/navigation";
import { getBundle, getHomeworkParams } from "@/lib/content";
import HomeworkWeekView from "@/components/views/HomeworkWeekView";

export function generateStaticParams({ params }: { params: { code: string } }) {
  return getHomeworkParams(params.code);
}

export const dynamicParams = false;

export default async function HomeworkWeekPage({
  params,
}: {
  params: Promise<{ code: string; week: string }>;
}) {
  const { code, week } = await params;
  const bundle = getBundle(code)!;
  const unit = bundle.activeUnit;
  const hw = unit?.homework.find((h) => String(h.week) === week);
  if (!unit || !hw) notFound();

  return <HomeworkWeekView unitId={unit.id} week={hw} backHref={`/s/${code}/homework/`} />;
}
