import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getAllParentCodes, getStudentByParentCode } from "@/lib/content";
import ParentLanguageProvider from "@/components/ParentLanguage";
import "../parent.css";
import ThemeInit from "@/components/ThemeInit";
import ParentPreviewBanner from "@/components/ParentPreviewBanner";
import SessionGate from "@/components/SessionGate";

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
  const student=getStudentByParentCode(code);
  if (!student) notFound();
  return (
    <div className="mx-auto min-h-dvh max-w-md md:max-w-2xl">
      <ThemeInit />
      <ParentLanguageProvider><SessionGate code={code}><ParentPreviewBanner code={code} name={student.displayName}/>{children}</SessionGate></ParentLanguageProvider>
    </div>
  );
}
