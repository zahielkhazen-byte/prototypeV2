const $=id=>document.getElementById(id);
const args=new URLSearchParams(location.hash.slice(1));
const mod=args.has('mod');
const random=()=>crypto.randomUUID().replaceAll('-','');
const hash=async s=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(s))),x=>x.toString(16).padStart(2,'0')).join('');
const race=mod?await hash(args.get('mod')):args.get('race');
const token=mod?args.get('mod'):(localStorage.getItem('runner-'+race)||random());
if(!mod&&race)localStorage.setItem('runner-'+race,token);
const error=e=>{$('error').textContent=e.message};
const valid=/^[a-f0-9]{64}$/.test(race||'')&&/^[a-f0-9]{32,64}$/.test(token||'');
if(!valid){$('join').hidden=true;$('intro').textContent='Scan the race QR code on the moderator’s phone to join.'}
let directory,channel,clock,ctx,stream,capture,muted,recording=false,stopping=false,sending=false,pieces=[],length=0,queue=[],player,loading=false,polling=false,cycle=0,oldRoster='',musicId,initialTime;
const cursors=new Map();
async function api(route,data){
  const headers={'X-Race':race,Authorization:'Bearer '+token};
  const options={headers,cache:'no-store'};
  if(data!==undefined){options.method='POST';options.body=data instanceof Blob?data:JSON.stringify(data)}
  const response=await fetch('/api/'+route,options);
  if(!response.ok)throw Error((await response.json()).error);
  return route.startsWith('audio?')?response.blob():response.json();
}
function inviteURL(room){
 const url=new URL('/',location.origin),params=new URLSearchParams({race});
 if(room?.invite)params.set('invite',room.invite);
 else if(['runners','music','business','emergency'].includes(room?.key))params.set('room',room.key);
 url.hash=params;return url.href;
}
function showQR(){
 const room=directory.rooms.find(r=>r.key===channel);
 $('share').hidden=channel?.startsWith('c')&&!room?.invite;
 if($('share').hidden)return;
 const code=new QRCode(-1,0);code.addData(inviteURL(room));code.make();
 const n=code.getModuleCount(),canvas=$('qr'),unit=6;
 canvas.width=canvas.height=(n+8)*unit;
 const g=canvas.getContext('2d');g.fillStyle='white';g.fillRect(0,0,canvas.width,canvas.height);g.fillStyle='black';
 for(let y=0;y<n;y++)for(let x=0;x<n;x++)if(code.isDark(y,x))g.fillRect((x+4)*unit,(y+4)*unit,unit,unit);
 $('qrLabel').textContent='Scan to join '+room.name+'. Everyone can scan the same code.';
}
function paint(){
 const room=directory.rooms.find(r=>r.key===channel);if(!room)return;
 $('talk').hidden=channel==='music'||(channel==='business'&&!directory.speaker);
 $('hint').textContent=({music:'Listen to the moderator’s Spotify playlist.',emergency:'Race reports go only to the moderator. For this field test, use simulated reports.',business:'Businesses and race organizers approved by the moderator can speak.',runners:'Everyone in this channel can speak and listen.'})[channel]||'Only invited participants and the moderator can enter.';
 const next=channel==='music'?directory.playlist:null;
 if(musicId!==next){musicId=next;$('music').replaceChildren();if(next){const frame=document.createElement('iframe');frame.title='Race playlist';frame.src='https://open.spotify.com/embed/playlist/'+next;frame.allow='autoplay; encrypted-media';$('music').append(frame)}}
 if(channel==='music'&&!next)$('hint').textContent='The moderator can add a Spotify playlist in Moderator controls.';
}
async function refresh(){
 directory=await api('state');
 const menu=$('channel'),options=directory.rooms.map(r=>[r.name,r.key]);
 if(menu.dataset.options!==JSON.stringify(options)){menu.replaceChildren(...options.map(([n,k])=>new Option(n,k)));menu.dataset.options=JSON.stringify(options);if(channel)menu.value=channel}
 if(mod&&JSON.stringify(directory.people)!==oldRoster){
  oldRoster=JSON.stringify(directory.people);$('speakers').replaceChildren();
  for(const p of directory.people){if(p.id===race)continue;const label=document.createElement('label'),box=document.createElement('input');box.type='checkbox';box.checked=p.approved;
   box.onchange=async()=>{try{await api('settings',{user:p.id,approved:box.checked})}catch(e){box.checked=!box.checked;error(e)}};label.append(box,document.createTextNode(p.name));$('speakers').append(label)}
  $('role').textContent='Moderator · '+directory.people.length+' joined';
 }
 paint();
}
function select(key,now){
 channel=key;$('channel').value=key;cycle++;
 if(!cursors.has(key))cursors.set(key,String(now));queue=queue.filter(i=>mod&&i.room==='emergency');
 if(player){player.pause();URL.revokeObjectURL(player.src);player=null}
 showQR();paint();$('status').textContent='Listening';
}
async function drain(){
 if(loading||recording||stopping||player&&!player.paused||!queue.length&&!player)return;
 loading=true;let active=player;
 try{if(!active){const item=queue[0];const blob=await api('audio?'+new URLSearchParams({room:item.room,id:item.id}));if(queue[0]!==item)return;
  active=new Audio(URL.createObjectURL(blob));player=active;queue.shift();
  active.onended=()=>{URL.revokeObjectURL(active.src);if(player===active){player=null;$('status').textContent='Listening';drain()}};
 }
 if(!recording&&!stopping&&player===active){await active.play();$('status').textContent='Receiving message'}
 }catch(e){if(!recording)error(e)}finally{loading=false}
}
async function poll(){
 if(polling)return;polling=true;
 try{
  const current=cycle;
  for(const r of new Set([channel,...(mod?['emergency']:[])])){
   if(r==='music'||(r==='emergency'&&!mod))continue;
   const d=await api('listen?'+new URLSearchParams({room:r,after:cursors.get(r)||String(initialTime)}));
   if(current!==cycle)break;
   for(const id of d.ids)queue.push({room:r,id});cursors.set(r,d.after);
  }
  queue.sort((a,b)=>a.id.localeCompare(b.id));await drain();
 }catch(e){error(e)}finally{polling=false}
}
$('join').onsubmit=async e=>{e.preventDefault();const button=e.submitter;button.disabled=true;
 try{
  ctx=new AudioContext({sampleRate:16000});await ctx.resume();stream=await navigator.mediaDevices.getUserMedia({audio:true});
  await ctx.audioWorklet.addModule('/capture.js');capture=new AudioWorkletNode(ctx,'capture');
  muted=ctx.createGain();muted.gain.value=0;ctx.createMediaStreamSource(stream).connect(capture).connect(muted).connect(ctx.destination);
  capture.port.onmessage=received;
  const joined=await api('join',{name:$('name').value,invite:args.get('invite')});initialTime=joined.now;clock=Date.now();
  await refresh();const target=args.get('room');
  select(directory.rooms.some(r=>r.key===target)?target:joined.selected,initialTime);$('panel').hidden=false;$('welcome').hidden=true;$('controls').hidden=!mod;
  if(!mod)$('role').textContent='Participant';
  if(mod)$('share').open=true;
  $('error').textContent='';setInterval(poll,1000);setInterval(()=>refresh().catch(error),6000);poll();
 }catch(err){stream?.getTracks().forEach(t=>t.stop());await ctx?.close();error(err);button.disabled=false}
};
$('channel').onchange=()=>select($('channel').value,Date.now()+(initialTime-clock));
$('create').onsubmit=async e=>{e.preventDefault();try{const room=await api('room',{name:$('newName').value});await refresh();select(room.key,Date.now()+(initialTime-clock));$('share').open=true;$('newName').value=''}catch(err){error(err)}};
$('setMusic').onsubmit=async e=>{e.preventDefault();try{const u=new URL($('playlist').value);const m=u.pathname.match(/\/playlist\/([A-Za-z0-9]{22})\/?$/);if(u.hostname!=='open.spotify.com'||!m)throw Error('Paste a Spotify playlist link.');await api('settings',{playlist:m[1]});await refresh();$('status').textContent='Playlist saved'}catch(err){error(err)}};
function stop(){if(stopping)return;stopping=true;capture.port.postMessage('stop');$('talk').disabled=true}
function wav(){
 const header=new ArrayBuffer(44),view=new DataView(header),n=length*2;
 function tag(i,s){[...s].forEach((c,j)=>view.setUint8(i+j,c.charCodeAt(0)))}
 tag(0,'RIFF');view.setUint32(4,36+n,true);tag(8,'WAVE');tag(12,'fmt ');view.setUint32(16,16,true);view.setUint16(20,1,true);view.setUint16(22,1,true);view.setUint32(24,ctx.sampleRate,true);view.setUint32(28,ctx.sampleRate*2,true);view.setUint16(32,2,true);view.setUint16(34,16,true);tag(36,'data');view.setUint32(40,n,true);return new Blob([header,...pieces],{type:'audio/wav'});
}
let pending=null;
async function sendTurn(){
 sending=true;$('talk').disabled=true;
 try{await api('send?room='+encodeURIComponent(pending.room),pending.blob);pending=null;$('talk').textContent='Tap to talk';$('status').textContent='Sent · Listening';$('error').textContent=''}
 catch(err){error(err);$('talk').textContent='Retry sending'}
 finally{sending=false;$('talk').disabled=false;$('channel').disabled=!!pending;$('create').querySelector('button').disabled=!!pending;drain()}
}
async function received({data}){
 if(data!==null){if(!recording||length+data.length>(48*1024*1024-44)/2)return;const pcm=Int16Array.from(data,v=>Math.round(Math.max(-1,Math.min(1,v))*32767));pieces.push(pcm);length+=pcm.length;if(length*2>48*1024*1024-4096)stop();return}
 if(!recording)return;
 recording=stopping=false;$('talk').setAttribute('aria-pressed','false');pending={room:channel,blob:wav()};pieces=[];await sendTurn();
}
$('talk').onclick=async()=>{if(sending||stopping)return;if(pending)return sendTurn();if(recording)return stop();
 try{await ctx.resume();player?.pause();pieces=[];length=0;recording=true;capture.port.postMessage('record');$('channel').disabled=true;$('create').querySelector('button').disabled=true;$('talk').setAttribute('aria-pressed','true');$('talk').textContent='Tap to send';$('status').textContent='Recording · Incoming messages will wait'}catch(err){error(err)}
};
