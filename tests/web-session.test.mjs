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

// Minimal DOM fixture with the attribute hierarchy reported by the live page.
function element(attrs={},children=[],text=''){
  const n={attrs,children,textContent:text+children.map(c=>c.textContent).join(''),closest:()=>null};
  n.contains=target=>children.some(c=>c===target||c.contains(target));
  n.matches=selector=>selector.split(',').some(s=>{
    const m=/^\[([\w-]+)(?:="([^"]*)")?\]$/.exec(s.trim());
    return !!m&&Object.hasOwn(attrs,m[1])&&(m[2]===undefined||attrs[m[1]]===m[2]);
  });
  n.querySelectorAll=selector=>children.flatMap(c=>[...(c.matches(selector)?[c]:[]),...c.querySelectorAll(selector)]);
  n.querySelector=selector=>n.querySelectorAll(selector)[0]||null;
  return n;
}
function modernAdapter(nodes){const doc=element({},nodes);const ctx={document:doc};vm.runInNewContext(source,ctx);return ctx.MarginWeb;}
const tagged={prompt:'[Margin:fixture] Question',marker:'[Margin:fixture]'};
const modernMessage=(text,answer=false)=>element({'data-chatgpt-selection-message-id':''},answer?[element({'data-markdown-text-style':'','class':'MarkdownRoot-test'},[],text)]:[],answer?'':text);
// Model the CSS-module body selector separately from the attribute fixture parser.
function answerMessage(text){const n=modernMessage(text,true);const base=n.querySelectorAll;n.querySelectorAll=s=>s.includes('MarkdownRoot-')?n.children:base(s);return n;}
test('modern nested turn keys are deduplicated and their assistant body is associated',()=>{
  const user=modernMessage(tagged.prompt),answer=answerMessage('Correct answer');
  const u=element({'data-turn-key':''},[element({'data-content-search-turn-key':''},[user])]);
  const a=element({'data-turn-key':''},[element({'data-content-search-turn-key':''},[answer])]);
  const pair=modernAdapter([u,a]).findPair(tagged);
  assert.equal(pair.user,u);assert.equal(pair.assistant,a);assert.equal(pair.text,'Correct answer');
});
test('a combined modern turn is split into messages without folding the shared parent',()=>{
  const user=modernMessage(tagged.prompt),answer=answerMessage('Combined answer');
  const wrapper=element({'data-turn-key':''},[element({'data-content-search-turn-key':''},[user,answer])]);
  const pair=modernAdapter([wrapper]).findPair(tagged);
  assert.equal(pair.user,user);assert.equal(pair.assistant,answer);assert.equal(pair.text,'Combined answer');
});

function sendingFixture({label='发送',readyAt=4,editAt=0,navigateAt=0,manualAt=0,ambiguous=false}={}){
  let ticks=0,clicks=0;const location={pathname:'/c/test'};
  const button={getClientRects:()=>[{}],closest:()=>null,hasAttribute:()=>false,getAttribute:k=>k==='aria-label'?label:null,get disabled(){return ticks<readyAt;},click(){clicks++;}};
  const form={querySelectorAll:()=>ambiguous?[button,button]:[button]};
  const editor={tagName:'DIV',textContent:'',innerText:'',isConnected:true,focus(){},getClientRects:()=>[{}],closest:s=>s==='form'?form:null};
  const original=turn('assistant','Original answer');let sentPrompt='';
  const ctx={location,setTimeout:fn=>{ticks++;if(ticks===editAt)editor.innerText='User changed draft';if(ticks===navigateAt)location.pathname='/c/other';fn();},document:{
    querySelectorAll:s=>s.includes('#prompt-textarea')?[editor]:s.includes('stop-button')?[]:s.includes('article[')?[original,...(manualAt&&ticks>=manualAt?[turn('user',sentPrompt)]:[])]:[],
    execCommand:(command,unused,text)=>{sentPrompt=text;editor.innerText=text;editor.textContent=text;return true;}
  }};
  vm.runInNewContext(source,ctx);return {api:ctx.MarginWeb,get clicks(){return clicks;},get ticks(){return ticks;}};
}
test('waits for delayed localized send button and clicks exactly once',async()=>{
  for(const label of ['发送','Send','Send message']){const f=sendingFixture({label,readyAt:8});await f.api.send('[Margin:test] Question');assert.equal(f.clicks,1);assert.equal(f.ticks,8);}
});
test('never clicks voice or ambiguous controls and preserves drafts on timeout',async()=>{
  for(const options of [{label:'Start voice mode'},{ambiguous:true}]){const f=sendingFixture(options);await assert.rejects(f.api.send('[Margin:test] Question'),/5 秒/);assert.equal(f.clicks,0);}
});
test('stops sending when user edits, navigates, or already sent the tagged prompt',async()=>{
  for(const options of [{editAt:2},{navigateAt:2}]){const f=sendingFixture(options);await assert.rejects(f.api.send('[Margin:test] Question'));assert.equal(f.clicks,0);}
  const f=sendingFixture({manualAt:2});await f.api.send('[Margin:test] Question');assert.equal(f.clicks,0);
});
