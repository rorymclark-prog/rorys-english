// Review and record ids are for the system, not for Rory reading a lesson
// assessment. Generated notes sometimes cite them ("3 October review
// 089f4988-…"); the date and kind of review are what a person needs.
const RECORD_ID=/\s*\b(?:source-review-|review-)?[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/gi;

export function withoutRecordIds(text:string|undefined|null):string{
  return String(text??"").replace(RECORD_ID,"").replace(/\s+([,.;:])/g,"$1").replace(/ {2,}/g," ").trim();
}
