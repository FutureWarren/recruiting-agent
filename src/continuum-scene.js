import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { createSignatureModel } from './signature-model.js';
import { MOTION } from './continuum-motion.js';

// Both views use the original model and the page's one clock. No private RAF.
// The ambient view is created lazily, only when the user leaves the hero.
export function createScene(host, invalidate, { ambient = false } = {}) {
  const canvas = host.querySelector('canvas');
  let renderer, environment, scene, camera, model, fins, lost = false, baseY = 0;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true, powerPreference: 'low-power' });
    renderer.setPixelRatio(Math.min(devicePixelRatio, ambient ? 1 : innerWidth < 760 ? 1.25 : 1.5));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.15;
    scene = new THREE.Scene();
    camera = new THREE.OrthographicCamera(-5, 5, 2, -2, .1, 40);
    camera.position.set(0, 0, 12);
    const room = new RoomEnvironment(), pmrem = new THREE.PMREMGenerator(renderer);
    environment = pmrem.fromScene(room, .04);
    scene.environment = environment.texture;
    room.dispose(); pmrem.dispose();
    ({ model, fins } = createSignatureModel());
    scene.add(model);
    const key = new THREE.DirectionalLight('#ffffff', 2.6); key.position.set(-2, 4, 7);
    const fill = new THREE.DirectionalLight('#c1bfdc', 1.4); fill.position.set(4, -2, 4);
    const rim = new THREE.DirectionalLight('#8175f1', 2.1); rim.position.set(-4, -2, 0);
    scene.add(key, fill, rim, new THREE.AmbientLight('#cdccdc', .3));
    function resize() {
      const { width, height } = host.getBoundingClientRect();
      if (!width || !height || lost) return;
      renderer.setSize(width, height, false);
      const worldWidth = ambient ? 13 : width < 600 ? 7.5 : 10.2, worldHeight = worldWidth * height / width;
      Object.assign(camera, { left: -worldWidth / 2, right: worldWidth / 2, top: worldHeight / 2, bottom: -worldHeight / 2 });
      camera.updateProjectionMatrix();
      baseY = 4.35 * .94 - worldHeight * .12;
      invalidate();
    }
    function render({ time, progress, x, y }) {
      if (lost) return;
      fins.rotation.z = time * MOTION.rotation;
      if (ambient) {
        model.rotation.set(.62 + progress * .24, -.38 + progress * .26, -.3 + progress * .55);
        model.position.set(4.2 - progress * 1.4, .25 + Math.sin(progress * Math.PI) * .5, 0);
        model.scale.setScalar(.96);
      } else {
        model.rotation.set(-.12 + y * .03 + progress * .13, x * .025, progress * -.045);
        model.position.set(x * .06, baseY + progress * .7, 0);
        model.scale.setScalar(1 - progress * .07); model.scale.y *= .94;
      }
      renderer.render(scene, camera);
      host.dataset.renderState = 'ready';
      host.dataset.frames = String(Number(host.dataset.frames || 0) + 1);
    }
    function onLost(event) { event.preventDefault(); lost = true; host.dataset.renderState = 'fallback'; }
    function onRestored() { lost = false; resize(); invalidate(); }
    canvas.addEventListener('webglcontextlost', onLost);
    canvas.addEventListener('webglcontextrestored', onRestored);
    const ro = new ResizeObserver(resize); ro.observe(host); resize();
    return { render, get available() { return !lost; }, dispose() {
      ro.disconnect(); canvas.removeEventListener('webglcontextlost', onLost); canvas.removeEventListener('webglcontextrestored', onRestored);
      scene.traverse(o => { o.geometry?.dispose(); o.material?.dispose(); }); environment.dispose(); renderer.dispose();
    } };
  } catch {
    renderer?.dispose(); host.dataset.renderState = 'fallback';
    return { available: false, render() {}, dispose() {} };
  }
}
