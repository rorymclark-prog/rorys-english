export const APP_BACK_STATE = 'reAppBack';
export type AppBackState = {scope:string;path:string;canGoBack:boolean};
const within=(path:string,scope:string)=>path===scope.replace(/\/$/,'')||path.startsWith(scope);

/** Mark only history entries whose predecessor belongs to this workspace. */
export function appBackState(scope:string,path:string,length:number,stored:AppBackState|undefined,previous:{path:string;length:number}|null):AppBackState {
  if(stored?.scope===scope&&stored.path===path)return stored;
  const knownPrevious=previous&&within(previous.path,scope);
  const grew=previous&&length>previous.length;
  // Replacing an entry preserves its existing safe predecessor. A cold start,
  // external referrer or another learner's workspace never establishes one.
  const preserved=stored?.scope===scope&&stored.canGoBack;
  return {scope,path,canGoBack:!!(knownPrevious&&(grew||preserved))};
}
