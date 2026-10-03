'use strict';
const API='https://backend-production-2b40.up.railway.app',REPO='FutureWarren/recruiting-agent';
const token=new URLSearchParams(location.search).get('token')||'';
const $=id=>document.getElementById(id);
function os(){const ua=navigator.userAgent||'',p=navigator.userAgentData?.platform||'';if(/windows/i.test(p)||/Windows|Win64|Win32|WOW64/i.test(ua))return'win';if(/macos|mac os/i.test(p)||/Macintosh|Mac OS X/i.test(ua))return'mac';if(/Android|iPhone|iPad|iPod/i.test(ua))return'mobile';return'other'}
async function api(path,options={}){const r=await fetch(API+path,{...options,headers:{'content-type':'application/json',...(options.headers||{})}});const b=await r.json().catch(()=>({}));if(!r.ok)throw new Error(b.error||'This handoff could not be opened.');return b}
async function installer(platform){
 const r=await fetch('https://api.github.com/repos/'+REPO+'/releases/latest');if(!r.ok)throw new Error('release unavailable');const rel=await r.json(),assets=rel.assets||[];
 const asset=platform==='win'
  ? assets.find(a=>/-x64-Setup\.exe$/i.test(a.name||''))
  : assets.find(a=>/arm64.*\.dmg$/i.test(a.name||''));
 return asset?.browser_download_url||'https://github.com/'+REPO+'/releases/latest'
}
function fail(message){document.body.classList.add('error');$('eyebrow').textContent='HANDOFF UNAVAILABLE';$('title').textContent='This link needs a refresh.';$('copy').textContent=message;$('status').textContent='You can start again from the Orbit website.'}
(async()=>{
 if(!/^[A-Za-z0-9_-]{20,40}\.[A-Za-z0-9_-]{40,60}$/.test(token)){fail('The desktop handoff token is missing or invalid.');return}
 try{
  const data=await api('/api/handoff/resolve',{method:'POST',body:JSON.stringify({token})});
  $('title').textContent=data.firstName?'Welcome, '+data.firstName+'.':'Welcome back.';
  $('copy').textContent='Your phone handoff made it here. Finish on your computer and put Orbit to work.';
  if(data.goal){$('goal').textContent=data.goal;$('detail').textContent=data.detail||'';$('detail').hidden=!data.detail;$('receipt').hidden=false}else{$('receipt').hidden=true}
  $('actions').hidden=false;
  const open='orbit://handoff?token='+encodeURIComponent(token);$('open-app').href=open;
  const platform=os();
  if(platform==='mac'){
    $('download').textContent='Finding the latest Mac build…';
    try{const url=await installer('mac');$('download').href=url;$('download').innerHTML='Download Orbit for Mac <b>↗</b>'}catch(_){$('download').href='https://github.com/'+REPO+'/releases/latest';$('download').innerHTML='View Mac downloads <b>↗</b>'}
    $('status').textContent='After installing, open Orbit from this page so it can pick up your saved handoff.';
  }else if(platform==='win'){
    $('download').textContent='Finding the latest Windows build…';
    try{const url=await installer('win');$('download').href=url;$('download').classList.remove('disabled');$('download').innerHTML='Download Orbit for Windows <b>↗</b>'}catch(_){$('download').href='https://github.com/'+REPO+'/releases/latest';$('download').classList.remove('disabled');$('download').innerHTML='View Windows downloads <b>↗</b>'}
    $('status').textContent='Windows x64 beta is currently unsigned, so SmartScreen may show an Unknown Publisher warning. After installing, return here and open Orbit to continue your saved setup.';
  }else{
    $('download').href='/start/';$('download').innerHTML='Open this page on your computer <b>→</b>';
    $('status').textContent='This handoff is meant for a desktop computer. Your setup will stay available until the link expires.';
  }
  $('download').addEventListener('click',()=>{void api('/api/handoff/event',{method:'POST',body:JSON.stringify({stage:'download_clicked',token})}).catch(()=>{})});
  $('open-app').addEventListener('click',()=>{void api('/api/handoff/event',{method:'POST',body:JSON.stringify({stage:'open_app_clicked',token})}).catch(()=>{})});
 }catch(err){fail(err.message||'The link may have expired.')}
})();
