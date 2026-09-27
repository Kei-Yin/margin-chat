import http from 'node:http';
import {randomBytes,timingSafeEqual} from 'node:crypto';
import {generate,buildRequest} from './api.mjs';
const token=process.env.MARGIN_TOKEN||randomBytes(24).toString('hex');
const key=process.env.OPENAI_API_KEY,model=process.env.OPENAI_MODEL;
let busy=0;
const server=http.createServer(async(req,res)=>{
  const send=(status,data)=>{res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});res.end(JSON.stringify(data));};
  // Only browser extension origins may use CORS. Plain web origins are refused.
  const origin=req.headers.origin;
  if(origin&&!/^chrome-extension:\/\/[a-p]{32}$/.test(origin))return send(403,{error:'不允许的请求来源。'});
  if(req.headers.host!=='127.0.0.1:43127')return send(403,{error:'不允许的主机。'});
  if(origin){res.setHeader('Access-Control-Allow-Origin',origin);res.setHeader('Vary','Origin');}
  if(req.method==='OPTIONS'){res.setHeader('Access-Control-Allow-Headers','Authorization, Content-Type');res.setHeader('Access-Control-Allow-Methods','GET, POST');res.writeHead(204);res.end();return;}
  const given=Buffer.from(req.headers.authorization||''),expected=Buffer.from('Bearer '+token);
  if(given.length!==expected.length||!timingSafeEqual(given,expected))return send(401,{error:'配对码不正确，请复制本机服务显示的配对码。'});
  if(req.method==='GET'&&req.url==='/health')return send(200,{ready:!!(key&&model)});
  if(req.method!=='POST'||req.url!=='/ask')return send(404,{error:'接口不存在。'});
  if(!key||!model)return send(503,{error:'请在 .env 中配置 OPENAI_API_KEY 和 OPENAI_MODEL，然后重启本机服务。'});
  if(busy>=3)return send(429,{error:'已有 3 个请求在处理，请稍后再试。'});
  busy++;
  try{let raw='';for await(const chunk of req){raw+=chunk;if(Buffer.byteLength(raw)>300000){send(413,{error:'追问记录过长，请新建批注。'});return;}}
    let body;try{body=JSON.parse(raw);buildRequest(body,model);}catch(e){return send(400,{error:e.message});}
    send(200,await generate(body,{key,model}));
  }catch(e){send(e.status||502,{error:e.name==='TimeoutError'?'OpenAI 请求超时，请稍后重试。':e.message==='fetch failed'?'无法连接 OpenAI，请检查本机网络。':e.message});}finally{busy--;}
});
server.requestTimeout=100000;
server.listen(43127,'127.0.0.1',()=>{console.log('Margin 本机服务：http://127.0.0.1:43127\n配对码（粘贴到扩展设置）：'+token+'\nAPI 配置：'+(key&&model?'已配置':'未配置；请编辑 .env 后重启'));});
server.on('error',e=>{console.error(e.code==='EADDRINUSE'?'43127 端口已被占用，请检查是否已经启动 Margin 服务。':e.message);process.exitCode=1;});
