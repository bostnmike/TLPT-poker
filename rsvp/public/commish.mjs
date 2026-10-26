export function privateCommishKey(value,origin){
 try{
  const url=new URL(value.trim()),key=new URLSearchParams(url.hash.slice(1)).get('key');
  if(url.origin===origin&&url.pathname==='/'&&url.searchParams.get('commish')==='1'&&!url.username&&!url.password&&/^[a-f0-9]{64}$/.test(key||''))return key;
 }catch{}
 throw Error('Paste the full private Commish link from Bitwarden.');
}
export function initCommishSignIn(win,doc){
 const form=doc.querySelector('#commish-sign-in-form'),input=doc.querySelector('#commish-sign-in-link'),status=doc.querySelector('#commish-sign-in-status'),button=form.querySelector('button');
 let saving=false;
 form.addEventListener('submit',async event=>{
  event.preventDefault();if(saving)return;
  let key;try{key=privateCommishKey(input.value,win.location.origin);}catch(e){input.value='';status.textContent=e.message;return;}
  input.value='';saving=true;button.disabled=true;status.textContent='Unlocking Commish…';
  try{
   const response=await win.fetch('/api/exchange',{method:'POST',cache:'no-store',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:JSON.stringify({key})});
   key=null;const result=await response.json();
   if(!response.ok)throw Error(result.error||'Sign-in failed. Try your saved private link again.');
   if(result.role!=='admin')throw Error('Use the private Commish link, not a player link.');
   status.textContent='Commish unlocked. Opening your controls…';win.location.reload();
  }catch(e){status.textContent=e.message||'Sign-in failed. Check your connection and try again.';}
  finally{key=null;saving=false;button.disabled=false;input.value='';}
 });
}
if(typeof window!=='undefined')initCommishSignIn(window,document);
