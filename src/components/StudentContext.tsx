"use client";

import { createContext, useContext } from "react";

export interface StudentCtx {
  code: string;
  studentId: string;
  displayName: string;
  greeting?: string;
}

const Ctx = createContext<StudentCtx | null>(null);

export function StudentProvider({ value, children }: { value: StudentCtx; children: React.ReactNode }) {
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useStudent(): StudentCtx {
  const v = useContext(Ctx);
  if (!v) throw new Error("useStudent must be used inside <StudentProvider>");
  return v;
}
