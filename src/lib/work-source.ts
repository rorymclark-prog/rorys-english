export const workSources = {
  school: 'School homework',
  tutor: 'Rory’s homework',
  practice: 'Independent practice',
  unspecified: 'Source not specified',
} as const;
export type WorkSource = keyof typeof workSources;
const markers: Record<Exclude<WorkSource, 'unspecified'>, string> = {
  school: '[Work source: School homework — set by the school]',
  tutor: '[Work source: Rory’s homework — set by Rory]',
  practice: '[Work source: Independent practice — chosen by the learner]',
};

// Use the existing private task-context field so source labels travel with
// saved work and reach analysis without migrating or reclassifying old records.
export function readWorkContext(context: string): {source: WorkSource; task: string} {
  for (const [source, marker] of Object.entries(markers)) {
    if (context === marker || context.startsWith(marker + '\n')) {
      return {source: source as WorkSource, task: context.slice(marker.length).replace(/^\n/, '')};
    }
  }
  return {source: 'unspecified', task: context};
}
export function workContext(source: WorkSource, task: string): string {
  const text = readWorkContext(task).task;
  const prefix = source === 'unspecified' ? '' : markers[source] + '\n';
  return prefix + text.slice(0, 2000 - prefix.length);
}
