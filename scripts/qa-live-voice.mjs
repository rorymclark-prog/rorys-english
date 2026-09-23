// A short, synthetic WebRTC connectivity check. No student records or real mic.
import puppeteer from 'puppeteer-core';
import http from 'node:http';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import {randomUUID} from 'node:crypto';
process.loadEnvFile('.env.local');
const guidedExports={};vm.runInNewContext(ts.transpileModule(fs.readFileSync('src/lib/guided-speaking.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{exports:guidedExports});
const exports={};vm.runInNewContext(ts.transpileModule(fs.readFileSync('src/lib/server/voice-session.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{exports,require:name=>{if(name==='../guided-speaking')return guidedExports;throw Error(name);}});
const nonce=randomUUID();let used=false;let apiStatus=null;let sessionId=null;let apiError=null;
const server=http.createServer(async(req,res)=>{
  if(req.method==='GET'){res.setHeader('Content-Type','text/html');res.end('<html><body><button id="start">Test voice</button><audio autoplay id="audio"></audio></body></html>');return;}
  if(req.url!==`/${nonce}`||used){res.writeHead(403);res.end('{}');return;}used=true;
  let body='';for await(const chunk of req)body+=chunk;
  const config=exports.voiceConfiguration({...JSON.parse(body),topic:'everyday'});
  try{
    const r=await fetch('https://api.openai.com/v1/live/sessions',{method:'POST',headers:{Authorization:`Bearer ${process.env.OPENAI_API_KEY}`,'Content-Type':'application/json'},body:JSON.stringify(config),signal:AbortSignal.timeout(45000)});
    apiStatus=r.status;const d=await r.json();sessionId=d.session?.id;apiError=d.error?{type:d.error.type,code:d.error.code,message:d.error.message}:null;
    res.writeHead(r.status,{'Content-Type':'application/json'});res.end(JSON.stringify(d));
  }catch(e){apiError={message:'Connection failed'};res.writeHead(502);res.end('{}');}
});
await new Promise(r=>server.listen(4187,'127.0.0.1',r));
const browser=await puppeteer.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true,args:['--use-fake-device-for-media-stream','--use-fake-ui-for-media-stream']});
try{
  const page=await browser.newPage();await page.goto('http://127.0.0.1:4187');
  const result=await page.evaluate(async nonce=>{
    const result={started:false,closed:false,remoteAudio:false,outputCaption:false,eventTypes:[],error:null};
    const peer=new RTCPeerConnection();let mic;
    try{
      peer.ontrack=e=>{result.remoteAudio=true;document.querySelector('audio').srcObject=new MediaStream([e.track]);};
      mic=await navigator.mediaDevices.getUserMedia({audio:true});mic.getTracks().forEach(t=>peer.addTrack(t,mic));
      const channel=peer.createDataChannel('oai-events');
      let finished;const done=new Promise(r=>finished=r);
      const timeout=setTimeout(()=>{result.error='Timed out';finished();},75000);
      channel.onmessage=({data})=>{
        const e=JSON.parse(data);if(!result.eventTypes.includes(e.type))result.eventTypes.push(e.type);
        if(e.type==='session.started'){
          result.started=true;
          channel.send(JSON.stringify({type:'session.instructions.append',delegation_id:null,event_id:'smoke-greeting',content:'Greet the learner now in English: say you are an AI English practice partner and ask which hobby they enjoy. Then pause and listen.'}));
          setTimeout(()=>{if(channel.readyState==='open')channel.send(JSON.stringify({type:'session.close'}));},12000);
        }
        if(e.type==='session.output_transcript.delta'&&e.delta)result.outputCaption=true;
        if(e.type==='session.closed'){result.closed=true;clearTimeout(timeout);finished();}
        if(e.type==='error')result.error=e.error?.message||'Voice event error';
      };
      await peer.setLocalDescription(await peer.createOffer());
      if(peer.iceGatheringState!=='complete')await new Promise((resolve,reject)=>{const t=setTimeout(()=>reject(new Error('ICE timeout')),10000);peer.onicegatheringstatechange=()=>{if(peer.iceGatheringState==='complete'){clearTimeout(t);resolve();}};});
      const r=await fetch('/'+nonce,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({sdp:peer.localDescription.sdp})});
      if(!r.ok){clearTimeout(timeout);throw new Error('Session HTTP '+r.status);}
      const d=await r.json();await peer.setRemoteDescription({type:'answer',sdp:d.transport.sdp});await done;
      channel.close();
    }catch(e){result.error=e.message;}
    finally{mic?.getTracks().forEach(t=>t.stop());peer.close();}
    return result;
  },nonce);
  console.log(JSON.stringify({apiStatus,sessionCreated:!!sessionId,apiError,...result}));
  if(!result.started||!result.closed||!result.remoteAudio||!result.outputCaption)process.exitCode=1;
}finally{await browser.close();server.close();}
