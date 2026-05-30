import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getAllCodes, getStudentByCode } from "@/lib/content";
import AppShell from "@/components/AppShell";

// Pre-render one static app per student code. An unknown code → 404, which is
// exactly the per-student isolation we want (the URL code is the key).
export function generateStaticParams() {
  return getAllCodes().map((code) => ({ code }));
}

export const dynamicParams = false;

// Point each student's pages at their own manifest so "Add to Home Screen"
// installs an app that launches straight into their content (full-screen).
export async function generateMetadata({
  params,
}: {
  params: Promise<{ code: string }>;
}): Promise<Metadata> {
  const { code } = await params;
  const student = getStudentByCode(code);
  const title = student ? `${student.displayName} · Rory's English` : "Rory's English";
  const base = process.env.NEXT_PUBLIC_BASE_PATH || "";
  return {
    title,
    manifest: `${base}/m/${code}.webmanifest`,
    // Installed iOS home-screen app shows the student's own name.
    appleWebApp: { capable: true, statusBarStyle: "default", title },
  };
}

export default async function StudentLayout({
  params,
  children,
}: {
  params: Promise<{ code: string }>;
  children: React.ReactNode;
}) {
  const { code } = await params;
  const student = getStudentByCode(code);
  if (!student) notFound();

  return (
    <AppShell
      ctx={{
        code: student.code,
        studentId: student.id,
        displayName: student.displayName,
        greeting: student.greeting,
      }}
    >
      {children}
    </AppShell>
  );
}
