"use client";
import { useSettings } from "./SettingsContext";
import type { TextScale, Theme, Palette } from "@/lib/storage";
export default function AppearanceSettings() {
  const { settings, update } = useSettings();
  return <div className="space-y-6">
    <fieldset><legend className="mb-3 font-bold">Colour palette</legend><div className="grid grid-cols-3 gap-3">{([{value:"blue",label:"Paper & blue",colours:["#f7f6f2","#3656aa","#f3bf85"]},{value:"indigo",label:"Quiet indigo",colours:["#f7f6f2","#4d4a9c","#c2bdfa"]},{value:"clay",label:"Warm clay",colours:["#f7f6f2","#90452f","#f4b59a"]}] as {value:Palette;label:string;colours:string[]}[]).map(item=><button key={item.value} type="button" className="re-palette-option" aria-pressed={(settings.palette||"blue")===item.value} onClick={()=>update({palette:item.value})}><span aria-hidden="true">{item.colours.map(c=><i key={c} style={{background:c}}/>)}</span>{item.label}</button>)}</div></fieldset>
    <fieldset><legend className="mb-3 font-bold">Appearance</legend><div className="grid grid-cols-3 gap-2">
      {([{value:"light",label:"Light",icon:"☀"},{value:"dark",label:"Dark",icon:"☾"},{value:"system",label:"System",icon:"◐"}] as {value:Theme;label:string;icon:string}[]).map(item=><button type="button" key={item.value} aria-pressed={settings.theme===item.value} onClick={()=>update({theme:item.value})} className={`appearance-option ${settings.theme===item.value?"is-selected":""}`}><span aria-hidden="true" className="text-2xl">{item.icon}</span>{item.label}</button>)}
    </div><p className="mt-2 text-xs text-navy-soft dark:text-navy-mist">System follows your device’s light or dark setting.</p></fieldset>
    <fieldset><legend className="mb-3 font-bold">Text size</legend><div className="grid grid-cols-3 gap-2">
      {([{value:"normal",label:"Normal"},{value:"large",label:"Large"},{value:"xl",label:"Extra large"}] as {value:TextScale;label:string}[]).map((item,index)=><button type="button" key={item.value} aria-pressed={settings.textScale===item.value} onClick={()=>update({textScale:item.value})} className={`appearance-option ${settings.textScale===item.value?"is-selected":""}`}><span aria-hidden="true" style={{fontSize:`${1.1+index*.25}rem`}}>Aa</span>{item.label}</button>)}
    </div></fieldset>
    <p className="rounded-xl bg-black/5 p-4 text-sm dark:bg-white/5">A little practice, at your pace. Your choice is saved on this device.</p>
  </div>;
}
