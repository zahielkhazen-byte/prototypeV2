// Codespaces adapter for the same Worker used by the hosted version.
import http from 'node:http';
import {Readable} from 'node:stream';
import './build.mjs';
import worker from './dist/server/index.js';
import {randomBytes} from 'node:crypto';
const records=new Map();
const bucket={
 async put(key,data,opts={}){const bytes=await new Response(data).arrayBuffer();records.set(key,{bytes,customMetadata:opts.customMetadata})},
 async get(key){const r=records.get(key);if(!r)return null;return {body:r.bytes,json:()=>new Response(r.bytes).json()}},
 async head(key){return records.has(key)?{}:null},async delete(key){records.delete(key)},
 async list({prefix,startAfter='',limit=1000,cursor=''}){const keys=[...records.keys()].filter(k=>k.startsWith(prefix)&&k>startAfter&&k>cursor).sort(),page=keys.slice(0,limit);
 return {objects:page.map(key=>({key,customMetadata:records.get(key).customMetadata})),truncated:keys.length>limit,cursor:page.at(-1)}}
};
const port=Number(process.env.PORT||8000);
http.createServer(async(req,res)=>{
 try{const input=new Request('http://localhost'+req.url,{method:req.method,headers:req.headers,body:['GET','HEAD'].includes(req.method)?undefined:Readable.toWeb(req),duplex:'half'});
 const out=await worker.fetch(input,{BUCKET:bucket});if(input.body&&!input.bodyUsed)await input.arrayBuffer();res.writeHead(out.status,Object.fromEntries(out.headers));if(out.body)Readable.fromWeb(out.body).pipe(res);else res.end()}catch{res.writeHead(500);res.end()}
}).listen(port,()=>{const host=process.env.CODESPACE_NAME?'https://'+process.env.CODESPACE_NAME+'-'+port+'.'+(process.env.GITHUB_CODESPACES_PORT_FORWARDING_DOMAIN||'app.github.dev'):'http://localhost:'+port;console.log('Moderator link (keep private): '+host+'/#mod='+randomBytes(32).toString('hex'))});
