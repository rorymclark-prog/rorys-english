// ─────────────────────────────────────────────────────────────────────────────
// CONTENT CONTRACT
// The tutor authors JSON that matches these shapes. Components are dumb and
// render whatever the JSON says — add a unit, a homework week, or a study tool
// by editing JSON, never by touching components.
// ─────────────────────────────────────────────────────────────────────────────

export type Profile = "standard";

/** A study tool is an external HTML page (built in Claude, hosted on Netlify). */
export interface StudyTool {
  title: string;
  url: string;
  /** Optional one-line description shown on the card. */
  blurb?: string;
}

export type HomeworkTaskType = "checkbox" | "written" | "voice";

export interface HomeworkTask {
  id: string;
  type: HomeworkTaskType;
  prompt: string;
  /** For `written` tasks: number of lined rows. Defaults to 3. */
  lines?: number;
}

export interface HomeworkWeek {
  week: number;
  title: string;
  /** Human-readable due label, e.g. "Mon 8 June". */
  due: string;
  tasks: HomeworkTask[];
}

/** Unit metadata as stored in students.json. */
export interface UnitMeta {
  id: string;
  title: string;
  active: boolean;
}

/** Full unit definition from <student>/units.json (adds study tools). */
export interface UnitDef extends UnitMeta {
  studyTools: StudyTool[];
  /** Model sentences for the record-and-compare speaking screen. */
  speakingLines?: string[];
}

/** A unit with its homework resolved at build time. */
export interface Unit extends UnitDef {
  homework: HomeworkWeek[];
}

export interface Student {
  id: string;
  displayName: string;
  /** The code in the private link (/s/<code>). This IS the key. */
  code: string;
  /** The code in the parent's read-only link (/p/<parentCode>). */
  parentCode?: string;
  profile: Profile;
  /** Warm greeting hook for the Today screen. */
  greeting?: string;
  /** Optional resource/dashboard links shown in the Progress section. */
  progressLinks?: StudyTool[];
  units: UnitMeta[];
}

/** Everything one student's app needs, resolved at build time. */
export interface StudentBundle {
  student: Student;
  units: Unit[];
  /** The active unit (first active, else first). Convenience for Today/Study. */
  activeUnit: Unit | null;
}
