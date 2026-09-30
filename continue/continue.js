'use strict';
const API='https://backend-production-2b40.up.railway.app',REPO='FutureWarren/recruiting-agent';
const token=new URLSearchParams(location.search).get('token')||'';
const $=id=>document.getElementById(id);
function os(){const ua=navigator.userAgent||'',p=navigator.userAgentData?.platform||'';if(/windows/i.test(p)||/Windows|Win64|Win32|WOW64/i.test(ua))return'win';if(/macos|mac os/i.test(p)||/Macintosh|Mac OS X/i.test(ua))return'mac';if(/Android|iPhone|iPad|iPod/i.test(ua))return'mobile';return'other'}
async function api(path,options={}){const r=await fetch(API+path,{...options,headers:{'content-type':'application/json',...(options.headers||{})}});const b=await r.json().catch(()=>({}));if(!r.ok)throw new Error(b.error||'This handoff could not be opened.');return b}
async function installer(){
 const r=await fetch('https://api.github.com/repos/'+REPO+'/releases/latest');if(!r.ok)throw new Error('release unavailable');const rel=await r.json();
 return (rel.assets||[]).find(a=>/arm64.*\.dmg$/i.test(a.name||''))?.browser_download_url||'https://github.com/'+REPO+'/releases/latest'
}
function fail(message){document.body.classList.add('error');$('eyebrow').textContent='HANDOFF UNAVAILABLE';$('title').textContent='This link needs a refresh.';$('copy').textContent=message;$('status').textContent='You can start again from the Orbit website.'}
(async()=>{
 if(!/^[A-Za-z0-9_-]{20,40}\\.[A-Za-z0-9_-]{40,60}$/.test(token)){fail('The desktop handoff token is missing or invalid.');return}
 try{
  const data=await api('/api/handoff/'+encodeURIComponent(token));
  $('title').textContent='Welcome back.';
  $('copy').textContent='Your phone setup made it here. Finish on your computer — no need to type the recruiting goal again.';
  $('goal').textContent=data.goal;$('detail').textContent=data.detail||'';$('detail').hidden=!data.detail;$('receipt').hidden=false;$('actions').hidden=false;
  const open='orbit://handoff?token='+encodeURIComponent(token);$('open-app').href=open;
  const platform=os();
  if(platform==='mac'){
    $('download').textContent='Finding the latest Mac build…';
    try{const url=await installer();$('download').href=url;$('download').innerHTML='Download Orbit for Mac <b>↗</b>'}catch(_){$('download').href='https://github.com/'+REPO+'/releases/latest';$('download').innerHTML='View Mac downloads <b>↗</b>'}
    $('status').textContent='After installing, open Orbit from this page so it can pick up the saved goal.';
  }else if(platform==='win'){
    $('download').removeAttribute('href');$('download').classList.add('disabled');$('download').innerHTML='Windows build not released yet <b>·</b>';
    $('status').textContent='Your setup is saved. Keep this link — Windows support is not public yet.';
  }else{
    $('download').href='/start/';$('download').innerHTML='Open this page on your computer <b>→</b>';
    $('status').textContent='This handoff is meant for a desktop computer. Your setup will stay available until the link expires.';
  }
  $('download').addEventListener('click',()=>{void api('/api/handoff/event',{method:'POST',body:JSON.stringify({stage:'download_clicked',token})}).catch(()=>{})});
  $('open-app').addEventListener('click',()=>{void api('/api/handoff/event',{method:'POST',body:JSON.stringify({stage:'open_app_clicked',token})}).catch(()=>{})});
 }catch(err){fail(err.message||'The link may have expired.')}
})();
