import {test} from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
import {webcrypto} from 'node:crypto';
const source=await readFile(new URL('../extension/background.js',import.meta.url),'utf8');
function worker(settings={demo:true},fetchImpl=fetch){
  const db={settings};let listener;
  const ctx={crypto:webcrypto,AbortSignal,fetch:fetchImpl,importScripts(){},chrome:{runtime:{id:'test',onMessage:{addListener(fn){listener=fn;}}},storage:{local:{async get(key){return structuredClone(key?{[key]:db[key]}:db);},async set(values){Object.assign(db,structuredClone(values));},async remove(key){delete db[key];}}}}};
  vm.runInNewContext(source,ctx);
  return msg=>new Promise(resolve=>listener(msg,{id:'test'},resolve));
}
const make=()=>({type:'create',note:{conversation:'/c/test',anchor:{quote:'selected',prefix:'',suffix:''},context:'context'}});
test('worker saves two turns without adding them to other annotations',async()=>{const send=worker();const a=(await send(make())).data,b=(await send(make())).data;
  await send({type:'ask',id:a.id,question:'One'});await send({type:'ask',id:a.id,question:'Two'});
  const notes=(await send({type:'list',conversation:'/c/test'})).data;
  assert.equal(notes.find(n=>n.id===a.id).messages.length,4);assert.equal(notes.find(n=>n.id===b.id).messages.length,0);
  assert.equal((await send({type:'list',conversation:'/c/other'})).data.length,0);
});
test('failed request preserves user question and actionable error',async()=>{const send=worker({});const n=(await send(make())).data;const result=await send({type:'ask',id:n.id,question:'Help'});assert.equal(result.data.messages.length,1);assert.match(result.data.error,/配对码/);assert.equal(result.data.pending,null);});
test('deletion during in-flight request cannot resurrect a note',async()=>{let finish,started;const entered=new Promise(r=>started=r);const send=worker({token:'test'},()=>{started();return new Promise(r=>finish=r);});const n=(await send(make())).data;const pending=send({type:'ask',id:n.id,question:'Hi'});await entered;
  const second=await send({type:'ask',id:n.id,question:'Duplicate'});assert.equal(second.ok,false);
  await send({type:'delete',id:n.id});finish({ok:true,json:async()=>({text:'Answer'})});await pending;assert.equal((await send({type:'list'})).data.length,0);
});
function startWeb(id){const marker='[Margin:'+webcrypto.randomUUID()+']';return {type:'webBegin',id,marker,prompt:marker+'\nquestion',question:'question'};}
test('explicit collection recovers cancelled turns once and inserts answers next to their questions',async()=>{
  const send=worker();const n=(await send(make())).data;const first=(await send(startWeb(n.id))).data.exchange;
  await send({type:'webUpdate',id:n.id,exchangeId:first.id,status:'cancelled'});
  await send(startWeb(n.id));
  const collect={type:'webCollect',id:n.id,exchangeId:first.id,status:'complete',answer:'Recovered answer'};
  await send(collect);const saved=(await send(collect)).data;
  assert.equal(saved.messages.length,3);assert.equal(saved.messages[1].content,'Recovered answer');assert.equal(saved.messages[2].role,'user');
  await send({type:'delete',id:n.id});assert.equal((await send(collect)).data,null);
});
test('web mode serializes a conversation and completes idempotently without fetch',async()=>{
  const send=worker({},()=>{throw Error('Must never call API');});const a=(await send(make())).data,b=(await send(make())).data;
  const started=(await send(startWeb(a.id))).data;assert.ok(started.exchange);
  assert.equal((await send(startWeb(b.id))).ok,false);
  const complete={type:'webUpdate',id:a.id,exchangeId:started.exchange.id,status:'complete',answer:'web answer'};
  await send(complete);await send(complete);
  const saved=(await send({type:'list'})).data.find(n=>n.id===a.id);
  assert.equal(saved.messages.length,2);assert.equal(saved.webTurns[0].answer,'web answer');
  assert.equal((await send(startWeb(b.id))).ok,true);
});
test('cancelled web turn never receives a stale completion and deletion does not resurrect it',async()=>{
  const send=worker();const n=(await send(make())).data;const ex=(await send(startWeb(n.id))).data.exchange;
  await send({type:'webUpdate',id:n.id,exchangeId:ex.id,status:'cancelled'});
  const late=await send({type:'webUpdate',id:n.id,exchangeId:ex.id,status:'complete',answer:'late'});
  assert.equal(late.data.messages.length,1);assert.equal(late.data.webTurns[0].status,'cancelled');
  await send({type:'delete',id:n.id});assert.equal((await send({type:'webUpdate',id:n.id,exchangeId:ex.id,status:'complete',answer:'late'})).data,null);
});
