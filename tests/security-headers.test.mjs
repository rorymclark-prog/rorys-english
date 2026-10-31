import test from 'node:test';
import assert from 'node:assert/strict';

async function headersFor(env){
  const saved={NODE_ENV:process.env.NODE_ENV,NEXT_PUBLIC_SYNC_URL:process.env.NEXT_PUBLIC_SYNC_URL};
  Object.assign(process.env,env);
  try{
    const {default:config}=await import(`../next.config.mjs?${Math.random()}`);
    return Object.fromEntries((await config.headers())[0].headers.map(h=>[h.key,h.value]));
  }finally{for(const [k,v] of Object.entries(saved)){if(v===undefined)delete process.env[k];else process.env[k]=v;}}
}

test('production enforces the CSP and reports what it blocks',async()=>{
  const h=await headersFor({NODE_ENV:'production',NEXT_PUBLIC_SYNC_URL:'/api/service'});
  const csp=h['Content-Security-Policy'];
  assert.ok(csp,'enforced header present');
  assert.equal(h['Content-Security-Policy-Report-Only'],undefined);
  assert.match(csp,/frame-ancestors 'none'/);
  assert.match(csp,/object-src 'none'/);
  assert.match(csp,/frame-src [^;]*blob:/,'PDF previews open as blob: frames');
  assert.match(csp,/report-uri \/api\/csp-report\/(;|$)/);
});

test('a direct Apps Script URL in a local build is allowed, including its redirect host',async()=>{
  const h=await headersFor({NODE_ENV:'production',NEXT_PUBLIC_SYNC_URL:'https://script.google.com/macros/s/x/exec'});
  assert.match(h['Content-Security-Policy'],/connect-src [^;]*https:\/\/script\.google\.com [^;]*https:\/\/script\.googleusercontent\.com/);
});

test('next dev only reports, so fast refresh keeps working',async()=>{
  const h=await headersFor({NODE_ENV:'development',NEXT_PUBLIC_SYNC_URL:'/api/service'});
  assert.ok(h['Content-Security-Policy-Report-Only']);
  assert.equal(h['Content-Security-Policy'],undefined);
});
