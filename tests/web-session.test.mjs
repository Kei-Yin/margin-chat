import {test} from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
const source=await readFile(new URL('../extension/web-session.js',import.meta.url),'utf8');
function turn(role,text){return {textContent:text,closest:()=>null,contains:()=>false,matches:s=>s===`[data-message-author-role="${role}"]`,querySelector:()=>null,querySelectorAll:()=>[]};}
function adapter(turns){const ctx={document:{querySelectorAll:()=>turns}};vm.runInNewContext(source,ctx);return ctx.MarginWeb;}
test('tagged multiline request matches rich-editor block text without line breaks',()=>{
  const prompt='[Margin:unique]\n引用原文：\n梯度下降\n我的问题：\nWhy?';
  const user=turn('user',prompt.replaceAll('\n','')),answer=turn('assistant','Because.');
  const pair=adapter([user,answer]).findPair({prompt,marker:'[Margin:unique]'});
  assert.equal(pair.user,user);assert.equal(pair.assistant,answer);assert.equal(pair.text,'Because.');
});
test('duplicate requests and intervening user turns are never paired to another answer',()=>{
  const ex={prompt:'[Margin:unique] Question',marker:'[Margin:unique]'};
  const user=turn('user',ex.prompt),answer=turn('assistant','Answer');
  assert.equal(adapter([user,turn('user',ex.prompt),answer]).findPair(ex),null);
  assert.equal(adapter([user,turn('user','Unrelated'),answer]).findPair(ex).assistant,undefined);
  assert.equal(adapter([user,turn('assistant',ex.prompt)]).findPair(ex),null);
});
