importScripts('core.js');
const STORE = 'margin.note.';
let queue = Promise.resolve();
function serial(fn) { const job = queue.then(fn); queue = job.catch(() => {}); return job; }
async function list(conversation) {
  const all = await chrome.storage.local.get(null);
  return Object.entries(all).filter(([key,n]) => key.startsWith(STORE) && (!conversation || n.conversation === conversation))
    .map(([,n]) => n).sort((a,b) => b.updatedAt - a.updatedAt);
}
async function get(id) { return (await chrome.storage.local.get(STORE+id))[STORE+id]; }
async function put(note) { await chrome.storage.local.set({[STORE+note.id]: note}); return note; }
async function ask(id, question) {
  if (typeof question !== 'string' || !question.trim() || question.length > 6000) throw Error('问题不能为空，且不能超过 6000 字。');
  const requestId = crypto.randomUUID();
  const note = await serial(async () => {
    const n = await get(id);
    if (!n) throw Error('批注已被删除。');
    if (n.pending && Date.now() - n.pending.started < 120000) throw Error('这条批注正在生成回答。');
    n.pending = {id: requestId, started: Date.now()}; n.error = '';
    n.messages.push({role: 'user', content: question.trim()}); n.updatedAt = Date.now();
    return put(n);
  });
  try {
    const {settings = {}} = await chrome.storage.local.get('settings');
    let answer;
    if (settings.mode==='demo' || (!settings.mode&&settings.demo)) {
      answer = '【演示内容 · 非 AI 回答】\n\n你选中了：“'+note.anchor.quote+'”\n\n这里会显示针对这段原文的解释。你可以继续追问、关闭浮窗，再点击高亮回看。\n\n要获得真实回答，请在扩展设置中关闭演示模式，并连接本机 API 服务。';
    } else {
      if (!settings.token) throw Error('请先点击扩展图标，填写本机服务配对码，或开启演示模式。');
      const res = await fetch('http://127.0.0.1:43127/ask', {
        method:'POST', headers:{'Content-Type':'application/json','Authorization':'Bearer '+settings.token},
        body:JSON.stringify({quote:note.anchor.quote, context:note.context, messages:note.messages}),
        signal:AbortSignal.timeout(25000)
      });
      const data = await res.json();
      if (!res.ok) throw Error(data.error || '请求失败，请检查本机服务。');
      answer = data.text;
    }
    return serial(async () => {
      const current = await get(id);
      if (!current || current.pending?.id !== requestId) return current;
      current.messages.push({role:'assistant',content:answer}); current.pending = null;
      current.updatedAt = Date.now(); return put(current);
    });
  } catch(e) {
    return serial(async () => {
      const current = await get(id);
      if (!current || current.pending?.id !== requestId) return current;
      current.pending = null;
      current.error = e.name === 'TimeoutError' ? '回答超时。问题已保存，可以重试。' : e.message === 'Failed to fetch' ? '无法连接本机服务。请在项目目录运行 npm start。' : e.message;
      return put(current);
    });
  }
}
chrome.runtime.onMessage.addListener((msg,sender,reply) => {
  if (sender.id !== chrome.runtime.id) return;
  (async () => {
    if (msg.type === 'list') return list(msg.conversation);
    if (msg.type === 'create') return serial(async () => {
      const n = msg.note;
      if (!n?.anchor?.quote || n.anchor.quote.length > 12000 || !/^\/c\/[\w-]+$/.test(n.conversation)) throw Error('请在已保存的聊天中选择文字（最多 12000 字）。');
      return put({...n,id:crypto.randomUUID(),color:'yellow',webTurns:[],messages:[],pending:null,error:'',createdAt:Date.now(),updatedAt:Date.now()});
    });
    if (msg.type === 'webBegin') return serial(async()=>{
      const n=await get(msg.id);if(!n)throw Error('批注已删除。');
      if(typeof msg.question!=='string'||!msg.question.trim()||msg.question.length>6000||typeof msg.prompt!=='string'||msg.prompt.length>200000)throw Error('追问格式不正确。');
      const all=await list(n.conversation);
      if(all.some(x=>(x.webTurns||[]).some(t=>['waiting','prepared'].includes(t.status)&&Date.now()-t.started<600000)))throw Error('这条聊天还有旁注在等待回答，请先完成或结束等待。');
      const id=crypto.randomUUID(),marker=msg.marker;
      if(!/^\[Margin:[a-f0-9-]{36}\]$/.test(marker)||!msg.prompt.startsWith(marker))throw Error('追问标记不正确。');
      n.webTurns??=[];n.webTurns.push({id,marker,prompt:msg.prompt,question:msg.question,status:'prepared',started:Date.now()});
      n.messages.push({role:'user',content:msg.question,exchangeId:id});n.error='';n.updatedAt=Date.now();
      await put(n);return {note:n,exchange:n.webTurns.at(-1)};
    });
    if (msg.type === 'webUpdate' || msg.type === 'webCollect') return serial(async()=>{
      const n=await get(msg.id);if(!n)return null;
      const ex=n.webTurns?.find(x=>x.id===msg.exchangeId);if(!ex)return n;
      if(ex.status==='complete')return n;
      if(['cancelled','failed'].includes(ex.status)&&msg.type!=='webCollect')return n;
      if(msg.type==='webCollect'&&msg.status!=='complete')throw Error('仅支持收录已完成回答。');
      if(msg.status==='complete'){
        if(typeof msg.answer!=='string'||!msg.answer.trim()||msg.answer.length>250000)throw Error('回答为空或过长，原始问答会保留。');
        ex.answer=msg.answer;ex.status='complete';
        const index=n.messages.findIndex(m=>m.role==='user'&&m.exchangeId===ex.id);
        n.messages.splice(index<0?n.messages.length:index+1,0,{role:'assistant',content:msg.answer,exchangeId:ex.id});n.error='';
      }else if(['waiting','failed','cancelled'].includes(msg.status)){
        ex.status=msg.status;n.error=String(msg.error||'').slice(0,1000);
      }else throw Error('状态不正确。');
      n.updatedAt=Date.now();return put(n);
    });
    if (msg.type === 'ask') return ask(msg.id,msg.question);
    if (msg.type === 'delete') return serial(() => chrome.storage.local.remove(STORE+msg.id));
    if (msg.type === 'settings') return chrome.runtime.openOptionsPage();
    throw Error('未知操作');
  })().then(data => reply({ok:true,data}), e => reply({ok:false,error:e.message}));
  return true;
});
