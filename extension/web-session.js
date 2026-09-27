/* DOM-only ChatGPT integration. No private endpoints, cookies or API credentials. */
(() => {
  const BODY = '.markdown, .prose, [class^="MarkdownRoot-"], [class*=" MarkdownRoot-"]';
  const TURN = 'article[data-testid^="conversation-turn"], [data-testid^="conversation-turn-"], [data-turn-id], [data-turn-key], [data-content-search-turn-key]';
  const MESSAGE = '[data-message-author-role], [data-chatgpt-selection-message-id]';
  const normalize = text => text.replace(/\s+/g,' ').trim();
  // Rich editors render line breaks as blocks; textContent omits those boundaries.
  const promptKey = text => text.replace(/\s+/g,'');
  function visible(el) { return !!el && !!el.getClientRects().length && !el.closest('#margin-root'); }
  function composer() {
    return [...document.querySelectorAll('#prompt-textarea, textarea[data-id="root"], form [contenteditable="true"]')].find(visible);
  }
  function sendButton(editor=composer()) {
    if(!editor)return null;
    // Search only around the active editor, never a send/share control elsewhere.
    const form=editor.closest('form');
    const scopes=[];
    if(form)scopes.push(form);
    else for(let p=editor.parentElement,depth=0;p&&depth<6&&p!==document.body;depth++,p=p.parentElement){
      if(p.matches('main, [role="main"]'))break;
      scopes.push(p);
    }
    const labels=new Set(['send','send prompt','send message','发送','发送提示','发送消息']);
    for(const scope of scopes){
      const candidates=[...scope.querySelectorAll('button')].filter(b=>visible(b)&&
        (b.getAttribute('data-testid')==='send-button'||b.hasAttribute('data-composer-send-button')||
        labels.has(normalize(b.getAttribute('aria-label')||b.getAttribute('title')||'').toLowerCase())));
      const ready=candidates.filter(b=>!b.disabled&&b.getAttribute('aria-disabled')!=='true');
      if(ready.length===1)return ready[0];
      if(ready.length>1)return null;
      if(candidates.length===1)return candidates[0];
    }
    return null;
  }
  function generating() {
    return [...document.querySelectorAll('[data-testid="stop-button"], button[aria-label="Stop streaming"], button[aria-label="Stop generating"], button[aria-label="停止生成"], button[aria-label="停止流式传输"], [data-is-streaming="true"]')].some(visible);
  }
  function turns() {
    let all = [...document.querySelectorAll(TURN)].filter(n => !n.closest('#margin-root'));
    all = all.filter(n => !all.some(other => other!==n && other.contains(n)));
    if (!all.length) all=[...document.querySelectorAll(MESSAGE)].filter(n=>!n.closest('#margin-root'));
    // Some layouts put a user request and its answer in one turn. Keep those
    // messages separate so answer extraction/folding never consumes a whole pair.
    return all.flatMap(turn=>{
      const nested=[...turn.querySelectorAll(MESSAGE)];
      const messages=nested.filter(n=>!nested.some(other=>other!==n&&other.contains(n)));
      return messages.length>1?messages:[turn];
    });
  }
  function diagnostics() {
    // Structural metadata only: do not copy message text, IDs, URLs or input values.
    const shape=el=>el.tagName.toLowerCase()+[...el.classList].slice(0,4).map(c=>'.'+c).join('')+
      [...el.attributes].filter(a=>a.name.startsWith('data-')||a.name==='role').map(a=>'['+a.name+']').join('');
    const blocks=[...document.querySelectorAll(BODY)].filter(n=>!n.closest('#margin-root, [contenteditable="true"]'));
    const paths=blocks.slice(-2).map((block,i)=>{
      const lines=[];let el=block;
      for(let depth=0;el&&depth<12;depth++,el=el.parentElement){
        lines.push('  '.repeat(depth)+shape(el));
        if(el===document.body)break;
      }
      return '正文容器 '+(i+1)+'：\n'+lines.join('\n');
    });
    const editor=composer();let scope=editor?.closest('form')||editor?.parentElement;
    if(editor&&!editor.closest('form'))for(let i=0;i<4&&scope?.parentElement&&scope.parentElement!==document.body;i++)scope=scope.parentElement;
    const buttons=scope?[...scope.querySelectorAll('button')].filter(visible).slice(-12).map(b=>({label:(b.getAttribute('aria-label')||b.getAttribute('title')||'').slice(0,80),testid:b.getAttribute('data-testid'),disabled:!!b.disabled,ariaDisabled:b.getAttribute('aria-disabled')})):[];
    return `消息容器 ${turns().length} · 输入框 ${editor?'已识别':'未识别'} · 发送按钮 ${sendButton()?'已识别':'未识别（空草稿时可能正常）'}\n输入框附近按钮：${JSON.stringify(buttons)}\n`+paths.join('\n');
  }
  function turnText(turn) {
    const nodes=[...turn.querySelectorAll(BODY)];
    const outer=nodes.filter(n=>!nodes.some(other=>other!==n&&other.contains(n)));
    return outer.length?outer.map(n=>n.textContent).join('\n'):turn.textContent;
  }
  function findPair(exchange) {
    const all=turns();
    // The UUID survives rendered line breaks, markdown and collapsed long prompts.
    // Require exactly one occurrence across messages; never guess on duplicate markers.
    if(!exchange.marker)return null;
    const matching=all.filter(n=>n.textContent.includes(exchange.marker));
    if(matching.length!==1)return null;
    const user=matching[0],next=all[all.indexOf(user)+1];
    if(!next || next.matches('[data-message-author-role="user"]') || next.querySelector('[data-message-author-role="user"]'))return {user};
    if(!next.matches('[data-message-author-role="assistant"]')&&!next.querySelector('[data-message-author-role="assistant"]')&&!next.matches(BODY)&&!next.querySelector(BODY))return {user};
    // Never associate an answer that itself repeats the full tagged request.
    const text=turnText(next).trim();
    return text.includes(exchange.marker)?{user}:{user,assistant:next,text};
  }
  function checkReady() {
    if(generating())throw Error('ChatGPT 正在生成其他回答，请等待完成后再追问。');
    const el=composer();if(!el)throw Error('找不到 ChatGPT 输入框。请滚动到聊天底部，或更新扩展。');
    if((el.value??el.textContent).trim())throw Error('主聊天输入框已有草稿，请先发送或清空。插件不会覆盖草稿。');
    if(!turns().length)throw Error('尚未识别聊天消息结构，不能安全关联回答。请使用「检查选区」反馈结构。');
    return el;
  }
  function hasCompletionSignal(pair) {
    return !!pair?.assistant && (pair.assistant.matches('[data-message-status="finished"]') || !!pair.assistant.querySelector('[data-message-status="finished"], [data-testid="copy-turn-action-button"], [data-testid="good-response-turn-action-button"], button[aria-label="Copy response"], button[aria-label="复制回复"], button[aria-label="Good response"], button[aria-label="好评"]'));
  }
  function makePrompt(note,question,marker) {
    const history=note.messages.slice(-12).map(m=>(m.role==='user'?'我':'助手')+'：'+m.content).join('\n');
    return `${marker}\n这是针对当前聊天中一段原文的旁注追问，请结合当前会话回答，不要复述追踪标记。\n\n引用原文：\n${note.anchor.quote}\n\n本条旁注最近的问答：\n${history||'（暂无）'}\n\n我的问题：\n${question}`;
  }
  async function send(prompt) {
    const path=location.pathname;
    const el=checkReady();el.focus();
    if(el.tagName==='TEXTAREA'){
      Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype,'value').set.call(el,prompt);
      el.dispatchEvent(new Event('input',{bubbles:true}));
    }else{
      // Let the editor's own input pipeline update its state (e.g. ProseMirror).
      if(!document.execCommand('insertText',false,prompt))throw Error('无法填入网页输入框，未发送。');
    }
    // React/ProseMirror may replace the voice control asynchronously after input.
    for(let attempt=0;attempt<50;attempt++){
      await new Promise(r=>setTimeout(r,100));
      if(location.pathname!==path || !el.isConnected)throw Error('聊天页面已切换，未发送追问。');
      if(turns().some(t=>promptKey(t.textContent).includes(promptKey(prompt))))return; // already manually sent
      if(promptKey(el.value??el.innerText??el.textContent)!==promptKey(prompt))throw Error('主聊天草稿已变化，已停止自动发送，请检查输入框。');
      if(generating())throw Error('网页已开始生成，已停止自动发送以免重复提交。');
      const button=sendButton(el);
      if(!button || button.disabled || button.getAttribute('aria-disabled')==='true')continue;
      button.click();
      return; // At most one click; never retry an uncertain submission.
    }
    throw Error('等待 5 秒仍未找到可用的发送按钮；草稿已保留。请点击「检查选区」，反馈新增的「输入框附近按钮」信息。');
  }
  const folded=new Map();
  function restoreFolds(notes,openNote) {
    const wanted=new Map();
    for(const note of notes)for(const ex of note.webTurns||[]){
      if(ex.status!=='complete')continue;
      const pair=findPair(ex);
      // Changed branches or regenerated answers stay visible rather than hiding unrelated text.
      if(!pair?.assistant || normalize(pair.text)!==normalize(ex.answer))continue;
      wanted.set(ex.id,{note,pair});
    }
    for(const [id,item] of folded)if(!wanted.has(id)||wanted.get(id).pair.user!==item.user||wanted.get(id).pair.assistant!==item.assistant){
      item.user.classList.remove('margin-folded-turn');item.assistant.classList.remove('margin-folded-turn');item.button.remove();folded.delete(id);
    }
    for(const [id,{note,pair}] of wanted){
      if(folded.has(id))continue;
      const button=document.createElement('button');button.className='margin-fold-toggle';button.textContent='✦ 已收进旁注 · 查看 / 展开';
      pair.user.before(button);pair.user.classList.add('margin-folded-turn');pair.assistant.classList.add('margin-folded-turn');
      button.onclick=()=>{const hidden=pair.user.classList.toggle('margin-folded-turn');pair.assistant.classList.toggle('margin-folded-turn',hidden);button.textContent=hidden?'✦ 已收进旁注 · 查看 / 展开':'✦ 收起这组旁注问答';openNote(note.id);};
      folded.set(id,{...pair,button});
    }
  }
  function clearFolds(){restoreFolds([],()=>{});}
  globalThis.MarginWeb={makePrompt,checkReady,send,findPair,generating,hasCompletionSignal,restoreFolds,clearFolds,normalize,diagnostics};
})();
