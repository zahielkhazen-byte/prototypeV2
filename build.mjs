import {readFileSync,writeFileSync,mkdirSync,copyFileSync} from 'node:fs';
const assets={};
for(const [url,path,mime] of [
 ['/','index.html','text/html'],['/app.js','assets/app.js','text/javascript'],['/capture.js','assets/capture.js','text/javascript'],['/qr.js','assets/qr.js','text/javascript'],['/style.css','assets/style.css','text/css'],['/bma.png','assets/bma.png','image/png']]){
 assets[url]=[mime,readFileSync(path).toString('base64')];
}
mkdirSync('dist/server',{recursive:true});mkdirSync('dist/.openai',{recursive:true});
writeFileSync('dist/server/index.js',readFileSync('radio.mjs','utf8')+'\nconst assets='+JSON.stringify(assets)+';\n'+`export default {async fetch(req,env){
 const path=new URL(req.url).pathname;
 if(path.startsWith('/api/'))return radio(req,env.BUCKET);
 const asset=assets[path];return asset?new Response(Uint8Array.from(atob(asset[1]),x=>x.charCodeAt(0)),{headers:{'Content-Type':asset[0],'Referrer-Policy':'no-referrer'}}):new Response('Missing',{status:404});
}};`);
copyFileSync('.openai/hosting.json','dist/.openai/hosting.json');
