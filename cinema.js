/* Worlds in Sync. Original scene; Three.js r160. No live cloud/database calls.
 * Camera: Y-up; one block-playback owner. Scroll selects, elapsed time animates.
 * Globe glow is an illustrative Fresnel rim, not a physical atmosphere model.
 */
(() => {
  'use strict';
  const $=id=>document.getElementById(id), M=window.GGModel;
  const chapters=[...document.querySelectorAll('.chapter')], reduced=matchMedia('(prefers-reduced-motion: reduce)');
  const playback=window.BlockPlayback.create();
  let chapterTops=[];
  const params=new URLSearchParams(location.search), isQA=params.has('inspect');
  const clamp=(v,a=0,b=1)=>Math.max(a,Math.min(b,v)), ease=v=>{v=clamp(v);return v*v*(3-2*v);};
  const mix=(a,b,t)=>a+(b-a)*t, C={blue:0x6bd3ff,gold:0xffaf72,green:0xa0ffd5,dark:0x132330,silver:0xb6cbd8};
  const titles=['GOLDENGATE ON AZURE','REGIONAL ARCHITECTURE','PRIVATE CONNECTIVITY','CAPTURE THE INSERT','SEND THE TRAIL','APPLY THE INSERT','UPDATE THE SAME ROW','RESOLVE THE CONFLICT','PREVENT REPLICATION LOOPS'];
  const state={scene:0,p:0,progress:0,webgl:false,paused:reduced.matches||params.has('still'),reduced:reduced.matches||params.has('reduced'),assets:'loading',debug:'final',camera:'design',time:0,frameCount:0,cpuSubmissionMs:0};
  let renderer,scene,camera,globe,architecture,conflict,stars,glowTexture,envTexture,raf,last=0,current=-1,modelFrame=null,disposed=false,lastUI='',lastRender='';
  let metricsElapsed=0,viewport={w:innerWidth,h:innerHeight,mobile:innerWidth<901};
  const labels=[],glows=[],materials=[],networks=[],dbs={},ggs={},packets={},curves={},rowObjects=[],listeners=[];
  const on=(el,event,fn,opts)=>{el.addEventListener(event,fn,opts);listeners.push(()=>el.removeEventListener(event,fn,opts));};
  const V=(x=0,y=0,z=0)=>new THREE.Vector3(x,y,z);
  const qFromPose=(pos,target)=>new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().lookAt(pos,target,V(0,1,0)));
  const mat=(color,opts={})=>{const m=new THREE.MeshStandardMaterial({color,roughness:.28,metalness:.7,...opts});materials.push(m);return m;};
  const emissive=(color,intensity=1)=>mat(color,{emissive:color,emissiveIntensity:intensity,roughness:.3,metalness:.35});
  function mesh(geo,material,parent,x=0,y=0,z=0){const o=new THREE.Mesh(geo,material);o.position.set(x,y,z);parent.add(o);return o;}
  function box(w,h,d,m,p,x=0,y=0,z=0){return mesh(new THREE.BoxGeometry(w,h,d),m,p,x,y,z);}
  function torus(r,t,m,p,x=0,y=0,z=0,flat=true){const o=mesh(new THREE.TorusGeometry(r,t,8,80),m,p,x,y,z);if(flat)o.rotation.x=Math.PI/2;return o;}
  function glow(color,size,p,x=0,y=0,z=0,opacity=.6){const m=new THREE.SpriteMaterial({map:glowTexture,color,transparent:true,opacity,depthWrite:false,blending:THREE.AdditiveBlending});const o=new THREE.Sprite(m);o.position.set(x,y,z);o.scale.set(size,size,1);o.userData.opacity=opacity;p.add(o);glows.push(o);return o;}
  function label(text,sub,parent,pos,kind='component',site=''){const el=document.createElement('div');el.className='world-label '+kind+(site==='SEA'?' sea':'');const content=document.createElement('div');content.textContent=text;if(sub){const s=document.createElement('span');s.textContent=sub;content.append(s);}el.append(content);$('labels').append(el);const anchor=new THREE.Object3D();anchor.position.copy(pos);parent.add(anchor);labels.push({el,anchor,kind,site});}
  function curve(id,points,color,parent=architecture,radius=.025){const c=new THREE.CatmullRomCurve3(points);const tube=mesh(new THREE.TubeGeometry(c,100,radius,6,false),emissive(color,.7),parent);curves[id]={c,tube,parent};return c;}
  function makePacket(id,color,parent=architecture){const g=new THREE.Group();parent.add(g);mesh(new THREE.OctahedronGeometry(.18),emissive(0xf2f8ff,2),g);glow(color,1.5,g,0,0,0,.85);packets[id]=g;return g;}
  function makeTextures(){
    const c=document.createElement('canvas');c.width=c.height=128;const ctx=c.getContext('2d');const grad=ctx.createRadialGradient(64,64,0,64,64,64);grad.addColorStop(0,'rgba(255,255,255,1)');grad.addColorStop(.15,'rgba(255,255,255,.5)');grad.addColorStop(.4,'rgba(255,255,255,.13)');grad.addColorStop(1,'rgba(255,255,255,0)');ctx.fillStyle=grad;ctx.fillRect(0,0,128,128);glowTexture=new THREE.CanvasTexture(c);
    const e=document.createElement('canvas');e.width=1024;e.height=512;const ec=e.getContext('2d');ec.fillStyle='#0d1a26';ec.fillRect(0,0,1024,512);
    const light=ec.createLinearGradient(0,0,0,512);light.addColorStop(0,'#6a91aa');light.addColorStop(.3,'#c5e6ed');light.addColorStop(.42,'#1c3947');light.addColorStop(.68,'#080d14');light.addColorStop(1,'#3b2721');ec.fillStyle=light;ec.fillRect(0,0,1024,512);
    ec.fillStyle='#f3f9ff';ec.fillRect(170,60,35,230);ec.fillStyle='#ffb680';ec.fillRect(670,120,50,170);ec.fillStyle='#c1e4fc';ec.fillRect(390,85,150,25);
    const texture=new THREE.CanvasTexture(e);texture.mapping=THREE.EquirectangularReflectionMapping;texture.colorSpace=THREE.SRGBColorSpace;const pmrem=new THREE.PMREMGenerator(renderer);envTexture=pmrem.fromEquirectangular(texture);scene.environment=envTexture.texture;pmrem.dispose();texture.dispose();
  }
  function init(){
    try{
      if(params.has('fallback'))throw Error('Requested accessible fallback');
      renderer=new THREE.WebGLRenderer({canvas:$('canvas'),antialias:true,alpha:true,preserveDrawingBuffer:true,powerPreference:'high-performance'});
      renderer.setPixelRatio(Math.min(devicePixelRatio||1,viewport.mobile?1.4:1.65));renderer.setSize(viewport.w,viewport.h);renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.25;
      scene=new THREE.Scene();camera=new THREE.PerspectiveCamera(42,viewport.w/viewport.h,.15,160);makeTextures();scene.add(new THREE.HemisphereLight(0xd9edff,0x17202a,1.8));
      const key=new THREE.DirectionalLight(0xc0e4ff,3);key.position.set(-8,12,12);scene.add(key);const rim=new THREE.DirectionalLight(0xffaa76,3.5);rim.position.set(8,8,-7);scene.add(rim);
      globe=new THREE.Group();architecture=new THREE.Group();conflict=new THREE.Group();scene.add(globe,architecture,conflict);buildGlobe();buildArchitecture();buildConflict();buildStars();
      // Compile all authored scene materials up front, not at the first scroll crossing.
      renderer.compile(scene,camera);
      state.webgl=true;on($('canvas'),'webglcontextlost',e=>{e.preventDefault();fallback('Graphics context lost');});
      on($('canvas'),'webglcontextrestored',()=>{state.webgl=true;lastRender='';$('fallback').hidden=true;$('canvas').hidden=false;$('labels').hidden=false;});
    }catch(error){fallback(error.message);}
  }
  function fallback(message){state.webgl=false;state.error=message;$('fallback').hidden=false;$('canvas').hidden=true;$('labels').hidden=true;}
  function ll(lat,lon,r=5.6){const a=lat*Math.PI/180,b=lon*Math.PI/180;return V(r*Math.cos(a)*Math.sin(b),r*Math.sin(a),r*Math.cos(a)*Math.cos(b));}
  function buildGlobe(){
    globe.rotation.y=-.95;
    mesh(new THREE.SphereGeometry(5.6,96,64),mat(0x091a29,{roughness:.6,metalness:.35}),globe);
    const rimMat=new THREE.ShaderMaterial({uniforms:{uColor:{value:new THREE.Color(C.blue)},uIntensity:{value:.64}},vertexShader:'varying vec3 n; varying vec3 v; void main(){ vec4 p=modelViewMatrix*vec4(position,1.0); n=normalize(normalMatrix*normal); v=normalize(-p.xyz); gl_Position=projectionMatrix*p; }',fragmentShader:'varying vec3 n; varying vec3 v; uniform vec3 uColor; uniform float uIntensity; void main(){float f=pow(1.0-max(0.0,dot(normalize(n),normalize(v))),3.5); gl_FragColor=vec4(uColor,f*uIntensity);}',transparent:true,depthWrite:false,blending:THREE.AdditiveBlending});
    const rim=mesh(new THREE.SphereGeometry(5.66,72,48),rimMat,globe);rim.userData.isGlow=true;glows.push(rim);
    const gridMat=new THREE.LineBasicMaterial({color:0x275376,transparent:true,opacity:.28});
    for(let lat=-60;lat<=60;lat+=20){const pts=[];for(let lon=-180;lon<=180;lon+=3)pts.push(ll(lat,lon,5.62));globe.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts),gridMat));}
    for(let lon=0;lon<360;lon+=30){const pts=[];for(let lat=-90;lat<=90;lat+=3)pts.push(ll(lat,lon,5.62));globe.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts),gridMat));}
    const a=ll(52.37,4.9,5.65),b=ll(1.35,103.82,5.65),points=[];
    for(let i=0;i<=80;i++){const t=i/80;points.push(a.clone().lerp(b,t).normalize().multiplyScalar(5.67+Math.sin(Math.PI*t)*1.45));}
    curve('world',points,C.gold,globe,.024);const c2=points.map(p=>p.clone().multiplyScalar(1.012));curve('world2',c2,C.blue,globe,.008);makePacket('world',C.gold,globe);
    [[a,C.blue,'WEST EUROPE','Amsterdam', 'WEU'],[b,C.gold,'SOUTHEAST ASIA','Singapore','SEA']].forEach(([pos,color,text,sub,site])=>{mesh(new THREE.SphereGeometry(.065,16,12),emissive(color,3),globe,...pos.toArray());glow(color,.8,globe,...pos.toArray(),.9);const ring=torus(.15,.012,emissive(color,1),globe,...pos.toArray(),false);ring.quaternion.setFromUnitVectors(V(0,0,1),pos.clone().normalize());label(text,sub,globe,pos.clone().multiplyScalar(1.09),'globe',site);});
    const orbit=torus(6.95,.008,emissive(0x5a6878,.2),globe,0,0,0);orbit.rotation.z=.4;orbit.rotation.x=1.3;
    fetch('land.geojson').then(r=>{if(!r.ok)throw Error('Map unavailable');return r.json();}).then(data=>{
      if(disposed)return;
      const rings=[];data.features.forEach(f=>{const polygons=f.geometry.type==='Polygon'?[f.geometry.coordinates]:f.geometry.coordinates;polygons.forEach(p=>rings.push(p));});
      const positions=[],coast=[];
      function inside(x,y,ring){let yes=false;for(let i=0,j=ring.length-1;i<ring.length;j=i++){const a=ring[i],b=ring[j];if(((a[1]>y)!==(b[1]>y))&&(x<(b[0]-a[0])*(y-a[1])/(b[1]-a[1])+a[0]))yes=!yes;}return yes;}
      const polys=rings.map(p=>({p,minX:Math.min(...p[0].map(v=>v[0])),maxX:Math.max(...p[0].map(v=>v[0])),minY:Math.min(...p[0].map(v=>v[1])),maxY:Math.max(...p[0].map(v=>v[1]))}));
      for(let lat=-75;lat<84;lat+=.86){const step=.86/Math.max(.25,Math.cos(lat*Math.PI/180));for(let lon=-180;lon<180;lon+=step){if(polys.some(o=>lon>=o.minX&&lon<=o.maxX&&lat>=o.minY&&lat<=o.maxY&&inside(lon,lat,o.p[0])&&!o.p.slice(1).some(h=>inside(lon,lat,h))))positions.push(...ll(lat,lon,5.63).toArray());}}
      rings.forEach(p=>p.forEach(r=>{for(let i=1;i<r.length;i++)if(Math.abs(r[i][0]-r[i-1][0])<180)coast.push(...ll(r[i-1][1],r[i-1][0],5.635).toArray(),...ll(r[i][1],r[i][0],5.635).toArray());}));
      const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));globe.add(new THREE.Points(g,new THREE.PointsMaterial({color:0x86bed5,size:.028,sizeAttenuation:true,transparent:true,opacity:.9})));const cg=new THREE.BufferGeometry();cg.setAttribute('position',new THREE.Float32BufferAttribute(coast,3));globe.add(new THREE.LineSegments(cg,new THREE.LineBasicMaterial({color:0x438fae,transparent:true,opacity:.32})));state.assets='ready';state.landPoints=positions.length/3;
    }).catch(()=>{state.assets='map unavailable';});
  }
  function buildStars(){let seed=83;const random=()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296;};const coords=[];for(let i=0;i<550;i++)coords.push((random()-.5)*95,(random()-.5)*65,-15-random()*35);const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(coords,3));stars=new THREE.Points(g,new THREE.PointsMaterial({color:0x9baebf,size:.026,transparent:true,opacity:.42}));scene.add(stars);}
  function platform(parent,color){
    const m=mat(0x1c2b39,{metalness:.9,roughness:.22}),side=mat(0x0b1520),line=emissive(color,.4);
    const slab=new THREE.Shape();const w=7.2,h=5.5,r=.4;slab.moveTo(-w/2+r,-h/2);slab.lineTo(w/2-r,-h/2);slab.quadraticCurveTo(w/2,-h/2,w/2,-h/2+r);slab.lineTo(w/2,h/2-r);slab.quadraticCurveTo(w/2,h/2,w/2-r,h/2);slab.lineTo(-w/2+r,h/2);slab.quadraticCurveTo(-w/2,h/2,-w/2,h/2-r);slab.lineTo(-w/2,-h/2+r);slab.quadraticCurveTo(-w/2,-h/2,-w/2+r,-h/2);
    const geo=new THREE.ExtrudeGeometry(slab,{depth:.15,bevelEnabled:true,bevelThickness:.06,bevelSize:.06,bevelSegments:2,steps:1,curveSegments:8});
    for(let i=0;i<3;i++){const deck=mesh(geo,i===1?line:m,parent,0,-.15-i*.28,0);deck.rotation.x=-Math.PI/2;deck.scale.set(i===1?1.006:1,i===1?1.006:1,i===1?.2:1);}
    const board=new THREE.Group();parent.add(board);networks.push({board,parent});
    const edges=new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(6.8,.04,5.1)),new THREE.LineBasicMaterial({color,transparent:true,opacity:.35}));edges.position.y=.04;board.add(edges);
    const tracks=[];for(let z=-2.25;z<2.4;z+=.45){tracks.push(V(-3.2,.06,z),V(3.2,.06,z));}for(let x=-3.1;x<3.2;x+=.45){tracks.push(V(x,.06,-2.3),V(x,.06,2.3));}board.add(new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(tracks),new THREE.LineBasicMaterial({color,transparent:true,opacity:.1})));
    const feetGeo=new THREE.CylinderGeometry(.13,.18,.25,12),feetMat=mat(0x879da9);[-3.05,3.05].forEach(x=>[-2.15,2.15].forEach(z=>mesh(feetGeo,feetMat,parent,x,-.9,z)));
    const contacts=new THREE.InstancedMesh(new THREE.BoxGeometry(.1,.06,.25),side,32);const dummy=new THREE.Object3D();for(let i=0;i<32;i++){dummy.position.set(-2.9+i*.185,.03,2.4);dummy.updateMatrix();contacts.setMatrixAt(i,dummy.matrix);}parent.add(contacts);
    return board;
  }
  function database(parent,site,x,z){
    const color=site==='WEU'?C.blue:C.gold,g=new THREE.Group();g.position.set(x,0,z);parent.add(g);const shell=mat(0x8da5b6,{roughness:.23,metalness:.9}),dark=mat(0x0b1721),accent=emissive(color,.7);
    mesh(new THREE.CylinderGeometry(1.08,1.13,.22,64),dark,g,0,.22,0);torus(1.12,.022,accent,g,0,.13,0);
    for(let i=0;i<5;i++){mesh(new THREE.CylinderGeometry(.93,.98,.30,64),shell,g,0,.48+i*.38,0);torus(.96,.018,accent,g,0,.64+i*.38,0);}
    mesh(new THREE.CylinderGeometry(.95,.95,.1,64),shell,g,0,2.21,0);mesh(new THREE.CylinderGeometry(.67,.67,.013,48),dark,g,0,2.27,0);torus(.56,.017,accent,g,0,2.28,0);torus(.34,.012,accent,g,0,2.29,0);
    for(let i=0;i<8;i++){const a=i*Math.PI/4;mesh(new THREE.CylinderGeometry(.035,.035,.014,8),shell,g,.78*Math.cos(a),2.28,.78*Math.sin(a));}
    const halo=torus(1.32,.024,accent,g,0,.12,0);const aura=glow(color,3.7,g,0,1.3,0,.12);dbs[site]={g,halo,aura};label('AUTONOMOUS DB','TLS · 1521',g,V(0,2.9,0),'component',site);return g;
  }
  function goldenGate(parent,site,x,z){
    const color=site==='WEU'?C.blue:C.gold,g=new THREE.Group();g.position.set(x,0,z);parent.add(g);const metal=mat(0x526d81,{metalness:.95,roughness:.2}),dark=mat(0x101d2a),accent=emissive(color,.7);
    box(2.3,.18,2.05,metal,g,0,.22,0);box(1.9,.42,1.65,dark,g,0,.5,0);
    for(let i=0;i<8;i++){box(1.9,.07,1.65,metal,g,0,.77+i*.13,0);}
    box(1.6,.1,1.35,dark,g,0,1.79,0);box(1.1,.03,.9,accent,g,0,1.87,0);
    for(let i=0;i<7;i++){[-1,1].forEach(s=>{box(.2,.05,.08,metal,g,s*1.2,.3,-.65+i*.21);box(.09,.05,.2,metal,g,-.65+i*.21,.3,s*1.03);});}
    // An authored suspended core, a symbol for the deployment's services.
    const core=new THREE.Group();core.position.y=2.58;g.add(core);const frame=mesh(new THREE.BoxGeometry(.68,.68,.68),mat(color,{metalness:.65,roughness:.18}),core);frame.rotation.set(.35,.65,.2);
    const edges=new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(.91,.91,.91)),new THREE.LineBasicMaterial({color,transparent:true,opacity:.6}));edges.rotation.copy(frame.rotation);core.add(edges);glow(color,2.6,g,0,2.5,0,.2);
    const halo=torus(1.42,.022,accent,g,0,.10,0);ggs[site]={g,core,halo};label('GOLDENGATE','Capture · transport · apply',g,V(0,3.6,0),'component',site);return g;
  }
  function buildArchitecture(){
    ['WEU','SEA'].forEach((site,i)=>{
      const color=i?C.gold:C.blue,g=new THREE.Group();g.position.x=i?5:-5;architecture.add(g);const board=platform(g,color),dx=i?1.65:-1.65,gx=-dx;
      database(board,site,dx,1.0);goldenGate(board,site,gx,-1.05);
      label(i?'SOUTHEAST ASIA':'WEST EUROPE',i?'Singapore / regional pair':'Amsterdam / regional pair',g,V(0,-.8,3.3),'major',site);
      const net=new THREE.Group();g.add(net);net.visible=false;networks[networks.length-1].net=net;
      const ep=mesh(new THREE.CylinderGeometry(.34,.4,.35,6),mat(color),net,0,.3,.4);torus(.23,.025,emissive(color),ep,0,.18,0);
      box(.75,.32,.55,mat(0xa5bdcd),net,-dx,.27,1.6);mesh(new THREE.IcosahedronGeometry(.2,0),emissive(color,.5),net,-dx,.71,1.6);
      label('DEDICATED ENDPOINT','connection ingress IP /32',net,V(0,1,.4),'network',site);label('PRIVATE DNS','runtime resolver views',net,V(-dx,1.2,1.6),'network',site);
      const wall=new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(6.4,1.9,4.7)),new THREE.LineBasicMaterial({color,transparent:true,opacity:.25}));wall.position.y=.9;net.add(wall);
      label('ROUTES + SECURITY','NSG / security lists',net,V(dx,.3,-2.5),'network',site);
    });
    curve('weu',[V(-6.65,1,1),V(-5,1.3,.5),V(-3.35,1,-1.05)],C.blue);
    curve('sea',[V(3.35,1,-1.05),V(5,1.3,.5),V(6.65,1,1)],C.gold);
    curve('cross',[V(-3.35,2.6,-1.05),V(-2,5.4,-1.1),V(2,5.4,-1.1),V(3.35,2.6,-1.05)],C.blue,architecture,.032);
    curve('return',[V(3.35,2.4,-1.5),V(2,4.65,-2.9),V(-2,4.65,-2.9),V(-3.35,2.4,-1.5)],C.gold,architecture,.018);
    for(const id of ['weu','sea','cross','return'])makePacket(id,id==='return'||id==='sea'?C.gold:C.blue);
    // Two small stacks denote local durable trails; not extra deployments.
    ['WEU','SEA'].forEach((site,i)=>{const g=new THREE.Group();g.position.set(i?4.75:-4.75,.2,1.6);architecture.add(g);for(let k=0;k<3;k++)box(.6,.09,.36,mat(i?0xbe9679:0x6c9bb6),g,0,k*.16,0);label(i?'es / TRAIL':'ew / TRAIL','durable records',g,V(0,.9,0),'trail',site);});
  }
  function textTexture(site,value,time){const c=document.createElement('canvas');c.width=1024;c.height=640;const ctx=c.getContext('2d');ctx.fillStyle='#0b1621';ctx.fillRect(0,0,1024,640);ctx.fillStyle=site==='WEU'?'#75d8ff':'#ffb875';ctx.fillRect(0,0,1024,8);ctx.font='27px monospace';ctx.fillText(site==='WEU'?'WEST EUROPE':'SOUTHEAST ASIA',70,90);ctx.fillStyle='#4c6579';ctx.font='22px monospace';ctx.fillText('REPLICATION_TEST / ROW 101',70,145);ctx.fillStyle='#eff7fb';ctx.font='bold 78px Arial';ctx.fillText(value,65,320);ctx.fillStyle=site==='WEU'?'#75d8ff':'#ffb875';ctx.font='bold 96px Arial';ctx.fillText(time,65,460);ctx.font='22px monospace';ctx.fillStyle='#7f97ac';ctx.fillText('ROW-CHANGE TIMESTAMP',70,540);for(let i=0;i<33;i++){ctx.fillStyle=i%3===0?'#284354':'#172b3a';ctx.fillRect(720+i*5,380,2,140);}const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;return t;}
  function buildConflict(){
    ['WEU','SEA'].forEach((site,i)=>{const g=new THREE.Group();conflict.add(g);const color=i?C.gold:C.blue;box(4.7,2.95,.18,mat(0x344652),g);const textures={BASE:textTexture(site,'BASE','T0'),WEU_EARLIER:textTexture(site,'WEU_EARLIER','T1'),SEA_LATER:textTexture(site,'SEA_LATER','T2')};const face=mesh(new THREE.PlaneGeometry(4.55,2.84),new THREE.MeshBasicMaterial({map:textures.BASE}),g,0,0,.101);const rim=new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(4.77,3.02,.2)),new THREE.LineBasicMaterial({color,transparent:true,opacity:.8}));g.add(rim);glow(color,6,g,0,0,-.1,.12);rowObjects.push({g,face,textures,site});});
    const circle=torus(4,.012,emissive(0x30516b,.4),conflict,0,-1.6,-2);circle.rotation.x=.8;circle.rotation.z=.5;
    curve('decision',[V(2.5,.4,.7),V(.8,1.8,1.2),V(-.8,1.8,1.2),V(-2.5,0,.7)],C.green,conflict,.015);makePacket('decision',C.green,conflict);
  }
  function poseFor(ch){
    const poses=[
      {p:[-3.5,2.1,18.5],t:[-3.5,0,0]},
      {p:[4,12,24],t:[-5.1,.3,0]},
      {p:[5,15,23],t:[-5.1,1.0,0]},
      {p:[-3.6,7.0,10.5],t:[-9,1,0]},
      {p:[-3,6.3,12.8],t:[-3.8,2,-.8]},
      {p:[8.5,7.2,11.5],t:[3.2,1,0]},
      {p:[-3.6,1,13.5],t:[-3.6,.3,0]},
      {p:[-3.6,1,13.5],t:[-3.6,.3,0]},
      {p:[4,12,24],t:[-5.1,.3,0]}
    ];
    if(viewport.mobile){return [
      {p:[0,8,27],t:[0,6.3,0]},
      {p:[0,29,50],t:[0,12,0]},
      {p:[0,29,50],t:[0,13.2,0]},
      {p:[-6.65,12,17],t:[-6.65,6.8,0]},
      {p:[0,13,19],t:[0,10,-1]},
      {p:[6.65,12,17],t:[6.65,6.8,0]},
      {p:[0,6,32],t:[0,5,0]},
      {p:[0,6,32],t:[0,5,0]},
      {p:[0,29,50],t:[0,12,0]}
    ][ch];}return poses[ch];
  }
  function frameFor(ch,p){
    const ins=M.walkthrough('insert','WEU'),con=M.walkthrough('conflict','SEA');
    if(ch===3)return ins[p<.3?1:2];if(ch===4)return ins[3];if(ch===5)return ins[p<.52?4:p<.9?5:6];
    if(ch===6)return con[p<.16?1:p<.44?2:3];if(ch===7)return con[p<.18?4:p<.53?5:p<.9?6:7];if(ch===8)return con[7];return null;
  }
  function updateUI(ch,p,ended){
    const uiKey=ch+'|'+p+'|'+ended;if(uiKey===lastUI)return;lastUI=uiKey;
    if(current!==ch){chapters.forEach((el,i)=>el.classList.toggle('active',i===ch&&!ended));document.body.dataset.scene=String(ch);document.querySelectorAll('.rail a').forEach((a,i)=>{if(i===ch&&!ended)a.setAttribute('aria-current','step');else a.removeAttribute('aria-current');});current=ch;}
    if(ended)chapters.forEach(el=>el.classList.remove('active'));
    else if(!chapters[ch].classList.contains('active'))chapters[ch].classList.add('active');
    $('scene-kind').textContent=titles[ch];$('scene-number').textContent=String(ch+1).padStart(2,'0')+' / 09';$('bottom-title').textContent=ended?'TECHNICAL NOTES':titles[ch];$('progress').style.transform='scaleX('+state.progress+')';$('percent').textContent=Math.round(state.progress*100)+'%';
    modelFrame=frameFor(ch,p);const hud=$('row-hud');hud.hidden=!modelFrame||ch===8||ended;
    if(modelFrame){['WEU','SEA'].forEach(s=>{$('row-'+s.toLowerCase()).textContent=modelFrame.rows[s].value;$('time-'+s.toLowerCase()).textContent=modelFrame.rows[s].time;});const equal=modelFrame.rows.WEU.value===modelFrame.rows.SEA.value;hud.classList.toggle('converged',equal&&modelFrame.rows.WEU.value!=='BASE');$('row-divider').textContent=ch<6?'→':equal?'=':'≠';}
    $('converge-caption').textContent=ch===7&&p<.53?'SAME-PK TEST: SEA KEEPS T2 WHEN THE OLDER UPDATE ARRIVES':'SAME-PK TEST: WEU APPLIES T2 · BOTH COPIES CONVERGE';
    $('apply-caption').textContent=ch===5&&p<.52?'RECORD RECEIVED · ROW 101 IS NOT IN THE TARGET YET':'RSEA INSERTS ROW 101 · THE TRANSACTION IS TAGGED 01';
    $('chapter-hud').hidden=ended;document.querySelector('.rail').style.opacity=ended?'0':'1';
    $('replay').hidden=ended||ch===0||ch===8;
    $('replay').textContent=p<1?'↻ Restart animation':'↻ Replay animation';
    document.body.dataset.animation=p>=1?'complete':state.paused?'paused':'playing';
  }
  function readScroll(dt=0){
    const ch=window.BlockPlayback.sceneAt(scrollY,chapterTops,viewport.h);
    const entered=playback.enter(ch),ended=scrollY>=$('technical').offsetTop-80;
    state.scene=ch;
    state.p=playback.tick(entered?0:dt,{paused:state.paused,reduced:state.reduced,hidden:document.hidden,covered:ended||$('note-dialog').open});
    state.progress=ended?1:(ch+state.p)/chapters.length;
    state.ended=ended;
    updateUI(ch,state.p,ended);
  }
  function setCamera(ch,p){
    const prev=poseFor(Math.max(0,ch-1)),next=poseFor(ch),transition=state.reduced?1:ease(p/.20);
    const a=V(...prev.p),b=V(...next.p),at=V(...prev.t),bt=V(...next.t);camera.position.copy(a).lerp(b,transition);camera.quaternion.copy(qFromPose(a,at)).slerp(qFromPose(b,bt),transition);
    if(ch===0&&!state.reduced){camera.position.z-=ease(p)*1.7;}
    if(ch===4&&p>.2&&!state.reduced){const t=ease((p-.2)/.8);camera.position.x+=t*2.8;camera.position.z-=Math.sin(t*Math.PI)*1.2;}
    if(state.camera!=='design'){const target=at.lerp(bt,transition);camera.position.sub(target).multiplyScalar(state.camera==='near'?.8:1.25).add(target);}
    camera.updateMatrixWorld(true);
  }
  function packet(id,t,on=true){const obj=packets[id];obj.visible=on;if(on){obj.position.copy(curves[id].c.getPoint(clamp(t))).add(curves[id].tube.position);obj.rotation.set(state.time*.6,state.time*.8,0);}}
  function projectLabels(ch){
    const v=V(),occupied=[];for(const rec of labels){const isGlobe=rec.kind==='globe',isNetwork=rec.kind==='network',isTrail=rec.kind==='trail';let show=isGlobe?ch===0:ch>=1&&ch<=5||ch===8;
      if(isNetwork)show=ch===2&&state.p>.16&&rec.site==='WEU'&&!viewport.mobile;if(isTrail)show=ch===3||ch===5;
      if(!isGlobe&&viewport.mobile&&rec.kind==='component')show=ch===3&&rec.site==='WEU'||ch===5&&rec.site==='SEA';
      if(!isGlobe&&(ch===3||ch===5)&&rec.kind==='major')show=false;
      if(ch===2&&rec.kind==='major')show=false;
      if(!isGlobe&&ch===4)show=false;
      rec.anchor.getWorldPosition(v);v.project(camera);if(v.z>1||v.z<0||v.x<-.97||v.x>.95||v.y<-.85||v.y>.8)show=false;
      if(isGlobe){const world=rec.anchor.getWorldPosition(V());const normal=world.clone().sub(globe.position).normalize();if(normal.dot(camera.position.clone().sub(world).normalize())<0)show=false;}
      rec.el.hidden=!show;if(show){const w=rec.el.offsetWidth,h=rec.el.offsetHeight;let x=(v.x+1)*viewport.w/2,y=(1-v.y)*viewport.h/2;const base=y;
        for(const offset of [0,-h-8,h+8,-2*(h+8),2*(h+8)]){y=base+offset;const rect={l:x-w/2-4,r:x+w/2+4,t:y-h/2-3,b:y+h/2+3};if(!occupied.some(o=>rect.l<o.r&&rect.r>o.l&&rect.t<o.b&&rect.b>o.t)){occupied.push(rect);break;}}
        if(!viewport.mobile&&x-w/2<viewport.w*.38&&!isGlobe){rec.el.hidden=true;continue;}
        if(viewport.mobile)x=clamp(x,w/2+9,viewport.w-w/2-9);
        rec.el.style.left=x+'px';rec.el.style.top=y+'px';}
    }
  }
  function render(){
    if(!state.webgl||state.ended||disposed)return;
    const renderKey=[state.scene,state.p,state.time,state.debug,state.camera,state.assets,viewport.w,viewport.h,state.reduced].join('|');
    if(renderKey===lastRender)return;lastRender=renderKey;
    const ch=state.scene,p=state.p,t=state.time;
    setCamera(ch,p);const arrival=ch===1?(state.reduced?1:ease(p/.2)):1;
    globe.visible=ch===0||ch===1&&arrival<.99;globe.scale.setScalar(ch===1?Math.max(.001,1-arrival):1);architecture.visible=ch>0&&ch<6||ch===8;architecture.scale.setScalar(ch===1?Math.max(.001,arrival):1);architecture.position.y=ch===1?-4*(1-arrival):0;conflict.visible=ch===6||ch===7;
    globe.rotation.y=-.95+Math.sin(t*.09)*.025;stars.rotation.y=Math.sin(t*.015)*.025;
    Object.values(packets).forEach(o=>o.visible=false);
    if(ch===0)packet('world',state.paused?.58:(t*.10)%1);
    const lift=ch===2?ease((p-.02)/.26)*1.85:0;
    for(const n of networks){n.board.position.y=lift;n.net.visible=ch===2;n.net.position.y=lift*.28;}
    for(const id of ['weu','sea','cross','return'])curves[id].tube.position.y=lift;
    for(const site of ['WEU','SEA']){ggs[site].core.rotation.y=t*.18;const active=ch===3&&site==='WEU'||ch===5&&site==='SEA'||ch===8;dbs[site].halo.scale.setScalar(active?1.03+Math.sin(t*2)*.04:1);dbs[site].aura.material.opacity=active?.25:.08;}
    ['cross','return'].forEach(id=>{curves[id].tube.visible=ch!==3&&ch!==5;});
    if(ch===1||ch===2||ch===8){packet('cross',state.paused?.58:(t*.095)%1);packet('return',state.paused?.4:(t*.08+.3)%1);}
    if(ch===3)packet('weu',ease((p-.15)/.7));
    if(ch===4){packet('cross',ease((p-.13)/.80));packets.cross.scale.setScalar(1.8);}
    else packets.cross.scale.setScalar(1);
    if(ch===5)packet('sea',p<.52?0:ease((p-.52)/.38),p>=.52);
    if(conflict.visible){const converge=ch===7?ease((p-.45)/.3):0;rowObjects.forEach((r,i)=>{const sign=i?1:-1;r.g.position.set(sign*mix(2.65,2.4,converge),i?.2:-.2,0);r.g.rotation.set(.06,sign*mix(-.18,-.06,converge),sign*.035*(1-converge));r.face.material.map=r.textures[modelFrame.rows[r.site].value];});curves.decision.tube.visible=ch===7;if(ch===7)packet('decision',ease((p-.18)/.35),p>.18&&p<.75);}
    for(const g of glows)g.visible=state.debug==='final';
    scene.updateMatrixWorld(true);const start=performance.now();renderer.render(scene,camera);state.cpuSubmissionMs=performance.now()-start;state.frameCount++;projectLabels(ch);
    if(metricsElapsed>700||state.paused||state.reduced||state.frameCount===1){const snapshot=JSON.stringify(inspect(),null,2);$('runtime-state').textContent=snapshot;if(isQA)$('metrics').textContent=snapshot;metricsElapsed=0;}
  }
  function loop(now){if(disposed)return;const dt=Math.min((now-(last||now))/1000,.06);last=now;if(!document.hidden){if(!state.paused&&!state.reduced)state.time+=dt;metricsElapsed+=dt*1000;readScroll(dt);render();}raf=requestAnimationFrame(loop);}
  function resize(){viewport={w:innerWidth,h:innerHeight,mobile:innerWidth<901};chapterTops=chapters.map(el=>el.offsetTop);lastRender='';if(renderer){renderer.setPixelRatio(Math.min(devicePixelRatio||1,viewport.mobile?1.4:1.65));renderer.setSize(viewport.w,viewport.h);camera.aspect=viewport.w/viewport.h;camera.updateProjectionMatrix();}readScroll();render();}
  function inspect(){return {...state,rows:modelFrame?.rows||null,three:window.THREE?.REVISION,backend:'WebGL',seed:83,cameraPose:camera?{position:camera.position.toArray(),quaternion:camera.quaternion.toArray(),near:camera.near,far:camera.far}:null,drawCalls:renderer?.info.render.calls,triangles:renderer?.info.render.triangles,points:renderer?.info.render.points,geometries:renderer?.info.memory.geometries,textures:renderer?.info.memory.textures,dpr:renderer?.getPixelRatio(),postPasses:0,viewport};}
  function noteMarkup(id){const d=M.detail(id,0);return '<p class="eyebrow">'+d.kicker+'</p><h2>'+d.title+'</h2><div class="note-body"><p>'+d.body+'</p>'+(d.rows?'<dl>'+d.rows.map(([a,b])=>'<dt>'+a+'</dt><dd>'+b+'</dd>').join('')+'</dl>':'')+(d.code?'<pre></pre>':'')+(d.note?'<p class="note-warning">'+d.note+'</p>':'')+'<div class="note-actions">'+(d.links||[]).map(link=>'<button data-note="'+link+'">'+M.detail(link,0).kicker+' ↗</button>').join('')+'</div></div>';}
  function openNote(id){const d=M.detail(id,0);$('note-content').innerHTML=noteMarkup(id);if(d.code)$('note-content').querySelector('pre').textContent=d.code;if(!$('note-dialog').open)$('note-dialog').showModal();$('note-dialog').scrollTop=0;}
  function setupContent(){
    ['overview','network','rules','dns','iam','preparation','replication','tags','cdr','business','operations','scope'].forEach((id,i)=>{const d=M.detail(id,0),el=document.createElement('details');el.className='note-item';el.innerHTML='<summary><span>'+String(i+1).padStart(2,'0')+' / '+d.title+'</span></summary><div>'+noteMarkup(id)+'</div>';el.querySelector('h2').remove();el.querySelector('.eyebrow').remove();if(d.code)el.querySelector('pre').textContent=d.code;$('notes-grid').append(el);});
    $('scenario-text').innerHTML=['insert','conflict'].map(type=>'<h4>'+ (type==='insert'?'An INSERT, end to end':'Two conflicting UPDATEs, then convergence')+'</h4><ol>'+M.walkthrough(type,type==='insert'?'WEU':'SEA').map(f=>'<li><strong>'+f.title+'.</strong> '+f.body+'</li>').join('')+'</ol>').join('');
    on(document,'click',e=>{const b=e.target.closest('[data-note]');if(b)openNote(b.dataset.note);const anchor=e.target.closest('a[href^="#"]');if(anchor){const target=document.getElementById(anchor.hash.slice(1));if(target?.classList.contains('chapter')){e.preventDefault();history.replaceState(null,'',anchor.hash);window.scrollTo({top:target.offsetTop,behavior:'instant'});playback.replay();readScroll();}}});on(document.querySelector('.close-dialog'),'click',()=>$('note-dialog').close());on($('note-dialog'),'click',e=>{if(e.target===$('note-dialog')){const r=e.target.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)e.target.close();}});
    $('motion').setAttribute('aria-label',state.paused?'Resume motion':'Pause motion');
    on($('motion'),'click',()=>{state.paused=!state.paused;$('motion').setAttribute('aria-pressed',String(state.paused));$('motion').setAttribute('aria-label',state.paused?'Resume motion':'Pause motion');$('motion').innerHTML=state.paused?'▶ <span>Resume motion</span>':'Ⅱ <span>Pause motion</span>';lastUI='';});
    on($('replay'),'click',()=>{playback.replay();readScroll();});
    on(document,'visibilitychange',()=>{last=0;});
    document.documentElement.classList.toggle('reduced-motion',state.reduced);
    on(reduced,'change',()=>{state.reduced=reduced.matches;document.documentElement.classList.toggle('reduced-motion',state.reduced);if(state.reduced)state.paused=true;});
    if(state.paused){$('motion').setAttribute('aria-pressed','true');$('motion').innerHTML='▶ <span>Resume motion</span>';}
    if(isQA){$('inspection').hidden=false;on($('debug'),'change',e=>{state.debug=e.target.value;scene?.traverse(o=>{if(o.isMesh&&o.material&&'wireframe' in o.material)o.material.wireframe=state.debug==='wireframe';});});on($('camera-bookmark'),'change',e=>state.camera=e.target.value);on($('scrub'),'input',e=>{const val=clamp(+e.target.value,0,8.99),ch=Math.floor(val);window.scrollTo({top:chapters[ch].offsetTop,behavior:'instant'});playback.enter(ch);playback.seek(val-ch);readScroll();});on($('reset-time'),'click',()=>state.time=0);on($('capture-frame'),'click',()=>{render();const link=document.createElement('a');link.href=$('canvas').toDataURL('image/png');link.download='worlds-in-sync-scene-'+state.scene+'.png';link.click();});}
  }
  setupContent();init();on(window,'resize',resize);on(window,'pageshow',resize);resize();raf=requestAnimationFrame(loop);
  window.WorldsInSync={inspect,frameFor,dispose(){disposed=true;cancelAnimationFrame(raf);listeners.forEach(f=>f());const geo=new Set(),mats=new Set();scene?.traverse(o=>{if(o.geometry)geo.add(o.geometry);if(o.material)(Array.isArray(o.material)?o.material:[o.material]).forEach(m=>mats.add(m));});geo.forEach(g=>g.dispose());mats.forEach(m=>m.dispose());rowObjects.forEach(r=>Object.values(r.textures).forEach(t=>t.dispose()));glowTexture?.dispose();envTexture?.dispose();renderer?.dispose();}};
})();
