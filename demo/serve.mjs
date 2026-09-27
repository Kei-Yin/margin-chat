import http from 'node:http';
import {readFile} from 'node:fs/promises';
const allowed=new Set(['/demo/shim.js','/demo/stop-events.js','/demo/selection-regression.html','/extension/core.js','/extension/background.js','/extension/content.js','/extension/highlight.css']);
http.createServer(async(req,res)=>{const p=new URL(req.url,'http://localhost').pathname;
  if(p==='/'){res.writeHead(302,{Location:'/c/demo'});return res.end();}
  const file=p==='/c/selection-regression'?'/demo/selection-regression.html':p.startsWith('/c/')?'/demo/index.html':p;
  if(file!=='/demo/index.html'&&!allowed.has(file)){res.writeHead(404);return res.end();}
  const ext=file.split('.').pop();res.setHeader('Content-Type',({html:'text/html; charset=utf-8',js:'text/javascript; charset=utf-8',css:'text/css; charset=utf-8'})[ext]);res.setHeader('Cache-Control','no-store');
  try{res.end(await readFile(new URL('..'+file,import.meta.url)));}catch{res.writeHead(500);res.end();}
}).listen(43128,'127.0.0.1',()=>console.log('Demo: http://127.0.0.1:43128/c/demo'));
