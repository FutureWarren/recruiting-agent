'use strict';
const API='https://backend-production-2b40.up.railway.app';
const form=document.getElementById('handoff-form'),firstName=document.getElementById('first-name'),email=document.getElementById('email');
const errorBox=document.getElementById('form-error'),submit=document.getElementById('submit'),success=document.getElementById('success'),stepLabel=document.getElementById('step-label');
const sourceParams=['source','utm_source','utm_medium','utm_campaign','utm_content'];
const query=new URLSearchParams(location.search);
const attribution=Object.fromEntries(sourceParams.map(k=>[k,(query.get(k)||'').slice(0,120)]));
if(!attribution.source)attribution.source='website_mobile';
const visitorKey='orbit_handoff_visitor_v1';
let visitorId='';
try{visitorId=sessionStorage.getItem(visitorKey)||'';if(!visitorId){visitorId=crypto.randomUUID();sessionStorage.setItem(visitorKey,visitorId)}}catch(_){visitorId='v_'+Math.random().toString(36).slice(2)+Date.now().toString(36)}
let started=false;
function api(path,options={}){return fetch(API+path,{...options,headers:{'content-type':'application/json',...(options.headers||{})}}).then(async r=>{const body=await r.json().catch(()=>({}));if(!r.ok)throw new Error(body.error||'Orbit could not save this yet.');return body})}
function event(stage,token=''){void api('/api/handoff/event',{method:'POST',body:JSON.stringify({visitorId,stage,token,...attribution})}).catch(()=>{})}
event('landing');
function markStarted(){if(started)return;started=true;stepLabel.textContent='IN PROGRESS';event('started')}
firstName.addEventListener('focus',markStarted);
email.addEventListener('focus',markStarted);
form.addEventListener('submit',async e=>{
 e.preventDefault();errorBox.hidden=true;
 const name=firstName.value.trim(),address=email.value.trim();
 if(!name){errorBox.textContent='Enter your first name.';errorBox.hidden=false;firstName.focus();return}
 if(!/^\S+@\S+\.\S+$/.test(address)){errorBox.textContent='Enter a valid email so we can hand Orbit back to you.';errorBox.hidden=false;email.focus();return}
 submit.disabled=true;submit.classList.add('loading');submit.querySelector('span').textContent='Saving your Orbit…';stepLabel.textContent='SAVING';
 try{
  const data=await api('/api/handoff/start',{method:'POST',body:JSON.stringify({firstName:name,email:address,visitorId,...attribution})});
  document.getElementById('name-receipt').textContent=name;
  const link=document.getElementById('desktop-link');link.href=data.continueUrl;link.dataset.url=data.continueUrl;
  const delivered=data.emailStatus==='delivered';
  const accepted=data.emailStatus==='accepted'||data.emailStatus==='sent';
  document.getElementById('success-title').textContent=delivered?'Check your inbox.':accepted?'Email is on its way.':'Your Orbit is ready.';
  document.getElementById('success-copy').textContent=delivered
   ?'Your desktop handoff was delivered to '+address+'. Open it when you are back at your computer.'
   :accepted
    ?'Your email provider accepted the handoff for '+address+'. Keep the desktop link below as a backup until it arrives.'
    :'Your setup is saved. Use the desktop link below now — you do not need to wait for email.';
  document.getElementById('delivery-note').textContent=delivered
   ?'No need to scan the QR code again.'
   :accepted
    ?'The link below works immediately even while email delivery is still being confirmed.'
    :'Automatic email delivery is unavailable right now, so this link is your handoff.';
  form.hidden=true;success.hidden=false;stepLabel.textContent='READY ON DESKTOP';
  history.replaceState(null,'',location.pathname+'?saved=1');
  try{localStorage.setItem('orbit_handoff_continue',data.continueUrl)}catch(_){}
  success.scrollIntoView({behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth',block:'center'});
 }catch(err){errorBox.textContent=err.message||'Orbit could not save this yet. Please try again.';errorBox.hidden=false;stepLabel.textContent='TRY AGAIN'}
 finally{submit.disabled=false;submit.classList.remove('loading');submit.querySelector('span').textContent='Get Orbit'}
});
document.getElementById('share-link').addEventListener('click',async()=>{
 const url=document.getElementById('desktop-link').dataset.url;if(!url)return;
 try{if(navigator.share){await navigator.share({title:'My Orbit setup',text:'Continue setting up Orbit on my computer',url});return}await navigator.clipboard.writeText(url);document.getElementById('share-link').textContent='Desktop link copied ✓'}catch(_){}
});
document.getElementById('restart').addEventListener('click',()=>{success.hidden=true;form.hidden=false;stepLabel.textContent='IN PROGRESS';firstName.focus()});
