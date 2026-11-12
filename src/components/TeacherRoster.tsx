"use client";
import { createContext, useContext } from "react";

/** What the teacher workspace needs to know about every student, and no more.
 *  Handed down by the /teacher routes (never imported from content/students.json
 *  by client code, which would put the whole roster in public JavaScript). */
export interface TeacherRosterEntry { code: string; parentCode: string; name: string; }

const Ctx = createContext<TeacherRosterEntry[]>([]);

export function TeacherRosterProvider({ roster, children }: { roster: TeacherRosterEntry[]; children: React.ReactNode }) {
  return <Ctx.Provider value={roster}>{children}</Ctx.Provider>;
}

export function useTeacherRoster(): TeacherRosterEntry[] {
  return useContext(Ctx);
}
