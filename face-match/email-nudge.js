'use strict';
/**
 * Face Match post-result opt-in:
 * - Offer a one-time email handoff only after the user has viewed a result for 10s.
 * - Never send a photo, aura, or company inference to handoff or to analytics.
 * - Never enroll in marketing, register an account, or send any email without
 *   the user's explicit form submission.
 * - Results remain fully usable behind a dismissible, nonmodal nudge.
 */
(function(){
  const API='https://backend-production-2b40.up.railway.app';
  const DELAY_MS=10_000;
  const HANDLED_KEY='orbit_face_match_email_nudge_handled_v1';
  const VISITOR_KEY='orbit_handoff_visitor_v1';
  const node=id=>document.getElementById(id);
  const panel=node('fm-email-nudge');
  const input=node('fm-email-nudge-input');
  const form=node('fm-email-nudge-form');
  const submit=node('fm-email-nudge-submit');
  const error=node('fm-email-nudge-error');
  let timer=null;
  let pendingVisibility=false;
  let handledInMemory=false;
  let saving=false;

  function handled(){
    if(handledInMemory)return true;
    try{return sessionStorage.getItem(HANDLED_KEY)==='1'}catch{return false}
  }
  function markHandled(){
    handledInMemory=true;
    try{sessionStorage.setItem(HANDLED_KEY,'1')}catch{}
  }
  function clearTimer(){
    if(timer!==null){clearTimeout(timer);timer=null}
    pendingVisibility=false;
  }
  function hide(){
    panel.hidden=true;
    clearTimer();
  }
  function dismiss(){
    markHandled();
    hide();
  }
  function shouldShow(){
    return !handled()&&!saving&&
      node('results')?.hidden===false&&
      node('camera-modal')?.hidden!==false;
  }
  function reveal(){
    if(!shouldShow())return;
    if(document.hidden){pendingVisibility=true;return}
    pendingVisibility=false;
    node('fm-email-nudge-ask').hidden=false;
    node('fm-email-nudge-success').hidden=true;
    panel.hidden=false;
    // Never steal focus from the result, share CTA, or screen reader.
  }
  function schedule(){
    hide();
    if(!shouldShow())return;
    timer=setTimeout(()=>{
      timer=null;
      reveal();
    },DELAY_MS);
  }
  function cancel(){
    hide();
  }
  document.addEventListener('visibilitychange',()=>{
    if(!document.hidden&&pendingVisibility){
      pendingVisibility=false;
      reveal();
    }
  });
  node('fm-email-nudge-close').addEventListener('click',dismiss);
  node('fm-email-nudge-later').addEventListener('click',dismiss);
  node('fm-email-nudge-done').addEventListener('click',dismiss);
  document.addEventListener('keydown',event=>{
    if(event.key==='Escape'&&!panel.hidden){dismiss()}
  });
  function visitorId(){
    try{
      let id=sessionStorage.getItem(VISITOR_KEY);
      if(!id){
        id=crypto.randomUUID();
        sessionStorage.setItem(VISITOR_KEY,id);
      }
      return id;
    }catch{
      return typeof crypto.randomUUID==='function'?crypto.randomUUID():'';
    }
  }
  function platform(){
    const ua=navigator.userAgent;
    return /Android|iPhone|iPad|iPod/i.test(ua)?'mobile':
      /Windows/i.test(ua)?'win':/Macintosh|Mac OS X/i.test(ua)?'mac':'other';
  }
  function failure(message){
    error.textContent=message;
    error.hidden=false;
  }
  function setSaving(value){
    saving=value;
    input.disabled=value;
    submit.disabled=value;
    submit.querySelector('span').textContent=value?'…':'→';
    submit.firstChild.textContent=value?'Sending… ':'Send link ';
  }
  function continueLink(raw){
    if(typeof raw!=='string')throw new Error('Orbit could not prepare a valid setup link.');
    const url=new URL(raw);
    if(url.protocol!=='https:'||
      !['orbit-reaches.com','www.orbit-reaches.com'].includes(url.hostname)||
      !url.pathname.startsWith('/continue/'))
      throw new Error('Orbit could not prepare a valid setup link.');
    return url.toString();
  }
  form.addEventListener('submit',async event=>{
    event.preventDefault();
    if(saving||handled())return;
    error.hidden=true;
    const address=input.value.trim().toLowerCase();
    if(address.length>254||!input.checkValidity()||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(address)){
      failure('Enter a valid email address to receive your Orbit link.');
      input.focus();
      return;
    }
    setSaving(true);
    try{
      // Do not infer the user's preferred industry from their appearance.
      const goal='Find relevant alumni and prepare personalized networking introductions';
      const detail='Research relevant people, find professional contact information when available, '+
        'and prepare thoughtful outreach drafts for my review. Never send messages without my approval.';
      const variant=window.OrbitNetworkingBridge?.variant?.('face-match')||'a';
      const response=await fetch(API+'/api/handoff/start',{
        method:'POST',mode:'cors',credentials:'omit',cache:'no-store',
        headers:{'Content-Type':'application/json'},
        body:JSON.stringify({
          email:address,
          visitorId:visitorId(),
          platform:platform(),
          funnelVersion:2,
          source:'face_match',
          utm_source:'face_match',
          utm_medium:'free_tool',
          utm_campaign:'post_result_email',
          utm_content:variant==='b'?'b':'a',
          goal,detail
        })
      });
      const data=await response.json().catch(()=>({}));
      if(!response.ok){
        if(response.status===429)throw new Error('Too many setup emails requested. Please try again shortly.');
        throw new Error(typeof data.error==='string'&&data.error.length<180?
          data.error:'Orbit could not prepare your link. Please try again.');
      }
      const link=continueLink(data.continueUrl);
      const delivered=data.emailStatus==='delivered';
      const accepted=data.emailStatus==='accepted'||data.emailStatus==='sent';
      node('fm-email-nudge-success-title').textContent=
        delivered?'Check your inbox.':accepted?'Your link is on its way.':'Your setup link is ready.';
      node('fm-email-nudge-success-copy').textContent=
        delivered?'We sent the Orbit link to '+address+'. Continue on a computer to create your account.':
        accepted?'Email delivery to '+address+' was accepted. You can also open your setup link below.':
        'Email delivery is not confirmed. Use the setup link below to continue.';
      const action=node('fm-email-nudge-link');
      action.href=link;
      markHandled();
      node('fm-email-nudge-ask').hidden=true;
      node('fm-email-nudge-success').hidden=false;
    }catch(err){
      failure(err instanceof Error?err.message:'Could not prepare your setup. Please try again.');
    }finally{
      setSaving(false);
    }
  });

  window.OrbitFaceMatchEmailNudge=Object.freeze({
    schedule,cancel,
    // UI contract: strictly after a visible real result, never on upload/loader.
    delayMs:DELAY_MS
  });
  window.addEventListener('pagehide',clearTimer);
})();
