import * as THREE from 'three';
import { createRifle } from './game.js';

export class ArmoryScene {
  constructor(mount, id, color) {
    this.mount=mount;this.running=true;this.dragging=false;this.rotation=.55;this.targetRotation=.55;this.last=performance.now();
    this.scene=new THREE.Scene();this.camera=new THREE.PerspectiveCamera(34,1,.1,100);this.camera.position.set(0,3.4,10.5);this.camera.lookAt(0,.3,-.7);
    this.renderer=new THREE.WebGLRenderer({antialias:true,alpha:true,powerPreference:'high-performance'});this.renderer.setPixelRatio(Math.min(devicePixelRatio||1,1.5));this.renderer.outputColorSpace=THREE.SRGBColorSpace;this.renderer.toneMapping=THREE.ACESFilmicToneMapping;this.renderer.toneMappingExposure=1.55;this.renderer.domElement.className='armory-canvas';this.renderer.domElement.setAttribute('aria-label','Drag to rotate the 3D weapon');mount.append(this.renderer.domElement);
    this.scene.add(new THREE.HemisphereLight('#e2eee9','#18201e',3.3));const key=new THREE.DirectionalLight('#ffe5c5',6);key.position.set(-4,7,6);this.scene.add(key);const rim=new THREE.PointLight(color,35,25);rim.position.set(4,2,-4);this.scene.add(rim);
    this.weapon=createRifle(color,id);this.weapon.traverse(o=>{if(o.isMesh&&o.material){o.material=o.material.clone();o.material.emissive=new THREE.Color(color);o.material.emissiveIntensity=.055;}});this.weapon.position.set(0,.5,.6);this.weapon.rotation.x=-.12;this.scene.add(this.weapon);
    const pedestal=new THREE.Mesh(new THREE.CylinderGeometry(3.3,3.7,.3,48),new THREE.MeshStandardMaterial({color:'#1b2422',metalness:.75,roughness:.3}));pedestal.position.y=-1.05;this.scene.add(pedestal);const ring=new THREE.Mesh(new THREE.TorusGeometry(3.35,.025,6,64),new THREE.MeshBasicMaterial({color}));ring.rotation.x=Math.PI/2;ring.position.y=-.88;this.scene.add(ring);
    const grid=new THREE.GridHelper(30,30,'#52625d','#26332f');grid.position.y=-1.2;this.scene.add(grid);
    this.bind();this.resize();this.frame=requestAnimationFrame(t=>this.loop(t));
  }
  bind(){const canvas=this.renderer.domElement;this.onResize=()=>this.resize();window.addEventListener('resize',this.onResize);canvas.addEventListener('pointerdown',e=>{this.dragging=true;this.lastX=e.clientX;canvas.setPointerCapture(e.pointerId);});canvas.addEventListener('pointermove',e=>{if(this.dragging){this.targetRotation+=(e.clientX-this.lastX)*.012;this.lastX=e.clientX;}});const end=()=>this.dragging=false;canvas.addEventListener('pointerup',end);canvas.addEventListener('pointercancel',end);}
  resize(){this.width=this.mount.clientWidth;this.height=this.mount.clientHeight;this.camera.aspect=this.width/Math.max(1,this.height);this.camera.updateProjectionMatrix();this.renderer.setSize(this.width,this.height);}
  loop(now){if(!this.running)return;const dt=Math.min((now-this.last)/1000,.05);this.last=now;if(!this.dragging)this.targetRotation+=dt*.22;this.rotation+=(this.targetRotation-this.rotation)*Math.min(1,dt*10);this.weapon.rotation.y=this.rotation;this.weapon.position.y=.45+Math.sin(now*.0015)*.08;this.renderer.render(this.scene,this.camera);this.frame=requestAnimationFrame(t=>this.loop(t));}
  destroy(){this.running=false;cancelAnimationFrame(this.frame);window.removeEventListener('resize',this.onResize);this.scene.traverse(o=>{o.geometry?.dispose?.();if(o.material)(Array.isArray(o.material)?o.material:[o.material]).forEach(m=>m.dispose?.());});this.renderer.dispose();this.renderer.domElement.remove();}
}
