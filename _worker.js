// KOFFI TECH - API partagée (Cloudflare Pages + D1). Liaison D1 : DB. Secret : ADMIN_PIN.
const cl=s=>String(s??'').replace(/[<>"]/g,'').trim();
const J=(o,s=200)=>new Response(JSON.stringify(o),{status:s,headers:{'content-type':'application/json','cache-control':'no-store'}});
let ready=false;
async function init(db){if(ready)return;await db.batch([db.prepare('CREATE TABLE IF NOT EXISTS products(id TEXT PRIMARY KEY,data TEXT NOT NULL)'),db.prepare('CREATE TABLE IF NOT EXISTS cfg(k TEXT PRIMARY KEY,v TEXT NOT NULL)')]);ready=true}
const put=(env,k,v)=>env.DB.prepare('INSERT INTO cfg(k,v) VALUES(?1,?2) ON CONFLICT(k) DO UPDATE SET v=excluded.v').bind(k,JSON.stringify(v)).run();
async function api(request,env,u){
  if(!env.DB)return J({error:'Base D1 non liée (liaison DB)'},500);
  await init(env.DB);
  const path=u.pathname.replace(/^\/api\//,''),m=request.method;
  if(path==='data'&&m==='GET'){
    const p=await env.DB.prepare('SELECT data FROM products ORDER BY rowid').all();
    const c=await env.DB.prepare('SELECT k,v FROM cfg').all();
    const cfg={};c.results.forEach(r=>cfg[r.k]=JSON.parse(r.v));
    return J({products:p.results.map(r=>JSON.parse(r.data)),cfg});
  }
  if(!env.ADMIN_PIN||request.headers.get('x-admin')!==env.ADMIN_PIN)return J({error:'Non autorisé'},401);
  if(path==='auth'&&m==='POST')return J({ok:1});
  if(path==='product'&&m==='PUT'){
    const b=await request.json(),id=cl(b.id);if(!id)return J({error:'id'},400);
    const p={id:b.id,n:cl(b.n).slice(0,120),c:cl(b.c).slice(0,60),p:Math.max(0,+b.p||0),o:b.o?(+b.o||null):null,s:Math.max(0,Math.floor(+b.s||0)),l:Math.max(0,+b.l||0),
      sp:(Array.isArray(b.sp)?b.sp:[]).slice(0,20).map(x=>cl(x).slice(0,200)),
      img:(Array.isArray(b.img)?b.img:[]).filter(x=>typeof x==='string'&&x.startsWith('data:image/jpeg;base64,')).slice(0,6),off:!!b.off};
    if(!p.n||!p.c||!(p.p>0))return J({error:'Données invalides'},400);
    const data=JSON.stringify(p);if(data.length>1900000)return J({error:'Photos trop lourdes'},413);
    await env.DB.prepare('INSERT INTO products(id,data) VALUES(?1,?2) ON CONFLICT(id) DO UPDATE SET data=excluded.data').bind(id,data).run();
    return J({ok:1});
  }
  if(path==='product'&&m==='DELETE'){await env.DB.prepare('DELETE FROM products WHERE id=?1').bind(cl(u.searchParams.get('id'))).run();return J({ok:1})}
  if(path==='cfg'&&m==='PUT'){
    const b=await request.json();
    await put(env,'ann',cl(b.ann).slice(0,300));
    if(b.shop&&isFinite(+b.shop.la)&&isFinite(+b.shop.lo))await put(env,'shop',{la:String(+b.shop.la),lo:String(+b.shop.lo)});
    return J({ok:1});
  }
  return J({error:'Introuvable'},404);
}
export default{async fetch(request,env){const u=new URL(request.url);
  if(u.pathname.startsWith('/api/')){try{return await api(request,env,u)}catch(e){return J({error:'Erreur serveur'},500)}}
  return env.ASSETS.fetch(request)}}
