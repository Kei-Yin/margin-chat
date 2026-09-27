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
    .panel{position:fixed;right:24px;bottom:84px;width:440px;max-width:calc(100vw - 24px);height:650px;max-height:calc(100dvh - 108px);background:#fcfbf7;border:1px solid #dce1d8;border-radius:20px;box-shadow:0 16px 70px #122a2630;z-index:2147483647;display:flex;flex-direction:column;overflow:hidden}
    .resize{position:absolute;right:0;bottom:0;width:24px;height:24px;cursor:nwse-resize;touch-action:none;color:#789783;background:transparent;z-index:2}header{cursor:move;touch-action:none;user-select:none}.launcher{touch-action:none;cursor:grab}.body{min-height:0}header,.composer{flex-shrink:0}
    [hidden]{display:none!important}header{display:flex;align-items:center;gap:10px;padding:18px 20px;border-bottom:1px solid #e4e7df}header strong{font-size:17px;flex:1}header button,.quiet{background:transparent;color:#53645b;padding:5px 7px;border-radius:7px}.eyebrow{font-size:10px;letter-spacing:2px;color:#6c8074}.body{flex:1;overflow:auto;padding:20px;overscroll-behavior:contain}.quote{border-left:3px solid #e8c751;background:#f7f0d7;padding:12px 14px;border-radius:0 8px 8px 0;white-space:pre-wrap;overflow-wrap:anywhere;max-height:130px;overflow:auto;margin-bottom:18px}.hint{color:#758278;font-size:12px}.empty{padding:28px 5px;color:#6a7a70}.empty b{display:block;font-size:20px;color:#2b4d3e;margin:10px 0}.message{margin:18px 0;white-space:pre-wrap;overflow-wrap:anywhere}.message.user{background:#eaf0e8;border-radius:12px;padding:12px}.role{font-size:11px;color:#7b877d;margin-bottom:4px;letter-spacing:1px}.error{color:#9b422c;background:#f9e9df;padding:10px;border-radius:8px;font-size:12px;white-space:pre-wrap}.composer{padding:14px 18px 18px;border-top:1px solid #e4e7df}textarea{width:100%;resize:none;background:#fff;border:1px solid #d9dfd5;border-radius:10px;padding:10px;color:#23352f;min-height:74px}.foot{display:flex;align-items:center;justify-content:space-between;margin-top:9px}.primary{background:#254e40;color:#fff;border-radius:9px;padding:8px 15px}.card{display:block;width:100%;text-align:left;background:white;border:1px solid #e0e4da;border-radius:12px;padding:14px;margin:10px 0;color:#304839}.card:hover{border-color:#b4c2ae}.card strong{display:block;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.card span{font-size:12px;color:#7a877c}.search{width:100%;border:1px solid #d9dfd5;border-radius:9px;background:white;padding:9px;color:#23352f}.toast{position:fixed;bottom:90px;left:50%;transform:translateX(-50%);background:#263e34;color:white;border-radius:10px;padding:12px 20px;z-index:2147483647;max-width:90vw}
    @media(max-width:500px){.panel{right:12px;bottom:76px}.launcher{right:12px;bottom:18px}}
  </style>
  <button class="launcher" aria-label="打开当前聊天的旁注">✦ 旁注 <span id="count">0</span></button>
  <button class="pick" hidden>✦ 追问这段</button>
  <section class="panel" hidden role="dialog" aria-label="Margin 旁注">
    <button class="resize" aria-label="调整窗口大小" title="拖动右下角调整大小；方向键也可调整">◢</button>
    <header title="拖动标题栏移动窗口"><button id="back" aria-label="返回旁注列表">←</button><div><div class="eyebrow">MARGIN / 旁注 · 0.2.6</div><strong id="title">留住每一次理解</strong></div><div style="flex:1"></div><button id="settings" aria-label="设置">⚙</button><button id="close" aria-label="关闭旁注">✕</button></header>
    <div style="padding:8px 18px;border-bottom:1px solid #e4e7df"><button id="ask-selection" class="primary">追问当前选区</button> <button id="diagnose" class="quiet">检查选区</button><div id="diagnostics" class="hint" role="status" style="white-space:pre-wrap;overflow-wrap:anywhere"></div></div>
    <div class="body"></div><form class="composer" hidden><textarea maxlength="6000" placeholder="这段哪里不明白？试着问一个问题…" aria-label="你的追问"></textarea><div class="foot"><span class="hint">Ctrl / ⌘ + Enter 发送</span><button class="primary" type="submit">发送 ↗</button></div></form>
  </section><div class="toast" role="status" hidden></div>`;
  const $ = s => shadow.querySelector(s);
  const panel = $('.panel'), body = $('.body'), picker = $('.pick'), form = $('form'), input = $('textarea');
  let conversation = '', notes = [], active = null, selected = null, ranges = [], refreshTimer, toastTimer, selectionTimer;
  const drafts = new Map();
  const observed = new Map();
  let reconciling=false;
  function mode(settings){return settings?.mode||'web';}
  function place(el,x,y){const r=el.getBoundingClientRect();el.style.left=Math.max(8,Math.min(innerWidth-r.width-8,x))+'px';el.style.top=Math.max(8,Math.min(innerHeight-r.height-8,y))+'px';el.style.right='auto';el.style.bottom='auto';}
  function setSize(width,height){panel.style.width=Math.min(Math.max(320,width),innerWidth-24)+'px';panel.style.height=Math.min(Math.max(350,height),innerHeight-24)+'px';if(panel.style.left&&!panel.hidden){const r=panel.getBoundingClientRect();place(panel,r.left,r.top);}}
  chrome.storage.local.get('panelSize').then(({panelSize:s})=>{if(s)setSize(s.width,s.height);}).catch(()=>{});
  function saveSize(){const r=panel.getBoundingClientRect();chrome.storage.local.set({panelSize:{width:r.width,height:r.height}}).catch(e=>toast(e.message));}
  $('.resize').onpointerdown=e=>{e.preventDefault();const r=panel.getBoundingClientRect();place(panel,r.left,r.top);const start={x:e.clientX,y:e.clientY,w:r.width,h:r.height};const handle=e.currentTarget;handle.setPointerCapture(e.pointerId);
    handle.onpointermove=e=>setSize(start.w+e.clientX-start.x,start.h+e.clientY-start.y);
    handle.onpointerup=()=>{handle.onpointermove=null;saveSize();savePosition(panel,'panelPosition');};handle.onpointercancel=()=>{handle.onpointermove=null;saveSize();savePosition(panel,'panelPosition');};
  };
  $('.resize').onkeydown=e=>{if(!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(e.key))return;e.preventDefault();setSize(panel.offsetWidth+(e.key==='ArrowLeft'?20:e.key==='ArrowRight'?-20:0),panel.offsetHeight+(e.key==='ArrowUp'?20:e.key==='ArrowDown'?-20:0));saveSize();};
  function savePosition(el,key){const r=el.getBoundingClientRect();chrome.storage.local.set({[key]:{x:r.left,y:r.top}}).catch(e=>toast(e.message));}
  function draggable(handle,el,key){let suppress=false;
    handle.addEventListener('click',e=>{if(suppress){e.preventDefault();e.stopImmediatePropagation();suppress=false;}},true);
    handle.addEventListener('pointerdown',e=>{if(e.button!==0||(handle!==el&&e.target.closest('button')))return;
      suppress=false;const r=el.getBoundingClientRect(),x=e.clientX,y=e.clientY;let moved=false;handle.setPointerCapture(e.pointerId);
      handle.onpointermove=ev=>{if(!moved&&Math.hypot(ev.clientX-x,ev.clientY-y)<5)return;moved=true;ev.preventDefault();place(el,r.left+ev.clientX-x,r.top+ev.clientY-y);};
      const end=()=>{handle.onpointermove=null;suppress=moved;if(moved)savePosition(el,key);};handle.onpointerup=end;handle.onpointercancel=end;
    });
  }
  draggable($('.launcher'),$('.launcher'),'launcherPosition');draggable($('header'),panel,'panelPosition');
  chrome.storage.local.get(['launcherPosition','panelPosition']).then(saved=>{for(const [key,el] of [['launcherPosition',$('.launcher')],['panelPosition',panel]]){const p=saved[key];if(p&&Number.isFinite(p.x)&&Number.isFinite(p.y)){el.style.left=Math.max(8,Math.min(innerWidth-80,p.x))+'px';el.style.top=Math.max(8,Math.min(innerHeight-60,p.y))+'px';el.style.right='auto';el.style.bottom='auto';if(!el.hidden)place(el,p.x,p.y);}}}).catch(()=>{});
  new ResizeObserver(()=>{if(!panel.hidden&&panel.style.left){const r=panel.getBoundingClientRect();place(panel,r.left,r.top);}}).observe(panel);
  window.addEventListener('resize',()=>{for(const el of [panel,$('.launcher')])if(!el.hidden){const r=el.getBoundingClientRect();place(el,r.left,r.top);}});
  async function rpc(type, data={}) { const r = await chrome.runtime.sendMessage({type,...data}); if (!r?.ok) throw Error(r?.error || '扩展连接已失效，请刷新页面。'); return r.data; }
  function toast(text) { $('.toast').textContent=text; $('.toast').hidden=false; clearTimeout(toastTimer); toastTimer=setTimeout(()=>$('.toast').hidden=true,4500); }
  function node(tag, cls, text) { const n=document.createElement(tag); if(cls)n.className=cls; if(text!==undefined)n.textContent=text; return n; }
  function roots() {
    // A reply can have several Markdown blocks; never assume only the first one is the answer.
    const candidates = new Set();
    const bodySelector = '.markdown, .prose, [class^="MarkdownRoot-"], [class*=" MarkdownRoot-"]';
    for (const message of document.querySelectorAll('[data-message-author-role="assistant"]')) {
      const blocks = message.querySelectorAll(bodySelector);
      for (const block of blocks.length ? blocks : [message]) candidates.add(block);
    }
    // Some ChatGPT layouts omit the author attribute on the rendered answer.
    for (const block of document.querySelectorAll('main .markdown, main .prose, [role="main"] .markdown, [role="main"] .prose')) candidates.add(block);
    // Observed in the user's ChatGPT DOM: CSS-module MarkdownRoot-* without author metadata.
    // Match a class token prefix, not an arbitrary substring or a build-specific hash.
    for (const block of document.querySelectorAll('[class^="MarkdownRoot-"], [class*=" MarkdownRoot-"]')) candidates.add(block);
    const safe = [...candidates].filter(n => !n.closest('[data-message-author-role="user"], textarea, input, [contenteditable="true"], #margin-root'));
    return safe.filter(n => !safe.some(other => other !== n && other.contains(n)));
  }
  function messageId(root) { return root.closest('[data-message-id]')?.getAttribute('data-message-id') || root.querySelector('[data-message-id]')?.getAttribute('data-message-id') || root.closest('[data-chatgpt-selection-message-id]')?.getAttribute('data-chatgpt-selection-message-id') || ''; }
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
    MarginWeb.restoreFolds(notes,id=>openNote(id));
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
    if(!n.messages.length)body.append(node('p','hint','默认通过当前 ChatGPT 聊天发送，沿用网页会话的额度。问答实际保留在主聊天中，完成后由插件折叠。'));
    for(const m of n.messages){const box=node('div','message '+m.role);box.append(node('div','role',m.role==='user'?'你':'MARGIN'),node('div','',m.content));body.append(box);}
    const webPending=n.webTurns?.find(t=>['prepared','waiting'].includes(t.status));
    const pending=(n.pending && Date.now()-n.pending.started<120000)||webPending;
    if(pending)body.append(node('p','hint',webPending?'等待网页发送或回答完成；请勿重复提交。':'正在生成回答…'));
    if(n.error || (n.pending&&!pending))body.append(node('div','error',n.error||'上次请求已中断，请重新发送问题。'));
    if(webPending){
      const pair=MarginWeb.findPair(webPending);
      const phase=node('p','hint',phaseText(pair));phase.id='web-phase';body.append(phase);
      const collect=node('button','quiet','回答已完成，手动收进旁注');collect.onclick=async()=>{const pair=MarginWeb.findPair(webPending);if(!pair?.text||MarginWeb.generating()){toast('尚未找到已完成的对应回答，请等待网页生成结束。');return;}try{await rpc('webUpdate',{id:n.id,exchangeId:webPending.id,status:'complete',answer:pair.text});}catch(e){toast(e.message);}};body.append(collect);
      const cancel=node('button','quiet','结束等待（保留网页原始问答）');cancel.onclick=async()=>{try{await rpc('webUpdate',{id:n.id,exchangeId:webPending.id,status:'cancelled',error:'已结束自动等待，原始问答保留在主聊天。'});}catch(e){toast(e.message);}};body.append(cancel);
      body.append(node('p','hint','刷新后会恢复等待，不会自动重发。如果网页中没有发送，请检查主输入框；如果发送过，不要重复点击。'));
    }
    for(const ex of n.webTurns||[]){
      if(!['cancelled','failed'].includes(ex.status))continue;
      const recover=node('button','quiet','收录已完成的网页回答：'+ex.question.slice(0,35));
      recover.onclick=async()=>{const pair=MarginWeb.findPair(ex);if(!pair?.text||MarginWeb.generating()){toast('尚未定位对应的完整回答。请滚动加载这组网页问答，等生成结束后重试。');return;}
        try{await rpc('webCollect',{id:n.id,exchangeId:ex.id,status:'complete',answer:pair.text});await refresh();}catch(e){toast(e.message);}};
      body.append(recover);
    }
    for(const ex of n.webTurns||[]){
      if(ex.status==='complete')continue;
      const importSelection=node('button','quiet','收录选中的回答文字：'+ex.question.slice(0,35));
      importSelection.onmousedown=e=>e.preventDefault();
      importSelection.onclick=async()=>{
        const sel=getSelection(),range=sel?.rangeCount?sel.getRangeAt(0):null;
        if(!range||sel.isCollapsed||!roots().some(root=>root.contains(range.startContainer)&&root.contains(range.endContainer))){toast('请先在网页回答正文中选中要保存的文字，再点击此按钮。');return;}
        const answer=range.toString().trim();if(!answer||answer.length>250000){toast('请选择 1 至 250000 字的回答正文。');return;}
        if(MarginWeb.generating()){toast('请等待网页回答生成结束后再收录。');return;}
        try{await rpc('webCollect',{id:n.id,exchangeId:ex.id,status:'complete',answer});getSelection()?.removeAllRanges();selectionState();await refresh();toast('已保存选中文字；只有自动关联完全匹配时才折叠网页原始问答。');}catch(e){toast(e.message);}
      };
      body.append(importSelection);
    }
    const del=node('button','quiet','删除这条旁注');del.onclick=async()=>{if(!confirm('删除这条旁注及其全部追问？'))return;try{await rpc('delete',{id:n.id});notes=notes.filter(x=>x.id!==n.id);drafts.delete(n.id);active=null;showList();}catch(e){toast(e.message);}};body.append(del);
    form.querySelector('button').disabled=!!pending; input.disabled=!!pending;body.scrollTop=body.scrollHeight;
  }
  async function refresh(){ const key=MarginCore.conversationKey(location.pathname);
    if(key!==conversation){remember();MarginWeb.clearFolds();observed.clear();conversation=key;active=null;selectionState();panel.hidden=true;}
    const requested=conversation;
    try {const found=requested?await rpc('list',{conversation:requested}):[];if(requested!==conversation)return;notes=found;rebuild();if(!panel.hidden){if(active)renderNote();else showList();}}catch(e){toast(e.message);}
  }
  function selectionState(note=null) {
    selected=note; picker.hidden=!note;
    $('.launcher').firstChild.textContent=note?'✦ 追问选中文字 ':'✦ 旁注 ';
    $('.launcher').setAttribute('aria-label',note?'追问选中文字':'打开当前聊天的旁注');
  }
  function capture(explain=false){
    // Focus can remain in the panel even after the user selects non-focusable page text.
    // Only ignore selections actually inside our shadow root, not all host focus.
    if (getSelection()?.anchorNode?.getRootNode()===shadow) return false;
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
  $('#ask-selection').onmousedown=e=>e.preventDefault();
  $('#ask-selection').onclick=()=>{if(capture(true))createSelected();};
  $('#diagnose').onmousedown=e=>e.preventDefault();
  $('#diagnose').onclick=()=>{
    const sel=getSelection(),r=sel?.rangeCount?sel.getRangeAt(0):null,all=roots();
    let el=r?.startContainer; if(el?.nodeType===3)el=el.parentElement;
    const path=[];
    for(let i=0;el&&i<5;i++,el=el.parentElement)path.push(el.tagName.toLowerCase()+Array.from(el.classList||[]).slice(0,3).map(c=>'.'+c).join(''));
    $('#diagnostics').textContent=`版本 0.2.6 · 正文区块 ${all.length} · 选中字数 ${sel?.toString().length||0}\n选区匹配：${r&&all.some(x=>x.contains(r.startContainer)&&x.contains(r.endContainer))?'是':'否'} · 聊天路径：${conversation?'已识别':'未识别'}\n结构：${path.join(' > ')||'无选区'}`;
    $('#diagnostics').textContent+='\n'+MarginWeb.diagnostics();
    $('#diagnostics').style.cssText='white-space:pre-wrap;overflow-wrap:anywhere;max-height:230px;overflow:auto;user-select:text';
  };
  document.addEventListener('keydown',e=>{if(e.altKey&&e.shiftKey&&e.code==='KeyM'&&!e.repeat){e.preventDefault();if(capture(true))createSelected();}},true);
  document.addEventListener('click',e=>{if(e.composedPath().includes(host)||getSelection()?.toString())return;for(const hit of ranges){if([...hit.range.getClientRects()].some(r=>e.clientX>=r.left&&e.clientX<=r.right&&e.clientY>=r.top&&e.clientY<=r.bottom)){e.preventDefault();openNote(hit.id);break;}}});
  $('.launcher').onmousedown=e=>e.preventDefault();
  $('.launcher').onclick=()=>selected?createSelected():panel.hidden?showList():(remember(),panel.hidden=true);
  $('#close').onclick=()=>{remember();panel.hidden=true;};$('#back').onclick=showList;$('#settings').onclick=()=>rpc('settings').catch(e=>toast(e.message));
  shadow.addEventListener('keydown',e=>{if(e.key==='Escape'){remember();panel.hidden=true;picker.hidden=true;$('.launcher').focus();}});
  input.oninput=remember;input.onkeydown=e=>{if(e.key==='Enter'&&(e.ctrlKey||e.metaKey)){e.preventDefault();form.requestSubmit();}};
  form.onsubmit=async e=>{e.preventDefault();const question=input.value.trim(),id=active;if(!question||input.disabled)return;input.disabled=true;form.querySelector('button').disabled=true;drafts.set(id,'');input.value='';
    try{
      const {settings={}}=await chrome.storage.local.get('settings');
      if(mode(settings)==='web'){
        const note=notes.find(n=>n.id===id);MarginWeb.checkReady();
        const marker='[Margin:'+crypto.randomUUID()+']';
        const prompt=MarginWeb.makePrompt(note,question,marker);
        const started=await rpc('webBegin',{id,question,prompt,marker});
        try{if(MarginCore.conversationKey(location.pathname)!==note.conversation)throw Error('聊天已切换，未发送追问。');await MarginWeb.send(prompt);await rpc('webUpdate',{id,exchangeId:started.exchange.id,status:'waiting'});}
        catch(err){await rpc('webUpdate',{id,exchangeId:started.exchange.id,status:'waiting',error:err.message});toast(err.message);$('#diagnose').onclick();}
      }else await rpc('ask',{id,question});
      await refresh();
    }catch(err){drafts.set(id,question);if(active===id)input.value=question;toast(err.message);$('#diagnose').onclick();await refresh();}
  };
  function phaseText(pair){return !pair?'尚未定位已发送的问题。':!pair.assistant?'已定位问题，等待对应回答。':MarginWeb.generating()?'已定位回答，网页仍在生成。':MarginWeb.hasCompletionSignal(pair)?'已定位回答，等待内容稳定后收录。':'已定位回答，但未识别完成标记；确认网页回答结束后可手动收录。';}
  async function reconcile(){
    if(reconciling)return;reconciling=true;
    try{for(const note of notes)for(const ex of note.webTurns||[]){
      if(!['prepared','waiting'].includes(ex.status))continue;
      const pair=MarginWeb.findPair(ex);
      if(active===note.id&&$('#web-phase')){const text=phaseText(pair);if($('#web-phase').textContent!==text)$('#web-phase').textContent=text;}
      const busy=MarginWeb.generating();
      const track=observed.get(ex.id)||{text:'',since:Date.now(),sawBusy:false};
      if(busy)track.sawBusy=true;
      observed.set(ex.id,track);
      if(pair?.assistant&&pair.text){
        const last=observed.get(ex.id);
        if(last.text!==pair.text){observed.set(ex.id,{...last,text:pair.text,since:Date.now()});continue;}
        if(!busy&&(last.sawBusy||MarginWeb.hasCompletionSignal(pair))&&Date.now()-last.since>=3000){
          await rpc('webUpdate',{id:note.id,exchangeId:ex.id,status:'complete',answer:pair.text});observed.delete(ex.id);continue;
        }
      }
      if(Date.now()-ex.started>600000)await rpc('webUpdate',{id:note.id,exchangeId:ex.id,status:'failed',error:'等待超过 10 分钟，未自动折叠。请检查网页原始问答。'});
    }}catch(e){toast(e.message);}finally{reconciling=false;}
  }
  chrome.storage.onChanged.addListener((changes,area)=>{if(area==='local'&&Object.keys(changes).some(k=>k.startsWith('margin.note.')))refresh();});
  new MutationObserver(()=>{clearTimeout(refreshTimer);refreshTimer=setTimeout(rebuild,250);}).observe(document.body,{childList:true,subtree:true,characterData:true});
  setInterval(()=>{const key=MarginCore.conversationKey(location.pathname);if(key!==conversation)refresh();else reconcile();},1000);
  refresh();
})();
