export type CaptionFragment={speaker:'You'|'AI partner';delta:string;start_ms:number;end_ms?:number};
export type ConversationTurn={speaker:CaptionFragment['speaker']|'Unlabelled caption';startSeconds:number;text:string};

// Join streaming deltas exactly: a delta can be a word, punctuation or part of a word.
// Keep interruptions in arrival order instead of regrouping by speaker or timestamp.
export function conversationTurns(fragments:CaptionFragment[]):ConversationTurn[]{
  const turns:ConversationTurn[]=[];
  for(const f of fragments){
    const previous=turns[turns.length-1];
    if(previous?.speaker===f.speaker)previous.text+=f.delta;
    else turns.push({speaker:f.speaker,startSeconds:Math.max(0,f.start_ms/1000),text:f.delta});
  }
  return turns.map(t=>({...t,text:t.text.trim()})).filter(t=>t.text);
}

export function parseConversationTranscript(text:string):ConversationTurn[]|null{
  const fragments:CaptionFragment[]=[];
  const tail:string[]=[];
  for(const line of text.split('\n')){
    if(!line.trim())continue;
    const match=line.match(/^\[(\d+(?:\.\d+)?)s\] (You|AI partner): (.*)$/);
    if(!match){if(!fragments.length)return null;tail.push(line);continue;}
    if(tail.length)return null; // An unfamiliar format in the middle remains verbatim.
    fragments.push({speaker:match[2] as CaptionFragment['speaker'],start_ms:Number(match[1])*1000,delta:match[3]});
  }
  const turns=conversationTurns(fragments);
  if(tail.length)turns.push({speaker:'Unlabelled caption',startSeconds:NaN,text:tail.join('\n')});
  return turns;
}

export function formatConversationTranscript(fragments:CaptionFragment[]):string{
  return conversationTurns(fragments).map(t=>`[${t.startSeconds.toFixed(1)}s] ${t.speaker}: ${t.text}`).join('\n');
}

export function conversationTime(seconds:number):string{
  const whole=Math.floor(seconds);return `${Math.floor(whole/60)}:${String(whole%60).padStart(2,'0')}`;
}
