import type {CSSProperties} from 'react';
/** The centre always names the quantity. Null is unassessed, never 0%. */
export default function ProgressRing({value,label,detail,size='normal'}:{value:number|null;label:string;detail:string;size?:'normal'|'small'}){
 const percent=value===null?null:Math.max(0,Math.min(100,value));
 return <div className={`progress-ring-group ${size}`}><div className={`progress-ring${percent===null?' unassessed':''}`} style={{'--ring-value':`${percent??0}%`} as CSSProperties} role="img" aria-label={`${label}: ${percent===null?'not assessed':`${Math.round(percent)}%`}. ${detail}`}><span><strong>{percent===null?'—':`${Math.round(percent)}%`}</strong><small>{percent===null?'Not assessed':label}</small></span></div><p>{detail}</p></div>;
}
