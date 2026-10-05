import {conversationTime,conversationTurns,parseConversationTranscript,type CaptionFragment} from '@/lib/conversation-transcript';

export default function ConversationTranscript({text,fragments}:{text?:string;fragments?:CaptionFragment[]}){
  const turns=fragments?conversationTurns(fragments):parseConversationTranscript(text||'');
  if(!turns)return <p className="mt-3 whitespace-pre-wrap text-sm leading-7">{text}</p>;
  return <ol className="conversation-turns mt-3 space-y-3" aria-label="Conversation by speaker">{turns.map((turn,i)=><li key={i} className={`rounded-xl border border-black/10 p-3 dark:border-white/15 ${turn.speaker==='You'?'bg-white/60 dark:bg-white/5':''}`}><p className="mb-1 text-xs"><strong>{turn.speaker}</strong>{Number.isFinite(turn.startSeconds)&&<span className="ml-2 text-navy-soft dark:text-navy-mist">{conversationTime(turn.startSeconds)}</span>}</p><p className="whitespace-pre-wrap text-sm leading-7">{turn.text}</p></li>)}</ol>;
}
