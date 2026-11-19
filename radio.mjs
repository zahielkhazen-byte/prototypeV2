// The moderator's random secret is never included in participant invitations.
const digest = async text => Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(text))), b=>b.toString(16).padStart(2,'0')).join('');
const random = () => crypto.randomUUID().replaceAll('-','');
const json = (value,status=200) => Response.json(value,{status,headers:{'Cache-Control':'no-store'}});
const standard = {runners:'Runners',music:'Music',business:'Business & Race Announcements',emergency:'Emergency'};
const fail = (message,status=400) => {throw Object.assign(Error(message),{status})};
export async function radio(req, bucket) {
  try {
    const url=new URL(req.url), action=url.pathname.slice(5);
    const race=req.headers.get('X-Race')||'', token=req.headers.get('Authorization')?.replace(/^Bearer /,'')||'';
    if(!/^[a-f0-9]{64}$/.test(race)||!/^[a-f0-9]{32,64}$/.test(token)) fail('Open the runner invitation or moderator link.',403);
    const id=await digest(token), mod=id===race, prefix=race+'/';
    const get=async k=>(await bucket.get(prefix+k))?.json();
    const put=(k,v)=>bucket.put(prefix+k,JSON.stringify(v));
    async function list(k) {
      const items=[]; let cursor;
      do {const page=await bucket.list({prefix:prefix+k,cursor,include:['customMetadata']});items.push(...page.objects);cursor=page.truncated?page.cursor:undefined}while(cursor);
      return items;
    }
    const body=async()=>await req.json();
    const closedKey=r=>/^c[a-f0-9]{32}$/.test(r);
    const member=async r=>mod||!!await bucket.head(prefix+'access/'+id+'/'+r);
    async function permitted(r,write=false){
      if(r==='emergency')return write||mod;
      if(r==='business')return !write||mod||!!await bucket.head(prefix+'speaker/'+id);
      if(r==='music')return !write;
      if(r==='runners')return true;
      return closedKey(r)&&await member(r);
    }
    async function createRoom(name, key='c'+random()){
      const invite=random();
      await put('rooms/'+key,{key,name,owner:id,invite});
      await put('invite/'+invite,key);await put('access/'+id+'/'+key,true);
      return key;
    }
    if(action==='join'&&req.method==='POST'){
      const {name,invite}=await body();
      if(mod)await put('active',true);
      if(!await bucket.head(prefix+'active'))fail('The moderator needs to open the race first.',404);
      let selected='runners';
      if(invite){if(!/^[a-f0-9]{32}$/.test(invite))fail('Invalid invitation');selected=await get('invite/'+invite);if(!selected)fail('Invitation expired',404);await put('access/'+id+'/'+selected,true)}
      const person=await get('people/'+id);
      if(!person){
        const family=await createRoom('Friends & Family · '+String(name||'Runner').trim().slice(0,32));
        await put('people/'+id,{name:String(name||'Runner').trim().slice(0,32),family});
      }
      return json({selected,mod,now:Date.now()});
    }
    const who=await get('people/'+id);if(!who)fail('Join the race first.',403);
    if(action==='state'){
      const rooms=Object.entries(standard).map(([key,name])=>({key,name}));
      const keys=await list(mod?'rooms/':'access/'+id+'/');
      for(const k of keys){
        const room=await get('rooms/'+k.key.split('/').pop());
        if(room)rooms.push({key:room.key,name:room.name,invite:mod||room.owner===id?room.invite:undefined});
      }
      const result={rooms,playlist:await get('playlist'),speaker:mod||!!await bucket.head(prefix+'speaker/'+id)};
      if(mod){
        result.people=await Promise.all((await list('people/')).map(async k=>{const user=k.key.split('/').pop();return {id:user,name:(await get('people/'+user)).name,approved:!!await bucket.head(prefix+'speaker/'+user)}}));
      }
      return json(result);
    }
    if(action==='room'&&req.method==='POST'){const {name}=await body();if(!name?.trim()||name.length>60)fail('Use a channel name of 1–60 characters');return json({key:await createRoom(name.trim())})}
    if(action==='settings'&&req.method==='POST'){
      if(!mod)fail('Moderator only',403);const data=await body();
      if('playlist' in data){if(!/^[A-Za-z0-9]{22}$/.test(data.playlist))fail('Enter a Spotify playlist URL');await put('playlist',data.playlist)}
      else {if(!/^[a-f0-9]{64}$/.test(data.user)||!await bucket.head(prefix+'people/'+data.user))fail('Unknown participant');if(data.approved)await put('speaker/'+data.user,true);else await bucket.delete(prefix+'speaker/'+data.user)}
      return json({ok:true});
    }
    const room=url.searchParams.get('room')||'';
    if(!await permitted(room,action==='send'))fail('This channel is restricted.',403);
    const group='audio/'+room+'/';
    if(action==='send'&&req.method==='POST'){
      const size=Number(req.headers.get('Content-Length'));if(!size||size>48*1024*1024)fail('Message exceeds the 48 MiB prototype limit.',413);
      const blob=random();
      await bucket.put(prefix+'clips/'+blob,req.body);
      const key=String(Date.now()).padStart(13,'0')+'-'+blob;
      await bucket.put(prefix+group+key,'',{customMetadata:{sender:id}});
      return json({ok:true});
    }
    if(action==='listen'){
      const after=url.searchParams.get('after')||'';
      if(!/^\d{13}(-[a-f0-9]{32})?$/.test(after))fail('Invalid message cursor');
      const page=await bucket.list({prefix:prefix+group,startAfter:prefix+group+after,limit:50,include:['customMetadata']});
      const ids=page.objects.filter(k=>k.customMetadata?.sender!==id).map(k=>k.key.split('/').pop());
      return json({ids,after:page.objects.at(-1)?.key.split('/').pop()||after});
    }
    if(action==='audio'){
      const key=url.searchParams.get('id');if(!/^\d{13}-[a-f0-9]{32}$/.test(key))fail('Invalid message');
      if(!await bucket.head(prefix+group+key))fail('Missing recording',404);
      const recording=await bucket.get(prefix+'clips/'+key.slice(14));if(!recording)fail('Missing recording',404);
      return new Response(recording.body,{headers:{'Content-Type':'audio/wav','Cache-Control':'no-store'}});
    }
    return json({error:'Unknown operation'},404);
  }catch(e){return json({error:e.status?e.message:'Race service unavailable'},e.status||503)}
}
