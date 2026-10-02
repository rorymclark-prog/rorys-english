import {workSources, type WorkSource} from '@/lib/work-source';

export default function WorkSourceSelect({value, onChange, disabled=false}: {value: WorkSource; onChange: (value: WorkSource) => void; disabled?: boolean}) {
  return <label className="block text-sm">Who set this work?
    <select className="mt-1 min-h-11 w-full rounded-lg border bg-transparent p-2" value={value} disabled={disabled} onChange={event=>onChange(event.target.value as WorkSource)}>
      {Object.entries(workSources).map(([key, label])=><option key={key} value={key}>{label}</option>)}
    </select>
  </label>;
}
