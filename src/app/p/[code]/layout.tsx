import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getAllParentCodes, getStudentByParentCode } from "@/lib/content";
import ServiceWorkerRegister from "@/components/ServiceWorkerRegister";
import ThemeInit from "@/components/ThemeInit";

// One static read-only parent page per parent code. Unknown code → 404.
export function generateStaticParams() {
  return getAllParentCodes().map((code) => ({ code }));
}

export const dynamicParams = false;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ code: string }>;
}): Promise<Metadata> {
  const { code } = await params;
  const student = getStudentByParentCode(code);
  return {
    title: student ? `${student.displayName} — Progress` : "Progress",
    robots: { index: false, follow: false },
  };
}

export default async function ParentLayout({
  params,
  children,
}: {
  params: Promise<{ code: string }>;
  children: React.ReactNode;
}) {
  const { code } = await params;
  if (!getStudentByParentCode(code)) notFound();
  return (
    <div className="mx-auto min-h-dvh max-w-md">
      <ThemeInit />
      {children}
      <ServiceWorkerRegister />
    </div>
  );
}
