import * as THREE from 'three';

// Original Orbit geometry: one ribbed annulus and its single brand satellite.
// The reference informs the scale and layered material, not its logo or assets.
export function createSignatureModel() {
  const model = new THREE.Group();
  model.name = 'Orbit signature — layered ring and violet satellite';
  const positions = [], colors = [], indices = [];
  const count = 168, radialSteps = 44, across = 6;
  const inside = 2.7, outside = 4.35;
  const pale = new THREE.Color('#b2b0c4'), edge = new THREE.Color('#7c789a');
  for (let fin = 0; fin < count; fin++) {
    const offset = positions.length / 3;
    const base = fin * Math.PI * 2 / count;
    for (let j = 0; j <= radialSteps; j++) {
      const q = j / radialSteps;
      const r = inside + (outside - inside) * q;
      const curl = .46 * (1 - q) ** 2.6;
      const color = pale.clone().lerp(edge, q * .62);
      for (let k = 0; k <= across; k++) {
        const s = k / across * 2 - 1;
        const halfWidth = .011 + .006 * Math.sin(q * Math.PI / 2);
        const theta = base + curl + s * halfWidth;
        const z = .48 * Math.sin(Math.PI * q) + .022 * Math.cos(s * Math.PI / 2);
        positions.push(r * Math.cos(theta), r * Math.sin(theta), z);
        colors.push(color.r, color.g, color.b);
      }
    }
    for (let j = 0; j < radialSteps; j++) for (let k = 0; k < across; k++) {
      const a = offset + j * (across + 1) + k, b = a + across + 1;
      indices.push(a, b, a + 1, b, b + 1, a + 1);
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geometry.setIndex(indices); geometry.computeVertexNormals();
  const fins = new THREE.Mesh(geometry, new THREE.MeshStandardMaterial({
    vertexColors: true, metalness: .58, roughness: .36, envMapIntensity:.65, side: THREE.DoubleSide
  }));
  fins.name = '168 sculpted satin-metal fins';
  model.add(fins);
  // A continuous recessed surface replaces the black gaps between fins. This
  // creates quiet material relief rather than a high-contrast striped graphic.
  const underlayPositions = [], underlayIndices = [];
  for (let a = 0; a <= 256; a++) for (let j = 0; j <= radialSteps; j++) {
    const theta = a / 256 * Math.PI * 2, q = j / radialSteps;
    const r = inside + (outside-inside)*q;
    underlayPositions.push(r*Math.cos(theta),r*Math.sin(theta),.48*Math.sin(Math.PI*q)-.025);
  }
  for (let a=0;a<256;a++) for(let j=0;j<radialSteps;j++) {
    const i=a*(radialSteps+1)+j,b=i+radialSteps+1;
    underlayIndices.push(i,b,i+1,b,b+1,i+1);
  }
  const underlayGeometry=new THREE.BufferGeometry();
  underlayGeometry.setAttribute('position',new THREE.Float32BufferAttribute(underlayPositions,3));
  underlayGeometry.setIndex(underlayIndices);underlayGeometry.computeVertexNormals();
  const underlay=new THREE.Mesh(underlayGeometry,new THREE.MeshStandardMaterial({color:'#555364',metalness:.45,roughness:.45,envMapIntensity:.5,side:THREE.DoubleSide}));
  underlay.name='Recessed continuous satin surface';
  model.add(underlay);
  for (const [r, thickness, color] of [[inside,.014,'#b7b5c9'],[outside,.012,'#77738f']]) {
    const rim = new THREE.Mesh(new THREE.TorusGeometry(r, thickness, 8, 256), new THREE.MeshStandardMaterial({color,metalness:.7,roughness:.25}));
    rim.name = r === inside ? 'Quiet inner rim' : 'Quiet outer rim';
    model.add(rim);
  }
  const satellite = new THREE.Mesh(new THREE.SphereGeometry(.16, 32, 24), new THREE.MeshPhysicalMaterial({
    color:'#5c5cf2', metalness:.12, roughness:.35, clearcoat:.3, clearcoatRoughness:.4,envMapIntensity:.4
  }));
  const angle = -Math.PI * .22;
  satellite.position.set(Math.cos(angle) * 4.35, Math.sin(angle) * 4.35, .13);
  satellite.name = 'Orbit brand satellite';
  model.add(satellite);
  return { model, fins, satellite };
}
