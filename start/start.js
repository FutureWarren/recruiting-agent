'use strict';
const API='https://backend-production-2b40.up.railway.app';
const form=document.getElementById('handoff-form'),email=document.getElementById('email');
const errorBox=document.getElementById('form-error'),submit=document.getElementById('submit'),success=document.getElementById('success'),stepLabel=document.getElementById('step-label');
const sourceParams=['source','utm_source','utm_medium','utm_campaign','utm_content'];
const query=new URLSearchParams(location.search);
const preservedIntent=window.OrbitNetworkingBridge?.read?.() || null;
const networkingIntent=preservedIntent &&
 query.get('source')===preservedIntent.source && query.get('utm_campaign')==='networking_activation'
 ? preservedIntent : null;
if(networkingIntent){
 document.body.classList.add('is-networking');
 const preview=document.getElementById('networking-prep');
 const goal=document.getElementById('networking-prep-goal');
 const briefGoal=networkingIntent.source==='resume_evaluation'&&networkingIntent.company
   ?'Find alumni at '+networkingIntent.company
   :networkingIntent.source==='face_match'&&networkingIntent.industry
     ?'Find alumni in '+networkingIntent.industry
     :'Find relevant alumni';
 if(preview&&goal){preview.hidden=false;goal.textContent=briefGoal;}
 if(networkingIntent.email)email.value=networkingIntent.email;
 const headline=document.getElementById('start-heading');
 if(headline)headline.textContent='Start networking.';
 const eyebrow=document.querySelector('.intro .eyebrow');
 if(eyebrow)eyebrow.textContent='YOUR NEXT STEP';
 const intro=document.querySelector('.intro > p');
 if(intro)intro.textContent='Your task is ready. Email yourself the Orbit desktop link.';
 const submitLabel=submit.querySelector('span');
 if(submitLabel)submitLabel.textContent='Send my Orbit link';
 const hint=document.getElementById('handoff-email-hint');
 if(hint&&networkingIntent.email)hint.textContent='Confirm your email before sending the link.';
 const back=document.getElementById('start-back');
 if(back){
   back.hidden=false;
   back.href=networkingIntent.source==='face_match'?'/face-match/':'/resume-score/';
   back.textContent=networkingIntent.source==='face_match'?'← Back to Face Match':'← Back to Resume Evaluation';
 }
}
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
  const data=await api('/api/handoff/start',{method:'POST',body:JSON.stringify({email:address,visitorId,...attribution,...(networkingIntent?{goal:networkingIntent.goal,detail:networkingIntent.detail}:{})})});
  const link=document.getElementById('desktop-link');link.href=data.continueUrl;link.dataset.url=data.continueUrl;
  const delivered=data.emailStatus==='delivered';
  const accepted=data.emailStatus==='accepted'||data.emailStatus==='sent';
  document.getElementById('success-title').textContent=delivered?'Check your inbox.':accepted?'Your link is on its way.':'Your desktop link is ready.';
  document.getElementById('success-copy').textContent=delivered
   ?'Open the link in your inbox on a Mac or Windows computer.'
   :accepted
    ?'Delivery to '+address+' was accepted. Open the link on your computer, or use the backup below.'
    :'Email delivery was not confirmed. Copy the backup link below to continue on your computer.';
  document.getElementById('delivery-note').textContent=delivered
   ?'Sign in with Google after installing.'
   :accepted
    ?'The backup link is available now.'
    :'You can use the backup link even if email fails.';
  form.hidden=true;success.hidden=false;stepLabel.textContent='READY ON DESKTOP';
  if(networkingIntent){
    document.getElementById('delivery-note').append(' Your networking task is saved for review.');
    window.OrbitNetworkingBridge?.clear?.();
  }
  history.replaceState(null,'',location.pathname+'?saved=1');
  try{localStorage.setItem('orbit_handoff_continue',data.continueUrl)}catch(_){}
  success.scrollIntoView({behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth',block:'center'});
 }catch(err){errorBox.textContent=err.message||'Orbit could not save this yet. Please try again.';errorBox.hidden=false;stepLabel.textContent='TRY AGAIN'}
 finally{submit.disabled=false;submit.classList.remove('loading');submit.querySelector('span').textContent=networkingIntent?'Send my Orbit link':'Email me the Orbit link'}
});
document.getElementById('share-link').addEventListener('click',async()=>{
 const url=document.getElementById('desktop-link').dataset.url;if(!url)return;
 try{if(navigator.share){await navigator.share({title:'My Orbit setup',text:'Continue setting up Orbit on my computer',url});return}await navigator.clipboard.writeText(url);document.getElementById('share-link').textContent='Desktop link copied ✓'}catch(_){}
});
document.getElementById('restart').addEventListener('click',()=>{success.hidden=true;form.hidden=false;stepLabel.textContent='IN PROGRESS';email.focus()});
