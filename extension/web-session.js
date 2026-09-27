/* DOM-only ChatGPT integration. No private endpoints, cookies or API credentials. */
(() => {
  const BODY = '.markdown, .prose, [class^="MarkdownRoot-"], [class*=" MarkdownRoot-"]';
  const TURN = 'article[data-testid^="conversation-turn"], [data-testid^="conversation-turn-"], [data-turn-id]';
  const normalize = text => text.replace(/\s+/g,' ').trim();
  // Rich editors render line breaks as blocks; textContent omits those boundaries.
  const promptKey = text => text.replace(/\s+/g,'');
  function visible(el) { return !!el && !!el.getClientRects().length && !el.closest('#margin-root'); }
  function composer() {
    return [...document.querySelectorAll('#prompt-textarea, textarea[data-id="root"], form [contenteditable="true"]')].find(visible);
  }
  function sendButton() {
    return [...document.querySelectorAll('[data-testid="send-button"], button[aria-label="Send prompt"], button[aria-label="发送提示"], button[aria-label="发送消息"]')].find(visible);
  }
  function generating() {
    return [...document.querySelectorAll('[data-testid="stop-button"], button[aria-label="Stop streaming"], button[aria-label="停止生成"], [data-is-streaming="true"]')].some(visible);
  }
  function turns() {
    let all = [...document.querySelectorAll(TURN)].filter(n => !n.closest('#margin-root'));
    all = all.filter(n => !all.some(other => other!==n && other.contains(n)));
    if (!all.length) all=[...document.querySelectorAll('[data-message-author-role]')].filter(n=>!n.closest('#margin-root'));
    return all;
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
    return `消息容器 ${turns().length} · 输入框 ${composer()?'已识别':'未识别'} · 发送按钮 ${sendButton()?'已识别':'未识别（空草稿时可能正常）'}\n`+paths.join('\n');
  }
  function turnText(turn) {
    const nodes=[...turn.querySelectorAll(BODY)];
    const outer=nodes.filter(n=>!nodes.some(other=>other!==n&&other.contains(n)));
    return outer.length?outer.map(n=>n.textContent).join('\n'):turn.textContent;
  }
  function findPair(exchange) {
    const all=turns();
    const matching=all.filter(n=>promptKey(n.textContent).includes(promptKey(exchange.prompt)));
    if(matching.length!==1)return null;
    const user=matching[0],next=all[all.indexOf(user)+1];
    if(!next || next.matches('[data-message-author-role="user"]') || next.querySelector('[data-message-author-role="user"]'))return {user};
    if(!next.matches('[data-message-author-role="assistant"]')&&!next.querySelector('[data-message-author-role="assistant"]')&&!next.querySelector(BODY))return {user};
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
    return !!pair?.assistant && (pair.assistant.matches('[data-message-status="finished"]') || !!pair.assistant.querySelector('[data-message-status="finished"], [data-testid="copy-turn-action-button"], [data-testid="good-response-turn-action-button"]'));
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
    await new Promise(r=>setTimeout(r,120));
    if(location.pathname!==path || !el.isConnected)throw Error('聊天页面已切换，未发送追问。');
    if(promptKey(el.value??el.innerText??el.textContent)!==promptKey(prompt))throw Error('网页输入框内容校验失败，未发送。请检查主聊天草稿。');
    const button=sendButton();
    if(!button || button.disabled || button.getAttribute('aria-disabled')==='true')throw Error('网页发送按钮尚不可用；追问已填入主输入框，可手动发送后自动关联。');
    button.click();
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
