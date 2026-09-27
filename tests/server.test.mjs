import {test} from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {once} from 'node:events';
test('local service enforces pairing, origin and missing-key checks',async()=>{
  const child=spawn(process.execPath,['server/index.mjs'],{cwd:new URL('..',import.meta.url),env:{...process.env,OPENAI_API_KEY:'',OPENAI_MODEL:'',MARGIN_TOKEN:'test-pairing-token'},stdio:['ignore','pipe','pipe']});
  try{
    await Promise.race([once(child.stdout,'data'),once(child,'exit').then(()=>{throw Error('test server failed to start');}),new Promise((_,reject)=>{const t=setTimeout(()=>reject(Error('startup timeout')),5000);t.unref();})]);
    const url='http://127.0.0.1:43127';
    assert.equal((await fetch(url+'/health')).status,401);
    assert.equal((await fetch(url+'/health',{headers:{Origin:'https://example.com'}})).status,403);
    const headers={Authorization:'Bearer test-pairing-token'};
    assert.deepEqual(await (await fetch(url+'/health',{headers})).json(),{ready:false});
    assert.equal((await fetch(url+'/ask',{method:'POST',headers})).status,503);
  }finally{child.kill();await once(child,'exit');}
});
