import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
function read(path){const exports={};vm.runInNewContext(ts.transpileModule(fs.readFileSync(path,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{exports});return exports;}
const {parseConversationTranscript,formatConversationTranscript}=read('src/lib/conversation-transcript.ts');
const {feedbackSource,latestRecordedLesson}=read('src/lib/feedback-source.ts');
test('streaming words, partial words and punctuation become readable turns without changing speech',()=>{
 const input=[{speaker:'You',start_ms:1200,delta:' I'},{speaker:'You',start_ms:1400,delta:' cy'},{speaker:'You',start_ms:1500,delta:'cle'},{speaker:'You',start_ms:1600,delta:'.'},{speaker:'AI partner',start_ms:1800,delta:' Nice!'}];
 assert.equal(formatConversationTranscript(input),'[1.2s] You: I cycle.\n[1.8s] AI partner: Nice!');
 assert.equal(parseConversationTranscript(formatConversationTranscript(input))[0].text,'I cycle.');
});
test('interruptions and overlapping timestamps preserve order and speaker ownership',()=>{
 const turns=parseConversationTranscript('[2.0s] You:  My brother\n[2.0s] AI partner:  Yeah.\n[2.1s] You:  is younger than me.');
 assert.equal(turns.length,3);assert.equal(turns[2].speaker,'You');assert.equal(turns[0].text,'My brother');
});
test('legacy truncated captions keep the unlabelled ending; unknown formats remain verbatim',()=>{
 const turns=parseConversationTranscript('[7.0s] You:  Hello\n[7.2s] You: .\n[7.4');
 assert.equal(turns[0].text,'Hello.');assert.equal(turns[1].speaker,'Unlabelled caption');assert.equal(turns[1].text,'[7.4');
 assert.equal(parseConversationTranscript('Teacher: What happened?\nLearner: I went home.'),null);
});
test('practice source labels distinguish AI chat, private recording analysis and follow-up tasks',()=>{
 const r={kind:'speaking',body:{evidenceType:'AI conversation captions'}};
 assert.equal(feedbackSource(r).label,'AI conversation feedback');
 assert.equal(feedbackSource({kind:'lesson',body:{source:'student/lesson-recording/2026-10-03/id'}}).label,'AI analysis of recorded lesson');
 assert.equal(feedbackSource({kind:'lesson',body:{feedbackOrigin:'recorded-lesson-practice'}}).label,'Practice from your recorded lesson');
 assert.equal(feedbackSource({kind:'lesson',body:{summary:'A teacher lesson note'}}),null);
});

test('recording shortcuts select the actual latest lesson, excluding chat feedback, practice and prepared packs',()=>{
 const review={id:'review-old',date:'2026-10-03',created:'2026-10-04',kind:'lesson',body:{source:'ferdi/lesson-recording/2026-10-03/id'}};
 const newer={...review,id:'review-new',date:'2026-10-17',created:'2026-10-18'};
 const practice={...newer,id:'practice',date:'2026-11-01',body:{source:'lesson-practice:review-new'}};
 const chat={...newer,id:'chat',date:'2026-11-02',kind:'speaking',body:{evidenceType:'AI conversation captions'}};
 assert.equal(latestRecordedLesson([practice,chat]),null);
 assert.equal(latestRecordedLesson([practice,chat,review,newer]).id,'review-new');
 assert.equal(latestRecordedLesson([newer,{...newer,id:'revision',created:'2026-10-19'}]).id,'revision');
});
