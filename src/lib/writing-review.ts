import type {WritingComparison} from './learning';

export type SentenceRow = WritingComparison & {
  number: number | null;
  status: 'corrected' | 'unchanged' | 'pending' | 'source-note';
};
export type WritingSource = {original?:string;corrected?:string;comparisons?:WritingComparison[];corrections?:{original:string;corrected:string;note:string}[]};
const normal = (text:string) => text.replace(/[‘’]/g,"'").replace(/[“”]/g,'"').replace(/\s+/g,' ').trim().toLowerCase();
const sourceNote = (text:string) => /^\[(?:crossed[- ]out|unclear|illegible|unreadable|transcription|wording unclear)\b[\s\S]*\]$/i.test(text.trim());

export function writingSentences(text:string):string[] {
  if(!text.trim()) return [];
  if(typeof Intl.Segmenter==='function') return [...new Intl.Segmenter('en',{granularity:'sentence'}).segment(text)].map(x=>x.segment.trim()).filter(Boolean);
  return (text.match(/[^.!?]+(?:[.!?]+[\]"”’]*|$)/g)||[]).map(x=>x.trim()).filter(Boolean);
}

function similarity(a:string,b:string):number {
  const words=(text:string)=>normal(text).match(/[\p{L}\p{N}]+/gu)||[];
  const left=words(a),right=words(b),counts=new Map<string,number>();
  if(normal(a)===normal(b)) return 1;
  for(const word of right) counts.set(word,(counts.get(word)||0)+1);
  let shared=0;
  for(const word of left) if(counts.get(word)){shared++;counts.set(word,counts.get(word)!-1);}
  return left.length+right.length ? 2*shared/(left.length+right.length) : 0;
}

// Monotonic alignment preserves every original sentence. A correction may split
// one sentence or join two; unmatched text remains explicitly unreviewed.
function align(before:string[],after:string[]) {
  type Step={old:number;fresh:number;score:number};
  const n=before.length,m=after.length;
  if(n*m>40000) return before.map(()=>({text:'',note:''}));
  const costs=Array.from({length:n+1},()=>Array(m+1).fill(Infinity));
  const steps=Array.from({length:n+1},()=>Array<Step|null>(m+1).fill(null));
  costs[0][0]=0;
  for(let i=0;i<=n;i++) for(let j=0;j<=m;j++) {
    const offer=(old:number,fresh:number,cost:number,score=0)=>{
      if(i+old>n||j+fresh>m) return;
      const total=costs[i][j]+cost;
      if(total<costs[i+old][j+fresh]) {costs[i+old][j+fresh]=total;steps[i+old][j+fresh]={old,fresh,score};}
    };
    offer(1,0,1); offer(0,1,1);
    for(const [old,fresh] of [[1,1],[1,2],[2,1]]) {
      if(i+old>n||j+fresh>m) continue;
      const left=before.slice(i,i+old),right=after.slice(j,j+fresh),leftText=left.join(' '),rightText=right.join(' ');
      // A nearby exact match must not absorb an unrelated omitted sentence.
      if(old+fresh>2&&(left.some(part=>similarity(part,rightText)<0.35)||right.some(part=>similarity(leftText,part)<0.35))) continue;
      if(old+fresh>2&&(left.some(part=>normal(part)===normal(rightText))||right.some(part=>normal(part)===normal(leftText)))) continue;
      const score=similarity(leftText,rightText);
      if(score>=0.45) offer(old,fresh,1-score+(old+fresh-2)*0.3,score);
    }
  }
  const result=before.map(()=>({text:'',note:''}));
  let i=n,j=m;
  while(i||j) {
    const step=steps[i][j]; if(!step) break;
    if(step.old&&step.fresh) {
      const text=after.slice(j-step.fresh,j).join(' ');
      const note=step.old>1?`The corrected version combines original sentences ${i-step.old+1}–${i}. It is repeated here so neither original is omitted.`:step.fresh>1?'The corrected version splits this original into two sentences.':'';
      for(let k=i-step.old;k<i;k++) result[k]={text,note};
    }
    i-=step.old;j-=step.fresh;
  }
  return result;
}

function replacePhrase(text:string,phrase:string,replacement:string):string|null {
  if(!phrase.trim()||!replacement.trim()) return null;
  const escape=(s:string)=>s.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
  const expression=phrase.trim().split(/\s+/).map(escape).join('\\s+').replace(/[‘’']/g,"['‘’]");
  const matches=[...text.matchAll(new RegExp(expression,'gi'))].filter(m=>!/[\p{L}\p{N}]/u.test(text[m.index!-1]||'')&&!/[\p{L}\p{N}]/u.test(text[m.index!+m[0].length]||''));
  if(matches.length!==1) return null;
  const match=matches[0],start=match.index!;
  const value=start===0&&/^[A-Z]/.test(match[0])?replacement[0].toUpperCase()+replacement.slice(1):replacement;
  return text.slice(0,start)+value+text.slice(start+match[0].length);
}

export function sentenceReview(w:WritingSource,{preferComparisons=true}:{preferComparisons?:boolean}={}):{rows:SentenceRow[];hasOriginal:boolean;pending:number} {
  const segments=writingSentences(w.original||'');
  const originals=segments.filter(s=>!sourceNote(s));
  const comparisons=w.comparisons||w.corrections?.map(c=>({...c,improved:''}))||[];
  const aligned=align(originals,writingSentences(w.corrected||'').filter(s=>!sourceNote(s)));
  const fullRows=comparisons.length===originals.length&&comparisons.every((row,i)=>normal(row.original)===normal(originals[i]));
  let index=0;
  const rows:SentenceRow[]=segments.map(original=>{
    if(sourceNote(original)) return {original,corrected:'',improved:'',note:'Transcription note, not a student sentence. The uncertain wording is preserved and is not marked as an error.',number:null,status:'source-note'};
    const position=index++,number=position+1;
    const exact=fullRows?comparisons[position]:comparisons.find(row=>normal(row.original)===normal(original)&&originals.filter(s=>normal(s)===normal(original)).length===1);
    const corrected=exact&&preferComparisons?exact.corrected.trim():aligned[position].text;
    const matches=comparisons.filter(row=>row===exact||Boolean(row.original.trim()&&normal(original).includes(normal(row.original))&&originals.filter(s=>normal(s).includes(normal(row.original))).length===1));
    let improved=exact?.improved.trim()||'';
    if(!improved&&corrected) {
      let expanded=corrected,changed=false;
      for(const row of matches) if(row.improved.trim()) {
        const replacement=replacePhrase(expanded,row.corrected,row.improved.trim());
        if(replacement!==null){expanded=replacement;changed=true;}
      }
      if(changed) improved=expanded;
    }
    const status=!corrected?'pending':original===corrected?'unchanged':'corrected';
    const notes=[...new Set(matches.map(row=>row.note.trim()).filter(Boolean))];
    if(aligned[position].note&&!exact) notes.push(aligned[position].note);
    if(!notes.length) notes.push(status==='unchanged'?'Already correct — no language correction is needed.':status==='pending'?'No complete correction is saved for this sentence yet. It has not been marked as correct.':'The full correction is shown. Rory can add the reason for this change.');
    return {original,corrected,improved,note:notes.join(' '),number,status};
  });
  return {rows,hasOriginal:originals.length>0,pending:rows.filter(row=>row.status==='pending').length};
}
