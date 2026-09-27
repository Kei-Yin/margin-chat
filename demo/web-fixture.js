const turnBox=document.getElementById('turns');let chatInput=document.getElementById('prompt-textarea');
if(new URLSearchParams(location.search).get('editor')==='rich'){const rich=document.createElement('div');rich.id='prompt-textarea';rich.contentEditable='true';rich.setAttribute('role','textbox');rich.setAttribute('aria-label','模拟 ChatGPT 输入框');rich.style.cssText='border:1px solid gray;min-height:90px;background:white';chatInput.replaceWith(rich);chatInput=rich;}
let fixtureTurns=JSON.parse(localStorage.getItem('margin-fixture-turns')||'[]');
function appendTurn(role,text){const a=document.createElement('article');a.dataset.testid='conversation-turn-'+(turnBox.children.length);a.dataset.messageAuthorRole=role;if(role==='assistant')a.dataset.messageStatus='finished';const d=document.createElement('div');if(role==='assistant')d.className='MarkdownRoot-fixture';d.textContent=text;a.append(d);turnBox.append(a);return d;}
for(const t of fixtureTurns)appendTurn(t.role,t.text);
document.getElementById('chat-form').onsubmit=e=>{e.preventDefault();const prompt=chatInput.value??chatInput.innerText;if(!prompt.trim())return;appendTurn('user',prompt);fixtureTurns.push({role:'user',text:prompt});if(chatInput.tagName==='TEXTAREA')chatInput.value='';else chatInput.textContent='';
  const send=document.querySelector('[data-testid="send-button"]');send.disabled=true;const stop=document.createElement('button');stop.dataset.testid='stop-button';stop.textContent='正在模拟生成…';document.getElementById('chat-form').append(stop);
  const answer=appendTurn('assistant','模拟回答生成中…');
  setTimeout(()=>{answer.textContent='【网页会话模拟回答】梯度指向函数增长最快的方向，所以沿反方向移动可以逐步降低误差。这组真实 DOM 消息会被收进原文旁注。';fixtureTurns.push({role:'assistant',text:answer.textContent});localStorage.setItem('margin-fixture-turns',JSON.stringify(fixtureTurns));stop.remove();send.disabled=false;},1500);
};
document.getElementById('seed-draft').onclick=()=>{if(chatInput.tagName==='TEXTAREA')chatInput.value='这是不能被覆盖的主聊天草稿';else chatInput.textContent='这是不能被覆盖的主聊天草稿';};
document.getElementById('regenerate').onclick=()=>{const last=turnBox.lastElementChild;if(last?.dataset.messageAuthorRole==='assistant'){last.querySelector('div').textContent='这是重新生成后的不同回答，应该保持可见。';}};
