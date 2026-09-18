"use client";
import { useSettings } from "./SettingsContext";
import type { TextScale, Theme } from "@/lib/storage";
export default function AppearanceSettings() {
  const { settings, update } = useSettings();
  return <div className="space-y-6">
    <fieldset><legend className="mb-3 font-bold">Appearance</legend><div className="grid grid-cols-3 gap-2">
      {([{value:"light",label:"Light",icon:"☀"},{value:"dark",label:"Dark",icon:"☾"},{value:"system",label:"System",icon:"◐"}] as {value:Theme;label:string;icon:string}[]).map(item=><button type="button" key={item.value} aria-pressed={settings.theme===item.value} onClick={()=>update({theme:item.value})} className={`appearance-option ${settings.theme===item.value?"is-selected":""}`}><span aria-hidden="true" className="text-2xl">{item.icon}</span>{item.label}</button>)}
    </div><p className="mt-2 text-xs text-navy-soft dark:text-navy-mist">System follows your device’s light or dark setting.</p></fieldset>
    <fieldset><legend className="mb-3 font-bold">Text size</legend><div className="grid grid-cols-3 gap-2">
      {([{value:"normal",label:"Normal"},{value:"large",label:"Large"},{value:"xl",label:"Extra large"}] as {value:TextScale;label:string}[]).map((item,index)=><button type="button" key={item.value} aria-pressed={settings.textScale===item.value} onClick={()=>update({textScale:item.value})} className={`appearance-option ${settings.textScale===item.value?"is-selected":""}`}><span aria-hidden="true" style={{fontSize:`${1.1+index*.25}rem`}}>Aa</span>{item.label}</button>)}
    </div></fieldset>
    <p className="rounded-xl bg-black/5 p-4 text-sm dark:bg-white/5">A little practice, at your pace. Your choice is saved on this device.</p>
  </div>;
}
