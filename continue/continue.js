'use strict';
const API='https://backend-production-2b40.up.railway.app',REPO='FutureWarren/recruiting-agent';
const token=new URLSearchParams(location.search).get('token')||'';
const $=id=>document.getElementById(id);
function os(){const ua=navigator.userAgent||'',p=navigator.userAgentData?.platform||'';if(/Android|iPhone|iPad|iPod/i.test(ua)||(/Macintosh/.test(ua)&&(navigator.maxTouchPoints||0)>1))return'mobile';if(/windows/i.test(p)||/Windows|Win64|Win32|WOW64/i.test(ua))return'win';if(/macos|mac os/i.test(p)||/Macintosh|Mac OS X/i.test(ua))return'mac';return'other'}
async function architecture(){
 try{
  const value=await navigator.userAgentData?.getHighEntropyValues?.(['architecture']);
  if(value?.architecture==='arm')return 'arm64';
  if(value?.architecture==='x86')return 'x64';
 }catch(_){}
 try{
  const gl=document.createElement('canvas').getContext('webgl');
  const info=gl?.getExtension('WEBGL_debug_renderer_info');
  const renderer=info?String(gl.getParameter(info.UNMASKED_RENDERER_WEBGL)):'';
  if(/apple/i.test(renderer))return 'arm64';
  if(/intel|radeon|amd|nvidia/i.test(renderer))return 'x64';
 }catch(_){}
 return null;
}
async function requestJson(url,options,timeout,message){
 const controller=new AbortController();
 const timer=setTimeout(()=>controller.abort(),timeout);
 try{
  const response=await fetch(url,{...options,signal:controller.signal});
  if(!response.ok){
   const data=await response.json().catch(()=>null);
   throw new Error(data?.error||message);
  }
  const data=await response.json();
  return data;
 }catch(error){
  if(controller.signal.aborted)throw new Error(message);
  throw error;
 }finally{clearTimeout(timer)}
}
function api(path,options={}){
 return requestJson(API+path,{...options,keepalive:path==='/api/handoff/event',headers:{'content-type':'application/json',...(options.headers||{})}},10000,'Orbit could not open this handoff. Please try again.');
}
async function installer(platform){
 const releases=await requestJson('https://api.github.com/repos/'+REPO+'/releases?per_page=10',{},5000,'Installer lookup timed out.');
 if(!Array.isArray(releases))throw new Error('Release unavailable');
 const matcher=platform==='win'?/-x64-Setup\.exe$/i:/arm64.*\.dmg$/i;
 for(const rel of releases){
  if(rel?.draft)continue;
  const asset=(rel.assets||[]).find(a=>matcher.test(a.name||'')&&/^https:\/\//.test(a.browser_download_url||''));
  if(asset)return asset.browser_download_url;
 }
 throw new Error('No installer available for this platform');
}
function fail(message){document.body.classList.add('error');$('eyebrow').textContent='HANDOFF UNAVAILABLE';$('title').textContent='This link needs a refresh.';$('copy').textContent=message;$('status').textContent='You can start again from the Orbit website.'}
(async()=>{
 if(!/^[A-Za-z0-9_-]{20,40}\.[A-Za-z0-9_-]{40,60}$/.test(token)){fail('The desktop handoff token is missing or invalid.');return}
 try{
  const platform=os();
  const data=await api('/api/handoff/resolve',{method:'POST',body:JSON.stringify({token,platform})});
  // Only the signed handoff's server response can name an inviter. Never use
  // URL parameters or HTML, and keep ordinary/non-referral handoffs unchanged.
  if(typeof data.inviter==='string'&&data.inviter.trim()){
    $('eyebrow').textContent=data.inviter.trim().slice(0,80)+' invited you to Orbit.';
  }
  $('title').textContent=data.firstName?'Welcome, '+data.firstName+'.':'Welcome to Orbit.';
  $('copy').textContent='Your phone handoff made it here. Finish on your computer and put Orbit to work.';
  if(data.goal){$('goal').textContent=data.goal;$('detail').textContent=data.detail||'';$('detail').hidden=!data.detail;$('receipt').hidden=false}else{$('receipt').hidden=true}
  $('actions').hidden=false;
  const open='orbit://handoff?token='+encodeURIComponent(token);$('open-app').href=open;
  const download=$('download'),openApp=$('open-app'),actions=$('actions'),status=$('status');
  const desktop=platform==='mac'||platform==='win';
  const arch=desktop?await architecture():null;
  const unsupportedArchitecture=(platform==='mac'&&arch==='x64')||(platform==='win'&&arch==='arm64');
  const supportsInstaller=desktop&&!unsupportedArchitecture;
  const progressKey='orbit_handoff_download_started_v1:'+token.split('.')[0];
  let downloadStarted=false;
  const promoteOpenApp=()=>{
    if(!supportsInstaller)return;
    downloadStarted=true;
    try{sessionStorage.setItem(progressKey,'1')}catch(_){}
    openApp.classList.remove('secondary');openApp.classList.add('primary');
    download.classList.remove('primary');download.classList.add('secondary');
    openApp.innerHTML='Open Orbit and continue <b>→</b>';
    if(actions.firstElementChild!==openApp)actions.prepend(openApp);
    status.textContent='Finish installing Orbit, then open it here. Your saved setup will carry over automatically.';
  };
  if(supportsInstaller&&platform==='mac'){
    $('download').textContent='Finding the latest Mac build…';
    try{const url=await installer('mac');$('download').href=url;$('download').innerHTML='Download Orbit for Mac <b>↗</b>'}catch(_){$('download').href='https://github.com/'+REPO+'/releases';$('download').innerHTML='View Mac downloads <b>↗</b>'}
    $('status').textContent='After installing, open Orbit from this page so it can pick up your saved handoff.';
  }else if(supportsInstaller&&platform==='win'){
    $('download').textContent='Finding the latest Windows build…';
    try{const url=await installer('win');$('download').href=url;$('download').classList.remove('disabled');$('download').innerHTML='Download Orbit for Windows <b>↗</b>'}catch(_){$('download').href='https://github.com/'+REPO+'/releases';$('download').classList.remove('disabled');$('download').innerHTML='View Windows downloads <b>↗</b>'}
    $('status').textContent='Windows x64 beta is currently unsigned, so SmartScreen may show an Unknown Publisher warning. After installing, return here and open Orbit to continue your saved setup.';
  }else{
    download.href='#';download.innerHTML='Copy / share desktop link <b>↗</b>';
    openApp.hidden=true;
    status.textContent=unsupportedArchitecture
      ? 'Orbit supports Apple Silicon Macs (M1 and later) and Windows x64. Open this link on a supported computer.'
      : 'Orbit is a Mac and Windows app. Open this same link on your computer to download and install it.';
    download.addEventListener('click',async event=>{
      event.preventDefault();
      const link=location.href;
      try{
        if(navigator.share){await navigator.share({title:'Get Orbit on my computer',url:link});return}
        await navigator.clipboard.writeText(link);
        status.textContent='Link copied. Open it on your Mac or Windows computer.';
      }catch(_){status.textContent='Could not share automatically. Copy the address from your browser and open it on your computer.'}
    });
  }
  try{if(sessionStorage.getItem(progressKey)==='1')promoteOpenApp()}catch(_){}
  download.addEventListener('click',()=>{
    if(!supportsInstaller)return;
    // Count installer intent, not an installation. Release-index fallback is not a binary click.
    const url=download.getAttribute('href')||'';
    if (/\.(dmg|exe)(?:[?#]|$)/i.test(url)) {
      void api('/api/handoff/event',{method:'POST',body:JSON.stringify({stage:'installer_clicked_v2',token,platform})}).catch(()=>{});
    }
    void api('/api/handoff/event',{method:'POST',body:JSON.stringify({stage:'download_clicked',token,platform})}).catch(()=>{});
    promoteOpenApp();
  });
  openApp.addEventListener('click',()=>{void api('/api/handoff/event',{method:'POST',body:JSON.stringify({stage:'open_app_clicked',token})}).catch(()=>{})});
  window.addEventListener('focus',()=>{if(downloadStarted)promoteOpenApp()});
 }catch(err){fail(err.message||'The link may have expired.')}
})();
