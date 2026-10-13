'use strict';
const API='https://backend-production-2b40.up.railway.app';
const form=document.getElementById('handoff-form'),email=document.getElementById('email');
const errorBox=document.getElementById('form-error'),submit=document.getElementById('submit'),success=document.getElementById('success'),stepLabel=document.getElementById('step-label');
const sourceParams=['source','utm_source','utm_medium','utm_campaign','utm_content'];
const query=new URLSearchParams(location.search);
const attribution=Object.fromEntries(sourceParams.map(k=>[k,(query.get(k)||'').slice(0,120)]));
if(!attribution.source)attribution.source=attribution.utm_source||'direct';
attribution.funnelVersion=2;
attribution.platform=/Android|iPhone|iPad|iPod/i.test(navigator.userAgent)?'mobile':/Windows/i.test(navigator.userAgent)?'win':/Macintosh|Mac OS X/i.test(navigator.userAgent)?'mac':'other';
const visitorKey='orbit_handoff_visitor_v1';
let visitorId='';
try{visitorId=sessionStorage.getItem(visitorKey)||'';if(!visitorId){visitorId=crypto.randomUUID();sessionStorage.setItem(visitorKey,visitorId)}}catch(_){visitorId='v_'+Math.random().toString(36).slice(2)+Date.now().toString(36)}
let started=false;
function api(path,options={}){return fetch(API+path,{...options,keepalive:path==='/api/handoff/event',headers:{'content-type':'application/json',...(options.headers||{})}}).then(async r=>{const body=await r.json().catch(()=>({}));if(!r.ok)throw new Error(body.error||'Orbit could not save this yet.');return body})}
function event(stage,token=''){void api('/api/handoff/event',{method:'POST',body:JSON.stringify({visitorId,stage,token,...attribution})}).catch(()=>{})}
event('site_visit_v2');
function markStarted(){if(started)return;started=true;stepLabel.textContent='IN PROGRESS';event('email_started_v2')}
email.addEventListener('focus',markStarted);
form.addEventListener('submit',async e=>{
 e.preventDefault();errorBox.hidden=true;
 const address=email.value.trim();
 if(!/^\S+@\S+\.\S+$/.test(address)){errorBox.textContent='Enter a valid email so we can hand Orbit back to you.';errorBox.hidden=false;email.focus();return}
 submit.disabled=true;submit.classList.add('loading');submit.querySelector('span').textContent='Sending the link…';stepLabel.textContent='SENDING';
 try{
  event('cta_clicked_v2');
  const data=await api('/api/handoff/start',{method:'POST',body:JSON.stringify({email:address,visitorId,...attribution})});
  const link=document.getElementById('desktop-link');link.href=data.continueUrl;link.dataset.url=data.continueUrl;
  const delivered=data.emailStatus==='delivered';
  const accepted=data.emailStatus==='accepted'||data.emailStatus==='sent';
  document.getElementById('success-title').textContent=delivered?'Check your inbox.':accepted?'Your link is on its way.':'Your desktop link is ready.';
  document.getElementById('success-copy').textContent=delivered
   ?'Your download link was delivered to '+address+'. Open it on your Mac or Windows computer to install Orbit.'
   :accepted
    ?'Your email provider accepted the link for '+address+'. Open it on your computer when it arrives, or copy the backup link below.'
    :'Email delivery could not be confirmed. Copy the desktop link below and open it on your computer.';
  document.getElementById('delivery-note').textContent=delivered
   ?'No need to scan the QR code again. After installing, sign in with Google.'
   :accepted
    ?'The backup link works right away while the email is on its way.'
    :'The backup link is available now even if the email service fails.';
  form.hidden=true;success.hidden=false;stepLabel.textContent='READY ON DESKTOP';
  history.replaceState(null,'',location.pathname+'?saved=1');
  try{localStorage.setItem('orbit_handoff_continue',data.continueUrl)}catch(_){}
  success.scrollIntoView({behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth',block:'center'});
 }catch(err){errorBox.textContent=err.message||'Orbit could not save this yet. Please try again.';errorBox.hidden=false;stepLabel.textContent='TRY AGAIN'}
 finally{submit.disabled=false;submit.classList.remove('loading');submit.querySelector('span').textContent='Email me the desktop link'}
});
document.getElementById('share-link').addEventListener('click',async()=>{
 const url=document.getElementById('desktop-link').dataset.url;if(!url)return;
 try{if(navigator.share){await navigator.share({title:'My Orbit setup',text:'Continue setting up Orbit on my computer',url});return}await navigator.clipboard.writeText(url);document.getElementById('share-link').textContent='Desktop link copied ✓'}catch(_){}
});
document.getElementById('restart').addEventListener('click',()=>{success.hidden=true;form.hidden=false;stepLabel.textContent='IN PROGRESS';email.focus()});
