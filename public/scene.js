import * as THREE from "three";

const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
const canvas = document.getElementById("stage");
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false });
renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
renderer.setClearColor(0x0c1020, 1);
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x0c1020);
scene.fog = new THREE.FogExp2(0x0c1020, 0.045);
const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 40);
camera.position.set(0, 0.3, 6.4);

scene.add(new THREE.AmbientLight(0xc8b8ff, 0.45));
const key = new THREE.DirectionalLight(0xf4f1ff, 5);
key.position.set(3, 4, 5);
scene.add(key);
const fill = new THREE.PointLight(0xb9a2ff, 6, 12);
fill.position.set(-2, 1, 3);
scene.add(fill);

const stone = new THREE.MeshStandardMaterial({ color: 0x2a2450, metalness: 0.2, roughness: 0.55 });
const left = new THREE.Mesh(new THREE.BoxGeometry(0.45, 2.4, 0.45), stone);
const right = left.clone();
left.position.set(-1.35, 0, 0);
right.position.set(1.35, 0, 0);
const bar = new THREE.Mesh(new THREE.BoxGeometry(3.15, 0.28, 0.45), stone);
bar.position.set(0, 1.25, 0);
const gate = new THREE.Group();
gate.add(left, right, bar);
scene.add(gate);

function resize() {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight, false);
}
addEventListener("resize", resize);
resize();

const clock = new THREE.Clock();
function frame() {
  const t = clock.getElapsedTime() * (reduced ? 0.15 : 1);
  gate.rotation.y = Math.sin(t * 0.35) * 0.18;
  camera.lookAt(0, 0.2, 0);
  renderer.render(scene, camera);
  requestAnimationFrame(frame);
}
frame();

export function setMode(mode) {
  const colors = { allow: 0x7ddec8, deny: 0xff6d7e, wait: 0xf4f1ff };
  fill.color.setHex(colors[mode] || 0xb9a2ff);
}
