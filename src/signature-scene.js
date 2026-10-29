import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { createSignatureModel } from './signature-model.js';

const host = document.querySelector('[data-signature-scene]');
const canvas = host?.querySelector('canvas');
const reduced = matchMedia('(prefers-reduced-motion: reduce)');
const connection = navigator.connection;
let renderer, scene, environment, io, resizeObserver, stateObserver, frame = 0;
let lastFrame = 0, elapsed = 0, visible = true, contextLost = false;
let draw, resize, frozen = false, pointerX = 0, pointerY = 0;
const shouldPause = () => reduced.matches || connection?.saveData || document.body.classList.contains('motion-off');
const stop = () => { cancelAnimationFrame(frame); frame = 0; lastFrame = 0; };
const schedule = () => {
  if (!frame && visible && !document.hidden && !contextLost) frame = requestAnimationFrame(draw);
};
function fallback() {
  stop(); host.dataset.renderState = 'fallback'; canvas.hidden = true;
}
function sync() {
  frozen = shouldPause();
  host.dataset.motion = frozen ? 'paused' : 'running';
  stop(); schedule();
}
if (host && canvas) {
  try {
    renderer = new THREE.WebGLRenderer({ canvas, alpha:true, antialias:true, powerPreference:'low-power' });
    renderer.setPixelRatio(Math.min(devicePixelRatio, innerWidth < 760 ? 1.25 : 1.5));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.12;
    scene = new THREE.Scene();
    const camera = new THREE.OrthographicCamera(-5.2,5.2,2,-2,.1,40);
    camera.position.set(0,0,12);
    const room = new RoomEnvironment();
    const pmrem = new THREE.PMREMGenerator(renderer);
    environment = pmrem.fromScene(room,.04);
    scene.environment = environment.texture;
    room.dispose(); pmrem.dispose();
    const { model, fins } = createSignatureModel();
    scene.add(model);
    const key = new THREE.DirectionalLight('#ffffff',2.0); key.position.set(-2,4,7);
    const fill = new THREE.DirectionalLight('#b8b7df',1.4); fill.position.set(4,-2,4);
    const rim = new THREE.DirectionalLight('#7b76ed',1.8); rim.position.set(-4,-2,0);
    scene.add(key,fill,rim,new THREE.AmbientLight('#cdcddd',.3));
    let targetY = 3.4;
    resize = () => {
      const {width,height} = host.getBoundingClientRect();
      if (!width || !height) return;
      renderer.setSize(width,height,false);
      const worldWidth = width < 600 ? 7.4 : width < 1000 ? 9.4 : 10.1;
      const worldHeight = worldWidth * height / width;
      camera.left=-worldWidth/2; camera.right=worldWidth/2;
      camera.top=worldHeight/2; camera.bottom=-worldHeight/2;
      camera.updateProjectionMatrix();
      // Leave breathing room between the sculpture and the headline.
      targetY = 4.35 * .94 - worldHeight * .12;
      model.position.y = targetY;
      schedule();
    };
    draw = time => {
      frame=0;
      // 30 fps is sufficient for the deliberately slow surface motion.
      if (!frozen && lastFrame && time-lastFrame < 32) { schedule(); return; }
      const dt = lastFrame ? Math.min((time-lastFrame)/1000,.1) : 0;
      lastFrame=time;
      if (!frozen) {
        elapsed += dt;
        fins.rotation.z = elapsed * .009;
        model.rotation.x = THREE.MathUtils.lerp(model.rotation.x,-.12+pointerY*.025,.08);
        model.rotation.y = THREE.MathUtils.lerp(model.rotation.y,pointerX*.025,.08);
      }
      model.scale.y=.94;
      renderer.render(scene,camera);
      host.dataset.renderState='ready';
      host.dataset.frames=String(Number(host.dataset.frames||0)+1);
      if (!frozen) schedule();
    };
    model.rotation.x=-.12;
    document.querySelector('.signature-hero').addEventListener('pointermove',e=>{
      if (frozen || e.pointerType !== 'mouse') return;
      const r=host.getBoundingClientRect();
      pointerX=Math.max(-.5,Math.min(.5,(e.clientX-r.left)/r.width-.5));
      pointerY=Math.max(-.5,Math.min(.5,(e.clientY-r.top)/r.height-.5));
    },{passive:true});
    document.querySelector('.signature-hero').addEventListener('pointerleave',()=>{pointerX=pointerY=0;});
    io = new IntersectionObserver(entries=>{
      visible=entries[0].isIntersecting;
      stop(); if (visible) schedule();
    });
    io.observe(host);
    resizeObserver=new ResizeObserver(resize); resizeObserver.observe(host);
    stateObserver=new MutationObserver(sync);
    stateObserver.observe(document.body,{attributes:true,attributeFilter:['class']});
    reduced.addEventListener('change',sync);
    connection?.addEventListener?.('change',sync);
    document.addEventListener('visibilitychange',()=>{stop();if(!document.hidden)schedule();});
    canvas.addEventListener('webglcontextlost',e=>{e.preventDefault();contextLost=true;fallback();});
    canvas.addEventListener('webglcontextrestored',()=>{contextLost=false;canvas.hidden=false;resize();sync();});
    window.addEventListener('pagehide',e=>{
      stop();
      if(e.persisted)return;
      io.disconnect();resizeObserver.disconnect();stateObserver.disconnect();
      scene.traverse(o=>{o.geometry?.dispose();o.material?.dispose();});
      environment.dispose();renderer.dispose();
    });
    window.addEventListener('pageshow',e=>{if(e.persisted)sync();});
    resize(); sync();
  } catch {
    renderer?.dispose(); fallback();
  }
}
