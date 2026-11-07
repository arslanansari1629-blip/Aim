import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

const mat=(color,metalness=.2,roughness=.65)=>new THREE.MeshStandardMaterial({color,metalness,roughness});

/** Real-time operator hangar used by the home lobby. It owns a separate WebGL scene. */
export class LobbyScene{
  constructor(mount,accent='#72d9d0',avatar='phantom'){
    this.mount=mount;this.avatar=avatar;this.running=true;this.mobile=matchMedia('(pointer:coarse)').matches;this.accent=new THREE.Color(accent);this.pointer={x:0,y:0};this.last=performance.now();this.perf={time:0,frames:0};
    this.scene=new THREE.Scene();this.scene.background=new THREE.Color('#10191b');this.scene.fog=new THREE.FogExp2('#10191b',.027);
    this.camera=new THREE.PerspectiveCamera(38,1,.1,180);this.camera.position.set(9,5.4,14);
    this.renderer=new THREE.WebGLRenderer({antialias:true,alpha:false,powerPreference:'high-performance'});this.renderer.setPixelRatio(Math.min(devicePixelRatio||1,this.mobile?1.1:1.5));this.renderer.shadowMap.enabled=true;this.renderer.shadowMap.type=THREE.PCFShadowMap;this.renderer.outputColorSpace=THREE.SRGBColorSpace;this.renderer.toneMapping=THREE.ACESFilmicToneMapping;this.renderer.toneMappingExposure=1.12;
    this.renderer.domElement.className='lobby-canvas';this.renderer.domElement.setAttribute('aria-label','Interactive 3D operator hangar');mount.append(this.renderer.domElement);
    this.buildHangar();this.loadOperator();this.bind();this.resize();this.frame=requestAnimationFrame(t=>this.loop(t));
  }
  buildHangar(){
    this.scene.add(new THREE.HemisphereLight('#b9d8d5','#111614',1.5));
    const key=new THREE.SpotLight('#ffe4c7',150,55,.48,.55,1.3);key.position.set(2,13,9);key.target.position.set(3,2,0);key.castShadow=true;key.shadow.mapSize.set(1024,1024);this.scene.add(key,key.target);
    const rim=new THREE.SpotLight(this.accent,110,45,.55,.65,1.5);rim.position.set(10,7,-8);rim.target.position.set(3,2,0);this.scene.add(rim,rim.target);
    const floor=new THREE.Mesh(new THREE.PlaneGeometry(90,90),mat('#202826',.55,.48));floor.rotation.x=-Math.PI/2;floor.receiveShadow=true;this.scene.add(floor);
    const platform=new THREE.Mesh(new THREE.CylinderGeometry(4.6,5, .48,64),mat('#27302e',.8,.3));platform.position.set(3,.24,0);platform.receiveShadow=true;platform.castShadow=true;this.scene.add(platform);
    const ringMat=new THREE.MeshStandardMaterial({color:this.accent,emissive:this.accent,emissiveIntensity:2.3,metalness:.5,roughness:.25});
    const ring=new THREE.Mesh(new THREE.TorusGeometry(4.25,.045,8,96),ringMat);ring.rotation.x=Math.PI/2;ring.position.set(3,.5,0);this.scene.add(ring);this.ring=ring;
    const inner=new THREE.Mesh(new THREE.CircleGeometry(4.15,64),new THREE.MeshStandardMaterial({color:'#18211f',metalness:.72,roughness:.32}));inner.rotation.x=-Math.PI/2;inner.position.set(3,.495,0);inner.receiveShadow=true;this.scene.add(inner);
    const steel=mat('#283230',.72,.42),dark=mat('#111817',.5,.66),lightMat=new THREE.MeshStandardMaterial({color:'#bde9df',emissive:'#91d9ce',emissiveIntensity:2});
    for(const side of [-1,1])for(let i=0;i<5;i++){
      const x=side*12+i*4-8,z=-13-i*1.2,column=new THREE.Mesh(new THREE.BoxGeometry(.45,11,.65),steel);column.position.set(x,5.5,z);this.scene.add(column);
      const strip=new THREE.Mesh(new THREE.BoxGeometry(.08,7,.69),lightMat);strip.position.set(x-side*.26,6,z);this.scene.add(strip);
    }
    for(let i=0;i<6;i++){const beam=new THREE.Mesh(new THREE.BoxGeometry(36,.35,.5),steel);beam.position.set(0,11,-5-i*3);this.scene.add(beam);}
    const rear=new THREE.Mesh(new THREE.PlaneGeometry(60,20),dark);rear.position.set(0,8,-18);this.scene.add(rear);
    for(let i=0;i<14;i++){const line=new THREE.Mesh(new THREE.PlaneGeometry(.035,14),new THREE.MeshBasicMaterial({color:'#7d9b92',transparent:true,opacity:.16}));line.rotation.x=-Math.PI/2;line.position.set(-18+i*3,.012,0);this.scene.add(line);}
    for(let i=0;i<9;i++){const stripe=new THREE.Mesh(new THREE.BoxGeometry(1.8,.03,.32),new THREE.MeshBasicMaterial({color:i%2?'#242b28':'#d17b3f'}));stripe.position.set(-5+i*1.8,.02,5.7);stripe.rotation.y=-.35;this.scene.add(stripe);}
    const crateMat=mat('#414b43',.45,.65);for(const [x,z,s] of [[12,-4,1.5],[14,-5,1],[-8,-8,1.2]]){const c=new THREE.Mesh(new THREE.BoxGeometry(2*s,2*s,2*s),crateMat);c.position.set(x,s,z);c.castShadow=true;this.scene.add(c);}
    const dustGeo=new THREE.BufferGeometry(),points=new Float32Array(240*3);for(let i=0;i<points.length;i+=3){points[i]=Math.random()*35-12;points[i+1]=Math.random()*12;points[i+2]=Math.random()*28-14;}dustGeo.setAttribute('position',new THREE.BufferAttribute(points,3));this.dust=new THREE.Points(dustGeo,new THREE.PointsMaterial({color:'#d9c7a8',size:.025,transparent:true,opacity:.5,depthWrite:false}));this.scene.add(this.dust);
  }
  loadOperator(){
    new GLTFLoader().load('/models/soldier.glb',asset=>{
      if(!this.running)return;const apply=human=>{if(!this.running)return;const model=(human||asset).scene;model.scale.setScalar(3.15);model.position.set(3,.51,0);model.rotation.y=Math.PI*.87;
      model.traverse(o=>{if(o.isMesh){o.castShadow=true;o.receiveShadow=true;o.frustumCulled=false;o.material=o.material.clone();o.material.roughness=.5;o.material.metalness=.22;}});
      this.scene.add(model);this.model=model;this.mixer=new THREE.AnimationMixer(model);const idle=asset.animations.find(a=>a.name==='Idle')||asset.animations[0];if(idle)this.mixer.clipAction(idle).play();};
      if(this.avatar==='volt')new GLTFLoader().load('/models/michelle.glb',apply,undefined,()=>apply());else apply();
    },undefined,()=>{});
  }
  bind(){this.onResize=()=>this.resize();this.onPointer=e=>{const r=this.mount.getBoundingClientRect();this.pointer.x=(e.clientX-r.left)/r.width-.5;this.pointer.y=(e.clientY-r.top)/r.height-.5;};window.addEventListener('resize',this.onResize);this.mount.addEventListener('pointermove',this.onPointer);}
  resize(){this.width=this.mount.clientWidth;this.height=this.mount.clientHeight;this.camera.aspect=this.width/Math.max(1,this.height);this.camera.updateProjectionMatrix();this.renderer.setSize(this.width,this.height);}
  loop(now){if(!this.running)return;this.frame=requestAnimationFrame(x=>this.loop(x));if(this.mobile&&now-this.last<1000/30)return;const dt=Math.min((now-this.last)/1000,.05);this.last=now;this.perf.time+=dt;this.perf.frames++;if(this.mobile&&this.perf.time>4){const fps=this.perf.frames/this.perf.time;if(fps<25&&this.renderer.getPixelRatio()>.75){this.renderer.setPixelRatio(Math.max(.75,this.renderer.getPixelRatio()-.15));this.renderer.setSize(this.width,this.height);}this.perf.time=0;this.perf.frames=0;}const t=now*.001;this.mixer?.update(dt);if(this.model)this.model.rotation.y=Math.PI*.87+Math.sin(t*.32)*.055+this.pointer.x*.08;this.ring.rotation.z=t*.08;this.dust.rotation.y=t*.012;const mobile=this.width<760,targetX=mobile?3:9+this.pointer.x*.6,targetY=5.4-this.pointer.y*.35;this.camera.position.x+=(targetX-this.camera.position.x)*dt*2;this.camera.position.y+=(targetY-this.camera.position.y)*dt*2;this.camera.lookAt(mobile?new THREE.Vector3(3,2.3,0):new THREE.Vector3(2.7,2.4,0));this.renderer.render(this.scene,this.camera);}
  destroy(){this.running=false;cancelAnimationFrame(this.frame);window.removeEventListener('resize',this.onResize);this.mount.removeEventListener('pointermove',this.onPointer);this.scene.traverse(o=>{o.geometry?.dispose?.();if(o.material)(Array.isArray(o.material)?o.material:[o.material]).forEach(m=>{m.map?.dispose?.();m.dispose?.();});});this.renderer.dispose();this.renderer.domElement.remove();}
}
