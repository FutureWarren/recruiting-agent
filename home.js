'use strict';
// Website only. No analytics payloads, account access, or product automation.
const REPO='FutureWarren/recruiting-agent';
function mobileStartUrl(){const q=new URLSearchParams(location.search);if(!q.get('source'))q.set('source','website_mobile');return '/start/?'+q.toString()}
function detectOS(){const ua=navigator.userAgent||'';if(/Android|iPhone|iPad|iPod/i.test(ua)||(/Macintosh/.test(ua)&&(navigator.maxTouchPoints||0)>1))return'mobile';const p=navigator.userAgentData?.platform||'';if(/windows/i.test(p)||/Windows|Win64|Win32|WOW64/i.test(ua))return'win';if(/macos|mac os/i.test(p)||/Macintosh|Mac OS X/i.test(ua))return'mac';return null}
async function detectArch(){try{const v=await navigator.userAgentData?.getHighEntropyValues?.(['architecture']);if(v?.architecture==='arm')return'arm64';if(v?.architecture==='x86')return'x64'}catch(_){}try{const g=document.createElement('canvas').getContext('webgl'),d=g?.getExtension('WEBGL_debug_renderer_info'),r=d?String(g.getParameter(d.UNMASKED_RENDERER_WEBGL)):'';if(/apple/i.test(r))return'arm64';if(/intel|radeon|amd|nvidia/i.test(r))return'x64'}catch(_){}return null}
// Every download CTA, including navigation, shares one resolution state.
async function initDownload(){
 const buttons=[...document.querySelectorAll('[data-orbit-download]')];
 const meta=document.getElementById('dl-meta'),os=detectOS(),allowance='300 free Orbit Credits';
 const label=(b,text,navText)=>{b.textContent=b.id==='nav-download'?(navText||text):text};
 const disable=(text,message)=>{buttons.forEach(b=>{b.removeAttribute('href');b.setAttribute('aria-disabled','true');b.dataset.downloadState='unsupported';label(b,text,'Mac only');b.setAttribute('aria-label',message)});meta.textContent=message};
 buttons.forEach(b=>{b.dataset.downloadState='loading'});
  if(os==='mobile'){
   buttons.forEach(b=>{b.href='#mobile-handoff-modal';b.removeAttribute('aria-disabled');b.dataset.downloadState='handoff';label(b,'Get Orbit →','Get Orbit');b.setAttribute('aria-label','Set up Orbit now and continue on desktop')});
   const secondary=document.querySelector('.hero-copy .btn-secondary');secondary.href='#demo';secondary.textContent='Watch Orbit work';secondary.setAttribute('data-watch-demo','');
   meta.textContent='20-second phone setup · '+allowance+' · continue on desktop later';return;
  }
 if(os!=='mac'){disable('Orbit for Apple Silicon Mac','Orbit currently supports Apple Silicon Mac only'+(os==='win'?'. Windows is not available yet.':''));return}
 const arch=await detectArch();
 if(arch==='x64'){disable('Orbit requires Apple Silicon','Orbit currently supports Apple Silicon Mac only');return}
 const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),5000);
 try{
  const response=await fetch('https://api.github.com/repos/'+REPO+'/releases/latest',{signal:controller.signal});
  if(!response.ok)throw Error('Release unavailable');const release=await response.json();
  const asset=(release.assets||[]).find(a=>/arm64.*\.dmg$/i.test(a.name||'')&&/^https:\/\//.test(a.browser_download_url||''));
  if(!asset)throw Error('Apple Silicon build unavailable');
  buttons.forEach(b=>{b.href=asset.browser_download_url;b.removeAttribute('aria-disabled');b.dataset.downloadState='ready';label(b,'Download for Mac (Apple Silicon) ↗','Get Orbit ↗');b.setAttribute('aria-label','Download Orbit for Apple Silicon Mac')});
  const v=asset.name.match(/\d+\.\d+\.\d+/)?.[0]||String(release.tag_name||'').replace(/^v/,'');
  meta.textContent='Version '+v+' · '+Math.round(asset.size/1048576)+' MB · Apple Silicon Mac · '+allowance+(arch?'':' · check your Mac chip');
 }catch(_){
  buttons.forEach(b=>{b.href='https://github.com/'+REPO+'/releases/latest';b.dataset.downloadState='fallback';label(b,'View Mac downloads ↗','Get Orbit ↗')});
  meta.textContent='Apple Silicon Mac · '+allowance+' · open releases to choose the latest Mac installer';
 }finally{clearTimeout(timer)}
}

const HANDOFF_API='https://backend-production-2b40.up.railway.app';
function handoffAttribution(){
 const q=new URLSearchParams(location.search),keys=['source','utm_source','utm_medium','utm_campaign','utm_content'],out={};
 for(const k of keys)out[k]=(q.get(k)||'').slice(0,120);
 if(!out.source)out.source='website_mobile';
 return out;
}
function handoffVisitor(){
 const key='orbit_handoff_visitor_v1';
 try{let id=sessionStorage.getItem(key)||'';if(!id){id=crypto.randomUUID();sessionStorage.setItem(key,id)}return id}catch(_){return'v_'+Math.random().toString(36).slice(2)+Date.now().toString(36)}
}
async function handoffApi(path,payload){
 const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),8000);
 try{
  const r=await fetch(HANDOFF_API+path,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(payload),signal:controller.signal});
  const body=await r.json().catch(()=>({}));
  if(!r.ok)throw new Error(body.error||'Orbit could not save this yet.');
  return body;
 }finally{clearTimeout(timer)}
}
function initMobileHandoffModal(){
 if(detectOS()!=='mobile')return;
 const modal=document.getElementById('mobile-handoff-modal'),form=document.getElementById('mobile-handoff-form');
 if(!modal||!form)return;
 const firstName=document.getElementById('mobile-handoff-first-name'),email=document.getElementById('mobile-handoff-email'),error=document.getElementById('mobile-handoff-error'),submit=document.getElementById('mobile-handoff-submit'),success=document.getElementById('mobile-handoff-success'),formState=document.getElementById('mobile-handoff-form-state'),copy=document.getElementById('mobile-handoff-copy'),toast=document.getElementById('mobile-handoff-toast');
 const attribution=handoffAttribution(),visitorId=handoffVisitor();
 let continueUrl='',started=false,closeTimer=0;
 const markerKey='orbit_handoff_captured_v1',dismissKey='orbit_handoff_dismissed_v1';
 const markStarted=()=>{if(started)return;started=true;void handoffApi('/api/handoff/event',{visitorId,stage:'started',...attribution}).catch(()=>{})};
 const openModal=()=>{
  if(closeTimer)clearTimeout(closeTimer);
  modal.hidden=false;modal.setAttribute('aria-hidden','false');document.body.classList.add('handoff-modal-open');
  requestAnimationFrame(()=>{modal.classList.add('is-open');setTimeout(()=>firstName.focus({preventScroll:true}),180)});
 };
 const closeModal=()=>{
  modal.classList.remove('is-open');document.body.classList.remove('handoff-modal-open');
  setTimeout(()=>{modal.hidden=true;modal.setAttribute('aria-hidden','true')},220);
 };
 document.querySelectorAll('[data-orbit-download]').forEach(button=>button.addEventListener('click',e=>{
  if(button.dataset.downloadState!=='handoff')return;
  e.preventDefault();openModal();
 }));
 document.querySelectorAll('[data-handoff-close]').forEach(button=>button.addEventListener('click',()=>{try{sessionStorage.setItem(dismissKey,'1')}catch(_){}closeModal()}));
 document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!modal.hidden)closeModal()});
 firstName.addEventListener('focus',markStarted);email.addEventListener('focus',markStarted);
 form.addEventListener('submit',async e=>{
  e.preventDefault();error.hidden=true;
  const name=firstName.value.trim(),address=email.value.trim();
  if(!name){error.textContent='Enter your first name.';error.hidden=false;firstName.focus();return}
  if(!/^\S+@\S+\.\S+$/.test(address)){error.textContent='Enter a valid email.';error.hidden=false;email.focus();return}
  submit.disabled=true;submit.classList.add('loading');submit.querySelector('span').textContent='Saving your Orbit…';
  try{
   const data=await handoffApi('/api/handoff/start',{firstName:name,email:address,visitorId,...attribution});
   continueUrl=data.continueUrl||'';try{localStorage.setItem('orbit_handoff_continue',continueUrl)}catch(_){}
   formState.hidden=true;success.hidden=false;
   const delivered=data.emailStatus==='delivered';
   const accepted=data.emailStatus==='accepted'||data.emailStatus==='sent';
   document.getElementById('mobile-handoff-success-title').textContent=delivered?'You’re in.':accepted?'Email is on its way.':'Your Orbit is saved.';
   document.getElementById('mobile-handoff-success-copy').textContent=delivered
    ?'Your desktop link was delivered to '+address+'.'
    :accepted
     ?'Your email provider accepted the handoff for '+address+'. Keep the desktop link below as a backup until it arrives.'
     :'Email delivery is unavailable right now. Use the desktop link below immediately.';
   copy.hidden=!continueUrl;
   if(delivered){
    try{localStorage.setItem(markerKey,String(Date.now()))}catch(_){}
    closeTimer=setTimeout(()=>{closeModal();toast.hidden=false;toast.classList.add('is-visible');setTimeout(()=>{toast.classList.remove('is-visible');setTimeout(()=>{toast.hidden=true},220)},2800)},1350);
   }
  }catch(err){error.textContent=err.message||'Orbit could not save this yet.';error.hidden=false}
  finally{submit.disabled=false;submit.classList.remove('loading');submit.querySelector('span').textContent='Send Orbit to my computer'}
 });
 copy.addEventListener('click',async()=>{if(!continueUrl)return;try{await navigator.clipboard.writeText(continueUrl);copy.textContent='Desktop link copied ✓'}catch(_){}});
 void handoffApi('/api/handoff/event',{visitorId,stage:'landing',...attribution}).catch(()=>{});
 let completed=false,dismissed=false;
 try{completed=Boolean(localStorage.getItem(markerKey));dismissed=sessionStorage.getItem(dismissKey)==='1'}catch(_){}
 if(!completed&&!dismissed)setTimeout(openModal,180);
}

const downloadReady=initDownload();
initMobileHandoffModal();
document.querySelectorAll('[data-orbit-download]').forEach(button=>button.addEventListener('click',async event=>{
 if(button.getAttribute('aria-disabled')==='true'){event.preventDefault();return}
 if(button.dataset.downloadState!=='loading')return;
 // A click during release lookup waits for the actual installer instead of jumping to a tutorial.
 event.preventDefault();await downloadReady;
 const href=button.getAttribute('href');if(href&&button.getAttribute('aria-disabled')!=='true')window.location.assign(href);
}));
(()=>{
 const $=s=>document.querySelector(s),all=s=>[...document.querySelectorAll(s)],clamp=(v,a=0,b=1)=>Math.min(b,Math.max(a,v));
 const reduced=matchMedia('(prefers-reduced-motion: reduce)'),fine=matchMedia('(hover:hover) and (pointer:fine)'),connection=navigator.connection;
 const toggle=$('#motion-toggle'),aura=$('.cursor-aura'),story=$('.story'),stage=$('.story-stage'),chapters=all('.story-step'),layers=all('.scene-layer'),rail=$('.story-rail i'),hero=$('.hero-playground');
 let optedOut=false;try{optedOut=sessionStorage.getItem('orbit_motion_off')==='1'}catch(_){}
 let enabled=false,frame=0,last=0,dirty=true,heroVisible=true,stripVisible=false,pointerSeen=false,manualScene=null;
 const pointer={x:0,y:0,px:0,py:0};let auraX=0,auraY=0;
 const moving=all('.float-card,.magnet>.btn').map(el=>({el,host:el.closest('.float-wrap,.magnet'),x:0,y:0,tx:0,ty:0,vx:0,vy:0,drag:false,id:null,startX:0,startY:0,lastX:0,lastY:0,moved:false,suppress:false}));
 function schedule(){if(!frame&&!document.hidden)frame=requestAnimationFrame(tick)}
 function setScene(progress){const scaled=clamp(progress)*3,step=Math.round(scaled);stage.dataset.step=String(step);stage.dataset.progress=progress.toFixed(4);layers.forEach((el,i)=>{const active=i===step,w=active?clamp((.5-Math.abs(scaled-i))/.15):0;el.style.opacity=String(w);el.style.visibility=w>.001?'visible':'hidden';el.style.transform=enabled?'translateY('+(Math.abs(i-scaled)*10)+'px) scale('+(0.97+w*.03)+')':'none';el.classList.toggle('is-current',i===step);el.setAttribute('aria-hidden',String(i!==step));el.inert=i!==step});chapters.forEach((b,i)=>b.setAttribute('aria-pressed',String(i===step)));rail.style.transform='scaleX('+Math.max(.02,progress)+')';$('#phase-label').textContent=['01 — Your brief','02 — Research','03 — Contact','04 — Your draft'][step]}
 function pinned(){return enabled&&innerWidth>=900&&innerHeight>=680}
 function sceneProgress(){if(manualScene!==null)return manualScene;const r=story.getBoundingClientRect();return pinned()?clamp((100-r.top)/Math.max(1,r.height-(innerHeight-150))):clamp((innerHeight*.5-r.top)/Math.max(1,r.height-innerHeight*.2))}
 function chooseScene(i){const p=i/3;if(pinned()){const r=story.getBoundingClientRect();manualScene=null;window.scrollTo({top:scrollY+r.top-100+p*Math.max(1,r.height-(innerHeight-150)),behavior:'auto'})}else{manualScene=p;setScene(p)}dirty=true;schedule()}
 chapters.forEach(b=>b.addEventListener('click',()=>chooseScene(Number(b.dataset.step))));
 function settings(){if($('#interaction-hint'))$('#interaction-hint').textContent=fine.matches?'Drag a card. Follow the work.':'Tap a card. Follow the work.';enabled=!optedOut&&!reduced.matches&&!connection?.saveData;document.body.classList.toggle('motion-enabled',enabled);document.body.classList.toggle('motion-off',!enabled);toggle.hidden=false;toggle.textContent=enabled?'Pause motion':'Motion off';toggle.setAttribute('aria-pressed',String(!enabled));aura.style.opacity='0';if(!enabled){moving.forEach(s=>{s.x=s.y=s.tx=s.ty=s.vx=s.vy=0;s.drag=false;s.el.style.transform='';if(s.id!==null&&s.el.hasPointerCapture?.(s.id))s.el.releasePointerCapture(s.id);s.id=null});manualScene=0;all('.motion-reveal').forEach(el=>el.classList.add('seen'));setScene(0)}else{manualScene=null}dirty=true;schedule()}
 toggle.addEventListener('click',()=>{optedOut=!optedOut;try{sessionStorage.setItem('orbit_motion_off',optedOut?'1':'0')}catch(_){}settings()});reduced.addEventListener('change',settings);fine.addEventListener('change',()=>{aura.style.opacity='0';moving.forEach(s=>{s.tx=s.ty=0});schedule()});connection?.addEventListener?.('change',settings);
 moving.forEach(s=>{
  s.host.addEventListener('pointermove',e=>{if(!enabled||!fine.matches||e.pointerType==='touch'||s.drag)return;const r=s.host.getBoundingClientRect(),max=s.el.classList.contains('btn')?5:9;s.tx=clamp((e.clientX-r.left)/r.width-.5,-.5,.5)*max*2;s.ty=clamp((e.clientY-r.top)/r.height-.5,-.5,.5)*max*2;schedule()});
  s.host.addEventListener('pointerleave',()=>{if(!s.drag){s.tx=s.ty=0;schedule()}});
  if(!s.el.classList.contains('float-card'))return;
  s.el.addEventListener('pointerdown',e=>{if(!enabled||!fine.matches||e.pointerType!=='mouse'||e.button!==0)return;s.drag=true;s.id=e.pointerId;s.startX=e.clientX-s.x;s.startY=e.clientY-s.y;s.lastX=e.clientX;s.lastY=e.clientY;s.moved=false;s.el.setPointerCapture(e.pointerId);schedule()});
  s.el.addEventListener('pointermove',e=>{if(!s.drag||e.pointerId!==s.id)return;s.tx=clamp(e.clientX-s.startX,-48,48);s.ty=clamp(e.clientY-s.startY,-38,38);s.moved ||= Math.hypot(e.clientX-s.lastX,e.clientY-s.lastY)>3;schedule()});
  const release=e=>{if(!s.drag||e.pointerId!==s.id)return;s.drag=false;s.suppress=s.moved;s.tx=s.ty=0;if(s.el.hasPointerCapture(e.pointerId))s.el.releasePointerCapture(e.pointerId);s.id=null;schedule();setTimeout(()=>{s.suppress=false},0)};
  s.el.addEventListener('pointerup',release);s.el.addEventListener('pointercancel',release);s.el.addEventListener('lostpointercapture',e=>{if(s.drag)release(e)});
  s.el.addEventListener('click',e=>{if(s.suppress){e.preventDefault();return}const i=Number(s.el.dataset.sceneJump);story.scrollIntoView({behavior:'auto',block:'start'});requestAnimationFrame(()=>chooseScene(i))});
 });
 document.addEventListener('pointermove',e=>{if(!enabled||!fine.matches||e.pointerType!=='mouse')return;if(!pointerSeen){auraX=e.clientX;auraY=e.clientY}pointerSeen=true;pointer.x=e.clientX;pointer.y=e.clientY;const excluded=e.target.closest('video,input,textarea,[contenteditable="true"],select');aura.style.opacity=excluded?'0':'1';aura.dataset.active=String(Boolean(e.target.closest('a,button,.company-window')));schedule()},{passive:true});
 document.addEventListener('pointerout',e=>{if(!e.relatedTarget){pointerSeen=false;aura.style.opacity='0';moving.forEach(s=>{if(!s.drag)s.tx=s.ty=0});schedule()}});
 document.addEventListener('keydown',()=>{pointerSeen=false;aura.style.opacity='0'});
 all('.context-panel').forEach(el=>el.addEventListener('pointermove',e=>{if(!enabled||!fine.matches)return;const r=el.getBoundingClientRect();el.style.setProperty('--glow-x',(e.clientX-r.left)+'px');el.style.setProperty('--glow-y',(e.clientY-r.top)+'px')},{passive:true}));
 // Inertial company-name strip: no click-through endorsement; keyboard equivalent.
 const strip=$('.company-window'),track=$('.company-track'),set=$('.company-set'),copy=set.cloneNode(true);copy.setAttribute('aria-hidden','true');copy.inert=true;track.append(copy);
 let stripX=0,stripWidth=1,stripDrag=false,stripId=null,stripPX=0,velocity=0,stripHover=false,stripFocus=false,stripTime=0;
 function layout(){stripWidth=Math.max(1,set.getBoundingClientRect().width);dirty=true;schedule()}
 strip.addEventListener('pointerenter',()=>{stripHover=true});strip.addEventListener('pointerleave',()=>{stripHover=false;schedule()});strip.addEventListener('focusin',()=>{stripFocus=true});strip.addEventListener('focusout',()=>{stripFocus=false;schedule()});
 // Touch stays native vertically; arrows provide the horizontal action on phones.
 strip.addEventListener('pointerdown',e=>{if(e.pointerType!=='mouse'||e.button!==0)return;stripDrag=true;stripId=e.pointerId;stripPX=e.clientX;stripTime=e.timeStamp;velocity=0;strip.setPointerCapture(e.pointerId);schedule()});
 strip.addEventListener('pointermove',e=>{if(!stripDrag||e.pointerId!==stripId)return;const dx=e.clientX-stripPX;velocity=clamp(dx/Math.max(8,e.timeStamp-stripTime),-2,2)*16;stripX+=dx;stripPX=e.clientX;stripTime=e.timeStamp;schedule()});
 function releaseStrip(e){if(e.pointerId!==stripId)return;stripDrag=false;if(strip.hasPointerCapture(e.pointerId))strip.releasePointerCapture(e.pointerId);stripId=null;if(!enabled)velocity=0;schedule()}
 strip.addEventListener('pointerup',releaseStrip);strip.addEventListener('pointercancel',releaseStrip);strip.addEventListener('lostpointercapture',e=>{if(stripDrag)releaseStrip(e)});
 function advance(dx){stripX+=dx;velocity=0;schedule()}
 $('#company-prev').addEventListener('click',()=>advance(220));$('#company-next').addEventListener('click',()=>advance(-220));strip.addEventListener('keydown',e=>{if(e.key==='ArrowRight'||e.key==='ArrowLeft'){e.preventDefault();advance(e.key==='ArrowRight'?-220:220)}});
 function tick(now){frame=0;const dt=Math.min(2,(now-(last||now))/16.667||1);last=now;let keep=false;
  if(dirty){dirty=false;const max=document.documentElement.scrollHeight-innerHeight;$('.reading-progress').style.transform='scaleX('+clamp(scrollY/Math.max(1,max))+')';if(enabled||manualScene!==null)setScene(sceneProgress());const r=hero.getBoundingClientRect(),hp=clamp(-r.top/Math.max(1,r.height));all('.float-wrap').forEach((el,i)=>{el.style.transform=enabled?'translateY('+(-hp*(i%2?18:32))+'px)':'none'})}
  if(enabled){moving.forEach(s=>{s.vx=(s.vx+(s.tx-s.x)*.13*dt)*Math.pow(.7,dt);s.vy=(s.vy+(s.ty-s.y)*.13*dt)*Math.pow(.7,dt);s.x+=s.vx*dt;s.y+=s.vy*dt;if(Math.abs(s.x-s.tx)+Math.abs(s.y-s.ty)+Math.abs(s.vx)+Math.abs(s.vy)>.06)keep=true;else{s.x=s.tx;s.y=s.ty;s.vx=s.vy=0}s.el.style.transform='translate3d('+s.x.toFixed(3)+'px,'+s.y.toFixed(3)+'px,0)'});
   if(pointerSeen&&fine.matches){auraX+=(pointer.x-auraX)*Math.min(1,.18*dt);auraY+=(pointer.y-auraY)*Math.min(1,.18*dt);aura.style.transform='translate3d('+auraX.toFixed(2)+'px,'+auraY.toFixed(2)+'px,0) translate(-50%,-50%)';if(Math.abs(pointer.x-auraX)+Math.abs(pointer.y-auraY)>.2)keep=true}
   if(!stripDrag&&Math.abs(velocity)>.08){stripX+=velocity*dt;velocity*=Math.pow(.9,dt);keep=true}else if(!stripDrag&&stripVisible&&!stripHover&&!stripFocus){stripX-=.36*dt;keep=true}
  }
  stripX=((stripX%stripWidth)+stripWidth)%stripWidth-stripWidth;track.style.transform='translate3d('+stripX.toFixed(2)+'px,0,0)';
  if(keep)schedule();else last=0;
 }
 window.addEventListener('scroll',()=>{manualScene=null;dirty=true;schedule()},{passive:true});window.addEventListener('resize',layout,{passive:true});
 document.addEventListener('visibilitychange',()=>{hero.classList.toggle('offscreen',document.hidden||!heroVisible);pointerSeen=false;aura.style.opacity='0';if(document.hidden){cancelAnimationFrame(frame);frame=0;last=0;moving.forEach(s=>{s.drag=false;s.tx=s.ty=0});stripDrag=false;velocity=0}else{dirty=true;schedule()}});
 if('IntersectionObserver'in window){const io=new IntersectionObserver(entries=>{entries.forEach(e=>{if(e.target===hero){heroVisible=e.isIntersecting;hero.classList.toggle('offscreen',!heroVisible||document.hidden)}else if(e.target===strip){stripVisible=e.isIntersecting;schedule()}else if(e.isIntersecting){e.target.classList.add('seen');io.unobserve(e.target)}})},{threshold:.08});io.observe(hero);io.observe(strip);all('.motion-reveal').forEach(el=>io.observe(el))}else{all('.motion-reveal').forEach(el=>el.classList.add('seen'));stripVisible=true}
 // Full-resolution source; CSS controls layout, not the previous 910px/DPR ceiling.
 const video=$('#hero-demo');let videoInView=false,userPaused=false;
 video.addEventListener('loadedmetadata',()=>{if(Number.isFinite(video.duration))$('#video-duration').textContent=Math.round(video.duration)+'s · 1080p'});
 video.addEventListener('error',()=>{$('#video-fallback').hidden=false});
 video.addEventListener('pause',()=>{if(videoInView&&!document.hidden)userPaused=true});
 const playVideo=()=>{if(enabled&&videoInView&&!userPaused&&!document.hidden)video.play().catch(()=>{})};
 if('IntersectionObserver'in window)new IntersectionObserver(entries=>{videoInView=entries[0].isIntersecting;if(videoInView)playVideo();else video.pause()},{threshold:.35}).observe(video);
 video.addEventListener('play',()=>{userPaused=false});document.addEventListener('visibilitychange',()=>{if(document.hidden)video.pause();else playVideo()});
 all('a[data-watch-demo],[data-orbit-download]').forEach(a=>a.addEventListener('click',()=>{if(a.getAttribute('href')==='#demo'){userPaused=false;video.play().catch(()=>{})}}));
 reduced.addEventListener('change',()=>{if(reduced.matches)video.pause()});toggle.addEventListener('click',()=>{if(!enabled)video.pause()});
 settings();if(!enabled){video.autoplay=false;video.pause()}layout();
})();
