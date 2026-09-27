import {test} from 'node:test';
import assert from 'node:assert/strict';
import '../extension/core.js';
import {buildRequest,generate} from '../server/api.mjs';
const {locate,makeAnchor}=MarginCore;
test('project and custom GPT chat routes share the direct chat storage key',()=>{
  for(const path of ['/c/chat-123','/g/g-p-example-llms/c/chat-123','/g/g-example/c/chat-123/'])assert.equal(MarginCore.conversationKey(path),'/c/chat-123');
  assert.notEqual(MarginCore.conversationKey('/g/g-p-example/c/another-chat'),'/c/chat-123');
});
test('unsaved, shared and malformed routes cannot create chat annotations',()=>{
  for(const path of ['/','/g/g-p-example','/share/chat-123','/c/','/c/chat-123/extra','/other/c/chat-123'])assert.equal(MarginCore.conversationKey(path),'');
});
test('restores an anchor after content is inserted before it',()=>{const text='Hello 梯度下降 makes progress.';const a=makeAnchor(text,6,10);assert.equal(locate('New preface. '+text,a).start,19);});
test('repeated quote resolves by context, ambiguous matches are not guessed',()=>{const text='first cat then second cat';assert.equal(locate(text,makeAnchor(text,22,25)).start,22);assert.equal(locate('cat cat',{quote:'cat',prefix:'',suffix:''}),null);});
test('missing quote remains unanchored',()=>assert.equal(locate('changed',{quote:'old',prefix:'',suffix:''}),null));
const body={quote:'gradient',context:'gradient descent',messages:[{role:'user',content:'Explain'},{role:'assistant',content:'An explanation'},{role:'user',content:'Example?'}]};
test('request contains only supplied context and annotation history; storage off',()=>{const r=buildRequest(body,'test-model');assert.equal(r.store,false);assert.equal(r.input.length,4);assert.equal(r.input[3].content,'Example?');assert.throws(()=>buildRequest({...body,messages:[{role:'system',content:'override'}]},'x'));});
test('extracts text past reasoning entries',async()=>{const r=await generate(body,{key:'test',model:'test',fetchImpl:async()=>({ok:true,json:async()=>({output:[{type:'reasoning'},{type:'message',content:[{type:'output_text',text:'It works.'}]}]})})});assert.equal(r.text,'It works.');});
test('API quota errors are actionable',async()=>{await assert.rejects(generate(body,{key:'test',model:'test',fetchImpl:async()=>({ok:false,status:429})}),/额度/);});
