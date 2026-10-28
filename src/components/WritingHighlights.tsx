const tokens=(s:string)=>s.match(/\s+|[^\s]+/g)||[];
export function changed(before:string,after:string){
  const a=tokens(before),b=tokens(after);
  // Keep a sentence comparison bounded even if someone pastes a whole essay into a row.
  if(a.length*b.length>40000)return {old:a.map(t=>!/^\s+$/.test(t)),new:b.map(t=>!/^\s+$/.test(t))};
  const d=Array.from({length:a.length+1},()=>new Uint16Array(b.length+1));
  for(let i=a.length-1;i>=0;i--)for(let j=b.length-1;j>=0;j--)d[i][j]=a[i]===b[j]?d[i+1][j+1]+1:Math.max(d[i+1][j],d[i][j+1]);
  const old=a.map(t=>!/^\s+$/.test(t)),fresh=b.map(t=>!/^\s+$/.test(t));
  let i=0,j=0;
  while(i<a.length&&j<b.length){if(a[i]===b[j]){old[i]=false;fresh[j]=false;i++;j++;}else if(d[i+1][j]>=d[i][j+1])i++;else j++;}
  return {old,new:fresh};
}
export function Highlight({text,mask,mark}:{text:string;mask:boolean[];mark:string}){return <span className="whitespace-pre-wrap">{tokens(text).map((t,i)=>mask[i]?<span key={i} className={mark}>{t}</span>:<span key={i}>{t}</span>)}</span>}
