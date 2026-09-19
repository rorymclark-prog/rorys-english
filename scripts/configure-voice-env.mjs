// Copies only the new server-side voice key; never prints the value.
import {spawnSync} from 'node:child_process';
process.loadEnvFile('.env.local');
const key=process.env.OPENAI_API_KEY;
if(!key)throw new Error('Missing local voice key');
const result=spawnSync('vercel',['env','add','OPENAI_API_KEY','production','--sensitive','--force','--yes'],{input:key+'\n',encoding:'utf8'});
process.stdout.write((result.stdout||'').replaceAll(key,'[redacted]'));
process.stderr.write((result.stderr||'').replaceAll(key,'[redacted]'));
if(result.status!==0)process.exit(result.status||1);
const flag=spawnSync('vercel',['env','add','LIVE_VOICE_ENABLED','production','--value','false','--force','--yes'],{encoding:'utf8'});
process.stdout.write(flag.stdout||'');process.stderr.write(flag.stderr||'');process.exit(flag.status||0);
