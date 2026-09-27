(() => {
  if (document.getElementById('margin-root')) return;
  const host = document.createElement('div'); host.id = 'margin-root';
  document.body.append(host);
  const shadow = host.attachShadow({mode:'open'});
  shadow.innerHTML = `<style>
    :host{all:initial;font:14px/1.6 system-ui,-apple-system,"Segoe UI",sans-serif;color:#23352f;color-scheme:light}
    *{box-sizing:border-box}button,textarea,input{font:inherit}button{cursor:pointer;border:0}button:disabled{cursor:wait;opacity:.55}
    button:focus-visible,textarea:focus-visible,input:focus-visible{outline:3px solid #7ca99a;outline-offset:2px}
    .launcher{position:fixed;right:24px;bottom:26px;background:#254e40;color:white;border-radius:24px;padding:12px 20px;box-shadow:0 5px 24px #0002;z-index:2147483646}
    .pick{position:fixed;z-index:2147483647;background:#254e40;color:#fff;border-radius:10px;padding:9px 16px;box-shadow:0 4px 20px #0003}
    .panel{position:fixed;right:24px;bottom:84px;width:400px;max-width:calc(100vw - 24px);height:590px;max-height:calc(100dvh - 108px);background:#fcfbf7;border:1px solid #dce1d8;border-radius:20px;box-shadow:0 16px 70px #122a2630;z-index:2147483647;display:flex;flex-direction:column;overflow:hidden}
    [hidden]{display:none!important}header{display:flex;align-items:center;gap:10px;padding:18px 20px;border-bottom:1px solid #e4e7df}header strong{font-size:17px;flex:1}header button,.quiet{background:transparent;color:#53645b;padding:5px 7px;border-radius:7px}.eyebrow{font-size:10px;letter-spacing:2px;color:#6c8074}.body{flex:1;overflow:auto;padding:20px;overscroll-behavior:contain}.quote{border-left:3px solid #e8c751;background:#f7f0d7;padding:12px 14px;border-radius:0 8px 8px 0;white-space:pre-wrap;overflow-wrap:anywhere;max-height:130px;overflow:auto;margin-bottom:18px}.hint{color:#758278;font-size:12px}.empty{padding:28px 5px;color:#6a7a70}.empty b{display:block;font-size:20px;color:#2b4d3e;margin:10px 0}.message{margin:18px 0;white-space:pre-wrap;overflow-wrap:anywhere}.message.user{background:#eaf0e8;border-radius:12px;padding:12px}.role{font-size:11px;color:#7b877d;margin-bottom:4px;letter-spacing:1px}.error{color:#9b422c;background:#f9e9df;padding:10px;border-radius:8px;font-size:12px;white-space:pre-wrap}.composer{padding:14px 18px 18px;border-top:1px solid #e4e7df}textarea{width:100%;resize:none;background:#fff;border:1px solid #d9dfd5;border-radius:10px;padding:10px;color:#23352f;min-height:74px}.foot{display:flex;align-items:center;justify-content:space-between;margin-top:9px}.primary{background:#254e40;color:#fff;border-radius:9px;padding:8px 15px}.card{display:block;width:100%;text-align:left;background:white;border:1px solid #e0e4da;border-radius:12px;padding:14px;margin:10px 0;color:#304839}.card:hover{border-color:#b4c2ae}.card strong{display:block;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.card span{font-size:12px;color:#7a877c}.search{width:100%;border:1px solid #d9dfd5;border-radius:9px;background:white;padding:9px;color:#23352f}.toast{position:fixed;bottom:90px;left:50%;transform:translateX(-50%);background:#263e34;color:white;border-radius:10px;padding:12px 20px;z-index:2147483647;max-width:90vw}
    @media(max-width:500px){.panel{right:12px;bottom:76px}.launcher{right:12px;bottom:18px}}
  </style>
  <button class="launcher" aria-label="打开当前聊天的旁注">✦ 旁注 <span id="count">0</span></button>
  <button class="pick" hidden>✦ 追问这段</button>
  <section class="panel" hidden role="dialog" aria-label="Margin 旁注">
    <header><button id="back" aria-label="返回旁注列表">←</button><div><div class="eyebrow">MARGIN / 旁注</div><strong id="title">留住每一次理解</strong></div><div style="flex:1"></div><button id="settings" aria-label="设置">⚙</button><button id="close" aria-label="关闭旁注">✕</button></header>
    <div class="body"></div><form class="composer" hidden><textarea maxlength="6000" placeholder="这段哪里不明白？试着问一个问题…" aria-label="你的追问"></textarea><div class="foot"><span class="hint">Ctrl / ⌘ + Enter 发送</span><button class="primary" type="submit">发送 ↗</button></div></form>
  </section><div class="toast" role="status" hidden></div>`;
  const $ = s => shadow.querySelector(s);
  const panel = $('.panel'), body = $('.body'), picker = $('.pick'), form = $('form'), input = $('textarea');
  let conversation = '', notes = [], active = null, selected = null, ranges = [], refreshTimer, toastTimer, selectionTimer;
  const drafts = new Map();
  async function rpc(type, data={}) { const r = await chrome.runtime.sendMessage({type,...data}); if (!r?.ok) throw Error(r?.error || '扩展连接已失效，请刷新页面。'); return r.data; }
  function toast(text) { $('.toast').textContent=text; $('.toast').hidden=false; clearTimeout(toastTimer); toastTimer=setTimeout(()=>$('.toast').hidden=true,4500); }
  function node(tag, cls, text) { const n=document.createElement(tag); if(cls)n.className=cls; if(text!==undefined)n.textContent=text; return n; }
  function roots() {
    // A reply can have several Markdown blocks; never assume only the first one is the answer.
    const candidates = new Set();
    for (const message of document.querySelectorAll('[data-message-author-role="assistant"]')) {
      const blocks = message.querySelectorAll('.markdown, .prose');
      for (const block of blocks.length ? blocks : [message]) candidates.add(block);
    }
    // Some ChatGPT layouts omit the author attribute on the rendered answer.
    for (const block of document.querySelectorAll('main .markdown, main .prose, [role="main"] .markdown, [role="main"] .prose')) candidates.add(block);
    const safe = [...candidates].filter(n => !n.closest('[data-message-author-role="user"], textarea, input, [contenteditable="true"], #margin-root'));
    return safe.filter(n => !safe.some(other => other !== n && other.contains(n)));
  }
  function messageId(root) { return root.closest('[data-message-id]')?.getAttribute('data-message-id') || root.querySelector('[data-message-id]')?.getAttribute('data-message-id') || ''; }
  function textNodes(root) { const w=document.createTreeWalker(root,NodeFilter.SHOW_TEXT); const out=[]; while(w.nextNode()) out.push(w.currentNode); return out; }
  function rangeAt(root,start,end) {
    const r=document.createRange(); let pos=0, begun=false;
    for(const n of textNodes(root)){ const next=pos+n.length; if(!begun && start<next){r.setStart(n,start-pos);begun=true;} if(begun && end<=next){r.setEnd(n,end-pos);return r;} pos=next; }
    return null;
  }
  function rebuild() {
    ranges=[]; const all=roots();
    for(const n of notes){
      let candidates=n.messageId ? all.filter(r=>messageId(r)===n.messageId) : all;
      if(!candidates.length) candidates=all;
      const matches=candidates.map(root=>({root,pos:MarginCore.locate(root.textContent,n.anchor)})).filter(x=>x.pos);
      if(matches.length!==1) continue;
      const {root,pos}=matches[0],range=rangeAt(root,pos.start,pos.end);
      if(range)ranges.push({id:n.id,range});
    }
    if(globalThis.CSS?.highlights && globalThis.Highlight){
      CSS.highlights.set('margin-notes',new Highlight(...ranges.map(x=>x.range)));
      CSS.highlights.set('margin-active',new Highlight(...ranges.filter(x=>x.id===active).map(x=>x.range)));
    }
    $('#count').textContent=notes.length;
  }
  function remember(){if(active)drafts.set(active,input.value);}
  function showList(){remember();active=null;panel.hidden=false;form.hidden=true;$('#back').hidden=true;$('#title').textContent='留住每一次理解';body.replaceChildren();
    const search=node('input','search');search.placeholder='搜索这条聊天的旁注…';search.setAttribute('aria-label','搜索旁注');body.append(search);
    const items=node('div');body.append(items);
    function draw(){items.replaceChildren(); const filtered=notes.filter(n=>(n.anchor.quote+' '+n.messages.map(m=>m.content).join(' ')).toLowerCase().includes(search.value.toLowerCase()));
      if(!filtered.length){const e=node('div','empty');e.append(node('div','','✦'),node('b','',notes.length?'没有匹配的旁注':'让问题留在原文旁边'),node('p','',conversation?'选中一段 ChatGPT 回答，然后点击「追问这段」。':'请先打开或开始一条已保存的 ChatGPT 聊天。'));items.append(e);}
      for(const n of filtered){const card=node('button','card');card.append(node('strong','',n.anchor.quote),node('span','',`${n.messages.filter(m=>m.role==='user').length} 次追问 · ${new Date(n.updatedAt).toLocaleDateString()}${ranges.some(r=>r.id===n.id)?'':' · 原文暂未定位'}`));card.onclick=()=>openNote(n.id,true);items.append(card);}
    }search.oninput=draw;draw();rebuild();
  }
  function openNote(id,scroll=false){remember();active=id;input.value=drafts.get(id)||'';panel.hidden=false;$('#back').hidden=false;form.hidden=false;renderNote();rebuild();
    if(scroll){const hit=ranges.find(x=>x.id===id);hit?.range.startContainer.parentElement?.scrollIntoView({block:'center',behavior:'smooth'});}input.focus();
  }
  function renderNote(){const n=notes.find(n=>n.id===active);if(!n){showList();return;}$('#title').textContent='围绕这段，继续聊';body.replaceChildren(node('div','quote',n.anchor.quote));
    if(!n.messages.length)body.append(node('p','hint','回答会保存在这里。发送时将包含这段原文、附近上下文和本条追问记录。'));
    for(const m of n.messages){const box=node('div','message '+m.role);box.append(node('div','role',m.role==='user'?'你':'MARGIN'),node('div','',m.content));body.append(box);}
    const pending=n.pending && Date.now()-n.pending.started<120000;
    if(pending)body.append(node('p','hint','正在理解这段文字…'));
    if(n.error || (n.pending&&!pending))body.append(node('div','error',n.error||'上次请求已中断，请重新发送问题。'));
    const del=node('button','quiet','删除这条旁注');del.onclick=async()=>{if(!confirm('删除这条旁注及其全部追问？'))return;try{await rpc('delete',{id:n.id});notes=notes.filter(x=>x.id!==n.id);drafts.delete(n.id);active=null;showList();}catch(e){toast(e.message);}};body.append(del);
    form.querySelector('button').disabled=!!pending; input.disabled=!!pending;body.scrollTop=body.scrollHeight;
  }
  async function refresh(){ const key=/^\/c\/[\w-]+/.exec(location.pathname)?.[0]||'';
    if(key!==conversation){remember();conversation=key;active=null;selectionState();panel.hidden=true;}
    const requested=conversation;
    try {const found=requested?await rpc('list',{conversation:requested}):[];if(requested!==conversation)return;notes=found;rebuild();if(!panel.hidden){if(active)renderNote();else showList();}}catch(e){toast(e.message);}
  }
  function selectionState(note=null) {
    selected=note; picker.hidden=!note;
    $('.launcher').firstChild.textContent=note?'✦ 追问选中文字 ':'✦ 旁注 ';
    $('.launcher').setAttribute('aria-label',note?'追问选中文字':'打开当前聊天的旁注');
  }
  function capture(explain=false){
    // Preserve the source selection while the user interacts with our own floating UI.
    if (document.activeElement===host) return false;
    const fail=message=>{selectionState();if(explain)toast(message);return false;};
    const sel=getSelection();if(!sel?.rangeCount||sel.isCollapsed)return fail('请先选中一段 ChatGPT 回答文字。');
    const r=sel.getRangeAt(0); const root=roots().find(x=>x.contains(r.startContainer)&&x.contains(r.endContainer));
    if(!root)return fail('尚未识别这段回答。请只选择同一条回答内的正文，或刷新页面后重试。');
    if(!conversation)return fail('先等待这条聊天保存，再添加旁注。');
    const text=root.textContent, pre=r.cloneRange();pre.selectNodeContents(root);pre.setEnd(r.startContainer,r.startOffset);
    const start=pre.toString().length,end=start+r.toString().length;
    if(!text.slice(start,end).trim()||end-start>12000)return fail('请选择 1 至 12000 字的回答内容。');
    selectionState({conversation,messageId:messageId(root),anchor:MarginCore.makeAnchor(text,start,end),context:text.slice(Math.max(0,start-3500),Math.min(text.length,end+3500)),title:document.title});
    const rect=r.getBoundingClientRect();picker.style.left=Math.max(8,Math.min(rect.left,innerWidth-155))+'px';picker.style.top=Math.max(8,Math.min(rect.bottom+8,innerHeight-55))+'px';picker.hidden=false;
    return true;
  }
  function scheduleCapture(){clearTimeout(selectionTimer);selectionTimer=setTimeout(()=>capture(),40);}
  // Capture phase survives page handlers which stop propagation of pointer/mouse events.
  for(const event of ['pointerup','mouseup'])document.addEventListener(event,e=>{if(!e.composedPath().includes(host))scheduleCapture();},true);
  document.addEventListener('selectionchange',scheduleCapture);
  document.addEventListener('keyup',e=>{if(e.key==='Shift')scheduleCapture();},true);
  async function createSelected(){if(!selected)return;const chosen=selected;selectionState();try{const n=await rpc('create',{note:chosen});if(chosen.conversation!==conversation)return;notes=notes.filter(x=>x.id!==n.id);notes.unshift(n);getSelection()?.removeAllRanges();openNote(n.id);}catch(e){toast(e.message);}}
  picker.onmousedown=e=>e.preventDefault();picker.onclick=createSelected;
  document.addEventListener('keydown',e=>{if(e.altKey&&e.shiftKey&&e.code==='KeyM'&&!e.repeat){e.preventDefault();if(capture(true))createSelected();}},true);
  document.addEventListener('click',e=>{if(e.composedPath().includes(host)||getSelection()?.toString())return;for(const hit of ranges){if([...hit.range.getClientRects()].some(r=>e.clientX>=r.left&&e.clientX<=r.right&&e.clientY>=r.top&&e.clientY<=r.bottom)){e.preventDefault();openNote(hit.id);break;}}});
  $('.launcher').onmousedown=e=>e.preventDefault();
  $('.launcher').onclick=()=>selected?createSelected():panel.hidden?showList():(remember(),panel.hidden=true);
  $('#close').onclick=()=>{remember();panel.hidden=true;};$('#back').onclick=showList;$('#settings').onclick=()=>rpc('settings').catch(e=>toast(e.message));
  shadow.addEventListener('keydown',e=>{if(e.key==='Escape'){remember();panel.hidden=true;picker.hidden=true;$('.launcher').focus();}});
  input.oninput=remember;input.onkeydown=e=>{if(e.key==='Enter'&&(e.ctrlKey||e.metaKey)){e.preventDefault();form.requestSubmit();}};
  form.onsubmit=async e=>{e.preventDefault();const question=input.value.trim(),id=active;if(!question||input.disabled)return;input.disabled=true;form.querySelector('button').disabled=true;drafts.set(id,'');input.value='';
    try{await rpc('ask',{id,question});await refresh();}catch(err){drafts.set(id,question);if(active===id)input.value=question;toast(err.message);await refresh();}
  };
  chrome.storage.onChanged.addListener((changes,area)=>{if(area==='local'&&Object.keys(changes).some(k=>k.startsWith('margin.note.')))refresh();});
  new MutationObserver(()=>{clearTimeout(refreshTimer);refreshTimer=setTimeout(rebuild,250);}).observe(document.body,{childList:true,subtree:true,characterData:true});
  setInterval(()=>{const key=/^\/c\/[\w-]+/.exec(location.pathname)?.[0]||'';if(key!==conversation)refresh();else if(active&&notes.find(n=>n.id===active)?.pending)renderNote();},1000);
  refresh();
})();
