'use strict';
// One-time style analysis. Photo bytes are only sent after explicit consent.
// The website never invents match scores: all scores must come from a real server response.
const API = 'https://backend-production-2b40.up.railway.app';
const $ = id => document.getElementById(id);
const archetypes = [
  {id:'wall-street',title:'Wall Street',subtitle:'Tailored & polished'},
  {id:'consulting',title:'Consulting',subtitle:'Composed & approachable'},
  {id:'tech',title:'Tech',subtitle:'Relaxed & minimal'},
  {id:'founder',title:'Founder',subtitle:'Expressive & individual'},
  {id:'client-facing',title:'Client-facing',subtitle:'Warm & personable'}
];
const MAX_BYTES = 5 * 1024 * 1024;
let photo = null, previewUrl = null, stream = null, report = null, controller = null;
let imageDetectorPromise = null, serverReady = false;
function error(message){$('error').textContent=message;$('error').hidden=!message;}
function enable(){ $('analyze').disabled = !(photo && $('consent').checked && serverReady); }
async function detector(){
  if(!imageDetectorPromise) imageDetectorPromise=(async()=>{
    const mp=await import('https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.22/+esm');
    const vision=await mp.FilesetResolver.forVisionTasks('https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.22/wasm');
    return mp.FaceDetector.createFromOptions(vision,{baseOptions:{modelAssetPath:'https://storage.googleapis.com/mediapipe-models/face_detector/blaze_face_short_range/float16/1/blaze_face_short_range.tflite'},runningMode:'IMAGE',minDetectionConfidence:0.5});
  })().catch(()=>null);
  return imageDetectorPromise;
}
async function checkSingleFace(blob){
  const model=await detector();if(!model) return {ok:true,warning:'On-device face checking unavailable; server will still analyze visual style.'};
  const bitmap=await createImageBitmap(blob);
  try{const faces=model.detect(bitmap).detections||[];
    if(faces.length!==1)return {ok:false,message:faces.length===0?'We could not find one clear face. Try a brighter, front-facing photo.':'Please use a solo photo with just one face.'};
    const b=faces[0].boundingBox;if(b&&Math.min(b.width,b.height)<65)return {ok:false,message:'Please choose a closer photo with a larger, clearer face.'};
    return {ok:true};
  }finally{bitmap.close();}
}
async function initialize(){
  try{const response=await fetch(API+'/api/face-match/config',{cache:'no-store'});const data=await response.json();serverReady=response.ok&&data.ready===true;}
  catch{serverReady=false;}
  if(!serverReady){$('camera-note').textContent='Face Match analysis is not yet enabled. You can preview the interface, but scoring is temporarily unavailable.';}
  enable();
}
function stopCamera(){ if(stream){stream.getTracks().forEach(track=>track.stop());stream=null;} $('camera').srcObject=null;$('camera').hidden=true;$('camera-actions').hidden=true;$('open-camera').hidden=false; }
function clearPhoto(){stopCamera();if(previewUrl){URL.revokeObjectURL(previewUrl);previewUrl=null;}photo=null;$('photo-preview').hidden=true;$('photo-placeholder').hidden=false;$('photo-input').value='';enable();}
async function usePhoto(file) {
  error('');
  if(!file || !['image/jpeg','image/png','image/webp'].includes(file.type)){error('Please select a JPEG, PNG or WebP image.');return;}
  if(file.size<100 || file.size>MAX_BYTES){error('Choose a photo smaller than 5 MB.');return;}
  // Downsample locally before any upload; avoids shipping huge original images.
  try {
    const bitmap=await createImageBitmap(file);
    const ratio=Math.min(1,1280/Math.max(bitmap.width,bitmap.height));
    const canvas=document.createElement('canvas');
    canvas.width=Math.max(1,Math.round(bitmap.width*ratio));
    canvas.height=Math.max(1,Math.round(bitmap.height*ratio));
    canvas.getContext('2d').drawImage(bitmap,0,0,canvas.width,canvas.height);
    bitmap.close();
    const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/jpeg',.82));
    if(!blob) throw new Error('Image conversion failed.');
    const checked=await checkSingleFace(blob);
    if(!checked.ok){error(checked.message);return;}
    clearPhoto();photo=blob;previewUrl=URL.createObjectURL(blob);
    if(checked.warning)$('camera-note').textContent=checked.warning;
    $('photo-preview').src=previewUrl;$('photo-preview').hidden=false;$('photo-placeholder').hidden=true;enable();
  } catch {error('Could not read that photo. Try a different image.');}
}
$('photo-input').addEventListener('change',event=>{if(event.target.files?.[0])usePhoto(event.target.files[0]);});
$('consent').addEventListener('change',enable);
$('open-camera').addEventListener('click',async()=>{
  error('');
  if(!navigator.mediaDevices?.getUserMedia){error('Camera is unavailable here. Please upload a photo instead.');return;}
  try{
    stream=await navigator.mediaDevices.getUserMedia({audio:false,video:{facingMode:'user',width:{ideal:1280},height:{ideal:1280}}});
    $('camera').srcObject=stream;$('camera').hidden=false;$('photo-preview').hidden=true;$('photo-placeholder').hidden=true;
    $('camera-actions').hidden=false;$('open-camera').hidden=true;
  }catch{error('Camera access was denied or unavailable. You can still upload a photo.');}
});
$('cancel-camera').addEventListener('click',()=>{stopCamera();$('photo-preview').hidden=!photo;$('photo-placeholder').hidden=!!photo;});
$('snap').addEventListener('click',async()=>{
  const video=$('camera');
  if(!video.videoWidth){error('Camera is still starting. Try again.');return;}
  const canvas=document.createElement('canvas');
  const factor=Math.min(1,1280/Math.max(video.videoWidth,video.videoHeight));
  canvas.width=Math.round(video.videoWidth*factor);canvas.height=Math.round(video.videoHeight*factor);
  const ctx=canvas.getContext('2d');ctx.translate(canvas.width,0);ctx.scale(-1,1);ctx.drawImage(video,0,0,canvas.width,canvas.height);
  const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/jpeg',.82));
  stopCamera();if(blob)await usePhoto(new File([blob],'selfie.jpg',{type:'image/jpeg'}));else error('Could not capture the image.');
});
async function toBase64(blob){
  const buffer=new Uint8Array(await blob.arrayBuffer());let raw='';
  for(let i=0;i<buffer.length;i+=8192)raw+=String.fromCharCode(...buffer.subarray(i,i+8192));
  return btoa(raw);
}
function show(id){for(const x of ['capture','loading','results'])$(x).hidden=x!==id;$(id).scrollIntoView({block:'start',behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth'});}
function valid(data){
  const matches=data?.matches;
  if(!Array.isArray(matches)||matches.length!==5) return false;
  const ids=new Set();
  for(const match of matches){if(!archetypes.some(a=>a.id===match.id)||ids.has(match.id)||!Number.isInteger(match.score)||match.score<0||match.score>100)return false;ids.add(match.id);}
  return typeof data.title==='string'&&data.title.length<=90&&data.title.length>0&&
    typeof data.tagline==='string'&&data.tagline.length<=180&&
    typeof data.explanation==='string'&&data.explanation.length<=400&&
    Array.isArray(data.tags)&&data.tags.length<=4&&data.tags.every(t=>typeof t==='string'&&t.length<=35);
}
function render(data){
  report=data;const ordered=[...data.matches].sort((a,b)=>b.score-a.score);
  $('result-photo').src=previewUrl;$('result-title').textContent=data.title;
  $('result-line').textContent=data.tagline;$('result-reason').textContent=data.explanation;
  const tags=$('style-tags');tags.replaceChildren();for(const tag of data.tags){const el=document.createElement('span');el.textContent=tag;tags.append(el);}
  const list=$('match-list');list.replaceChildren();
  for(const [index,match] of ordered.entries()){
    const type=archetypes.find(a=>a.id===match.id);
    const row=document.createElement('div');row.className='fm-match';row.style.setProperty('--delay',(index*.12)+'s');
    const rank=document.createElement('span');rank.className='fm-rank';rank.textContent=String(index+1).padStart(2,'0');
    const name=document.createElement('div');name.className='fm-match-name';name.textContent=type.title;
    const sub=document.createElement('small');sub.textContent=type.subtitle;name.append(sub);
    const meter=document.createElement('div');meter.className='fm-meter';meter.setAttribute('role','progressbar');meter.setAttribute('aria-label',type.title+' visual style alignment');meter.setAttribute('aria-valuemin','0');meter.setAttribute('aria-valuemax','100');meter.setAttribute('aria-valuenow',String(match.score));
    const fill=document.createElement('span');fill.style.setProperty('--score',match.score+'%');meter.append(fill);
    const score=document.createElement('div');score.className='fm-value';score.textContent=match.score;const unit=document.createElement('small');unit.textContent=' /100';score.append(unit);
    row.append(rank,name,meter,score);list.append(row);
  }
}
$('analyze').addEventListener('click',async()=>{
  error('');if(!photo||!$('consent').checked)return;
  $('analyze').disabled=true;show('loading');controller=new AbortController();
  const timeout=setTimeout(()=>controller.abort(),25000);
  try{
    const response=await fetch(API+'/api/face-match/analyze',{
      method:'POST',headers:{'Content-Type':'application/json'},
      body:JSON.stringify({imageBase64:await toBase64(photo),mimeType:'image/jpeg',consent:true}),
      signal:controller.signal,cache:'no-store'
    });
    if(!response.ok)throw new Error('Analysis is not available yet. Please try again later.');
    const data=await response.json();
    if(!valid(data))throw new Error('The analysis returned an incomplete result. Please retry.');
    render(data);show('results');
  }catch(e){
    show('capture');error(e.name==='AbortError'?'The analysis timed out. Please retry.':e.message||'Could not complete your analysis.');
  }finally{clearTimeout(timeout);controller=null;enable();}
});
function resultCanvas(){
  const canvas=document.createElement('canvas');canvas.width=1080;canvas.height=1350;
  const c=canvas.getContext('2d');c.fillStyle='#121019';c.fillRect(0,0,1080,1350);
  c.fillStyle='#c2b0ff';c.font='bold 30px sans-serif';c.fillText('ORBIT  /  FACE MATCH',70,86);
  const image=$('result-photo');const x=70,y=142,w=420,h=600;
  const scale=Math.max(w/image.naturalWidth,h/image.naturalHeight),sw=w/scale,sh=h/scale;
  c.drawImage(image,(image.naturalWidth-sw)/2,(image.naturalHeight-sh)/2,sw,sh,x,y,w,h);
  c.fillStyle='#bda7ff';c.font='bold 28px sans-serif';c.fillText('MY CAREER AURA',535,193);
  c.fillStyle='#faf6ff';c.font='bold 54px sans-serif';
  const words=report.title.split(' ');let line='',yy=280;
  for(const word of words){const next=line?line+' '+word:word;if(c.measureText(next).width>475&&line){c.fillText(line,535,yy);yy+=65;line=word;}else line=next;}
  c.fillText(line,535,yy);
  c.font='24px sans-serif';c.fillStyle='#d7cbe7';c.fillText('STYLE MATCH · JUST FOR FUN',535,690);
  c.strokeStyle='#40354f';c.beginPath();c.moveTo(70,810);c.lineTo(1010,810);c.stroke();
  c.font='bold 28px sans-serif';c.fillStyle='#f5edff';c.fillText('TOP MATCHES',70,873);
  const top=[...report.matches].sort((a,b)=>b.score-a.score).slice(0,3);
  top.forEach((m,i)=>{const item=archetypes.find(a=>a.id===m.id);const yy=945+i*94;c.font='25px sans-serif';c.fillStyle='#f5edff';c.fillText(item.title,70,yy);c.fillStyle='#b9a4ff';c.fillRect(395,yy-18,Math.round(430*m.score/100),12);c.font='bold 25px sans-serif';c.fillText(String(m.score),890,yy);});
  c.fillStyle='#a99cb7';c.font='21px sans-serif';c.fillText('orbit-reaches.com/face-match/',70,1287);
  return canvas;
}
async function blobForShare(){return new Promise(resolve=>resultCanvas().toBlob(resolve,'image/png'));}
$('save').addEventListener('click',async()=>{
  if(!report)return;const blob=await blobForShare();if(!blob)return;
  const url=URL.createObjectURL(blob),link=document.createElement('a');link.href=url;link.download='orbit-career-aura.png';link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
  $('share-status').textContent='Share card saved to your device.';
});
$('share').addEventListener('click',async()=>{
  if(!report)return;const blob=await blobForShare();if(!blob)return;
  const file=new File([blob],'orbit-career-aura.png',{type:'image/png'});
  if(navigator.canShare?.({files:[file]})){try{await navigator.share({files:[file],title:'My Career Aura',text:'What is your career aura?'});return;}catch(e){if(e.name==='AbortError')return;}}
  if(navigator.share){try{await navigator.share({title:'My Career Aura',url:'https://orbit-reaches.com/face-match/'});return;}catch(e){if(e.name==='AbortError')return;}}
  $('save').click();
});
$('reset').addEventListener('click',()=>{if(controller)controller.abort();report=null;clearPhoto();$('consent').checked=false;enable();show('capture');});
window.addEventListener('pagehide',()=>{stopCamera();if(previewUrl)URL.revokeObjectURL(previewUrl);if(controller)controller.abort();});
initialize();
