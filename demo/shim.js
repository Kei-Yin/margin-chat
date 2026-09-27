// Only loaded by the local demo. The production extension never imports this file.
globalThis.importScripts=()=>{};
const listeners=[];let handler;
const read=()=>JSON.parse(localStorage.getItem('margin-demo')||'{"settings":{"demo":true}}');
globalThis.chrome={runtime:{id:'margin-demo',onMessage:{addListener(fn){handler=fn;}},sendMessage(message){return new Promise(resolve=>handler(message,{id:'margin-demo'},resolve));},async openOptionsPage(){alert('这是演示页。真实扩展可通过浏览器工具栏图标打开设置。');}},storage:{onChanged:{addListener(fn){listeners.push(fn);}},local:{async get(key){const all=read();return key?{[key]:all[key]}:all;},async set(values){const all=read();Object.assign(all,values);localStorage.setItem('margin-demo',JSON.stringify(all));for(const fn of listeners)fn(values,'local');},async remove(key){const all=read();delete all[key];localStorage.setItem('margin-demo',JSON.stringify(all));for(const fn of listeners)fn({[key]:{}},'local');}}}};
