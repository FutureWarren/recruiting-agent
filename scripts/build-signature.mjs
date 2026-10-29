import { build } from 'esbuild';
import { mkdir, writeFile } from 'node:fs/promises';
import { GLTFExporter } from 'three/addons/exporters/GLTFExporter.js';
import { createSignatureModel } from '../src/signature-model.js';

globalThis.FileReader = class {
  readAsArrayBuffer(blob) { blob.arrayBuffer().then(result=>{this.result=result;this.onloadend?.();}); }
  readAsDataURL(blob) { blob.arrayBuffer().then(result=>{this.result=`data:${blob.type};base64,${Buffer.from(result).toString('base64')}`;this.onloadend?.();}); }
};
await mkdir('media/3d',{recursive:true});
await build({entryPoints:['src/signature-scene.js'],bundle:true,minify:true,format:'esm',outfile:'media/3d/orbit-signature.js',legalComments:'linked'});
const {model}=createSignatureModel();
await writeFile('media/3d/orbit-signature.glb',Buffer.from(await new GLTFExporter().parseAsync(model,{binary:true})));
console.log('Built Orbit signature scene and original layered-ring GLB.');
