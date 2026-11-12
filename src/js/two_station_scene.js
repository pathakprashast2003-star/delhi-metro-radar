/* Connected two-station Three.js metro concept — standalone preview. */
(() => {
  const canvas = document.getElementById('metro-scene');
  const overlayMode = new URLSearchParams(location.search).get('overlay') === '1';
  const scene = new THREE.Scene();
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(devicePixelRatio, innerWidth < 700 ? 1.35 : 1.8));
  renderer.setSize(innerWidth, innerHeight);
  renderer.outputEncoding = THREE.sRGBEncoding;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = .92;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  const camera = new THREE.PerspectiveCamera(38, innerWidth / innerHeight, .1, 500);
  camera.position.set(34, 27, 42);
  const controls = new THREE.OrbitControls(camera, canvas);
  controls.enableDamping = true; controls.dampingFactor = .06; controls.maxPolarAngle = Math.PI / 2.08; controls.minDistance = 19; controls.maxDistance = 70;
  controls.target.set(0, 7, 0);
  controls.maxPolarAngle = Math.PI / 2.12;

  function publishStationAnchors() {
    camera.updateMatrixWorld(true);
    const point = (x) => {
      const p = new THREE.Vector3(x, 9.35, 0).project(camera);
      return { x: (p.x * .5 + .5) * canvas.clientWidth, y: (-p.y * .5 + .5) * canvas.clientHeight };
    };
    window.__metroStationScreenAnchors = { rajiv: point(-18), qutab: point(18) };
  }
  controls.update();
  publishStationAnchors();

  const palette = { bg: 0xdfe5e1, plinth: 0xc5c9c4, concrete: 0x777f7d, concreteDark: 0x3f4848, rail: 0x1d292b, canopy: 0xe9efed, glass: 0x477d9d, yellow: 0xf2c928, ink: 0x243338, green: 0x385d50 };
  scene.background = overlayMode ? null : new THREE.Color(palette.bg);
  scene.fog = overlayMode ? null : new THREE.Fog(palette.bg, 48, 95);
  if (overlayMode) renderer.setClearColor(0x000000, 0);
  const ambient = new THREE.HemisphereLight(0xfffcf4, 0x576562, 1.15); scene.add(ambient);
  const sun = new THREE.DirectionalLight(0xfff3d6, 1.25); sun.position.set(-25, 38, 22); sun.castShadow = true; sun.shadow.mapSize.set(1024,1024); sun.shadow.camera.left=-35; sun.shadow.camera.right=35; sun.shadow.camera.top=35; sun.shadow.camera.bottom=-35; scene.add(sun);
  const world = new THREE.Group(); scene.add(world);
  const mat = (color, extra={}) => new THREE.MeshStandardMaterial({ color, roughness:.7, metalness:.08, ...extra });
  const concrete = mat(palette.concrete), dark = mat(palette.concreteDark), railMat = mat(palette.rail,{metalness:.7,roughness:.25}), yellow=mat(palette.yellow), wall=mat(0xd7d8d3), glass=mat(palette.glass,{transparent:true,opacity:.22,roughness:.15,metalness:.25,side:THREE.DoubleSide});
  function box(w,h,d, material, x=0,y=0,z=0, parent=world){ const m=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),material);m.position.set(x,y,z);m.castShadow=m.receiveShadow=true;parent.add(m);return m; }
  function cylinder(r,h,material,x,y,z,parent=world){const m=new THREE.Mesh(new THREE.CylinderGeometry(r,r*.9,h,16),material);m.position.set(x,y,z);m.castShadow=m.receiveShadow=true;parent.add(m);return m;}
  box(58,1.3,34,mat(palette.plinth),0,-1.9,0);
  // Urban street grid and blocks frame a top-down station crossing.
  const road = mat(0xc98968), sidewalk=mat(0x9a9c8b), block=mat(0xd8d1b9), park=mat(0x769272);
  box(58,.12,7,road,0,-1.16,-13); box(58,.12,7,road,0,-1.16,13);
  box(7,.12,34,road,-25,-1.16,0); box(7,.12,34,road,25,-1.16,0);
  for(let x=-27;x<=27;x+=3.5){box(.11,.025,5,mat(0xf2e5c7),x,-1.08,-13);box(.11,.025,5,mat(0xf2e5c7),x,-1.08,13);}
  for(let x=-26;x<=26;x+=8){ for(const z of [-21,21]) { box(5,3.4,4,block,x,.75,z); box(3.6,.12,2.6,mat(0x9d997f),x,2.52,z); } }
  for(let x=-25;x<=25;x+=4.2){ for(const z of [-9.2,9.2]) { cylinder(.55,1.5,mat(0x426749),x,-.2,z); const crown=new THREE.Mesh(new THREE.SphereGeometry(.8,8,7),mat(0x62835c));crown.position.set(x,.8,z);crown.castShadow=true;world.add(crown); } }
  box(51,.9,16,dark,0,8,0); // station deck supports both platforms and tracks
  for(let x=-22;x<=22;x+=7.2){ cylinder(.78,9,concrete,x,3.05,0); box(3.3,.42,1.3,concrete,x,7.5,0); }
  // twin track, sleepers and catenary
  [-1.85,1.85].forEach(z=>{ [-.45,.45].forEach(off=>box(51,.13,.10,railMat,0,8.65,z+off)); for(let x=-24;x<=24;x+=.72) box(.12,.09,2.1,dark,x,8.48,z); });
  for(let x=-24;x<=24;x+=8){ box(.14,8,.14,dark,x,12.5,-6.0); box(.14,8,.14,dark,x,12.5,6.0); box(.2,.12,12.5,dark,x,16.2,0); [-3,3].forEach(z=>box(.05,.05,5.6,dark,x,15.5,z)); }
  const people = new THREE.Group(); world.add(people);
  function person(x,y,z, accent){const g=new THREE.Group(); const body=new THREE.Mesh(new THREE.CylinderGeometry(.105,.13,.48,6),mat(accent));body.position.y=.35;g.add(body);const head=new THREE.Mesh(new THREE.SphereGeometry(.13,8,8),mat(0xd1a07b));head.position.y=.7;g.add(head);g.position.set(x,y,z);people.add(g);}
  function station(x,name,flip){ const g=new THREE.Group();g.position.x=x;world.add(g); const pLen=12; const underground=name==='RAJIV CHOWK';
    if(underground){
      // Rajiv Chowk is a deep-bore station with a central island between the tracks.
      box(pLen,.5,3.5,mat(0x858b89),0,9.12,0,g);
      [-1,1].forEach(side=>{box(pLen,.12,.22,yellow,0,9.39,side*1.55,g);for(let px=-5.3;px<=5.3;px+=.36)box(.08,.035,.18,mat(0xf5cb55),px,9.48,side*1.47,g);});
      // Cutaway tunnel shell with tiled lining, platform columns and overhead slab.
      box(pLen,7,.5,mat(0x68747b),0,5.3,-7,g);box(pLen,7,.5,mat(0x68747b),0,5.3,7,g);box(.5,7,14,mat(0x68747b),-6,5.3,0,g);
      box(pLen,.4,14,mat(0x737f86),0,9.8,0,g);
      box(11.5,.42,.12,mat(0x17628f),0,7.9,-6.72,g);
      for(let px=-4.8;px<=4.8;px+=2.4){cylinder(.16,5.2,mat(0x9ba3a3),px,6.3,0,g);box(.22,.15,3.2,mat(0x9ba3a3),px,9.08,0,g);}
      for(let px=-4.8;px<=4.8;px+=2.4)person(px,9.45,(px%2?1:-1)*2.3,[0x334e62,0xb14937,0xd09325,0x385d50][Math.abs(Math.round(px+5))%4]);
    } else {
    // Qutab Minar has two elevated side platforms, one outside each track.
    [-1,1].forEach(side => {
      const z = side * 5.55;
      box(pLen,.42,3.0,mat(0x858b89),0,9.12,z,g);
      box(pLen,.12,.24,yellow,0,9.39,z-side*1.27,g);
      box(pLen,.06,.14,mat(0x596366),0,9.38,z+side*1.37,g);
      // tactile warning studs at the platform edge
      for(let px=-5.3;px<=5.3;px+=.34) box(.08,.035,.22,mat(0xf5cb55),px,9.48,z-side*1.2,g);
      for(let px=-4.9;px<=4.9;px+=2.45) person(px,9.42,z+side*.36,[0x334e62,0xb14937,0xd09325,0x385d50][Math.abs(Math.round(px+5))%4]);
    });
    // Elevated Delhi platform: deep grey tiled slab, steel canopy ribs and corrugated roof.
    const tile=mat(0x8b908d,{roughness:.92}), steel=mat(0x596466,{metalness:.58,roughness:.38}), roofMat=mat(0x6e7777,{metalness:.42,roughness:.58});
    for(let tx=-5.4;tx<=5.4;tx+=.9) box(.035,.012,2.9,mat(0xb4b7b0),tx,9.337,5.55,g);
    for(let tx=-5.4;tx<=5.4;tx+=1.8) box(12,.018,.035,mat(0x777e7a),0,9.34,5.55+tx/3,g);
    const roofCurve=new THREE.CatmullRomCurve3([new THREE.Vector3(-6,0,-1.55),new THREE.Vector3(-6,1.0,-.8),new THREE.Vector3(-6,1.5,0),new THREE.Vector3(-6,1.0,.8),new THREE.Vector3(-6,0,1.55)]);
    for(let rx=-5.5;rx<=5.5;rx+=1.8){const pts=roofCurve.getPoints(20).map(p=>p.clone().add(new THREE.Vector3(rx,12.0,5.55)));g.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts),24,.075,7,false),steel));}
    const canopyRoof=box(12,.12,3.1,roofMat,0,13.05,5.55,g);
    // Fine corrugations and cross beams make the canopy read as a station roof.
    for(let rz=-1.45;rz<=1.45;rz+=.18) box(11.8,.035,.035,steel,0,13.13,5.55+rz,g);
    for(let rx=-5.5;rx<=5.5;rx+=3.6) box(.09,1.05,2.95,steel,rx,12.48,5.55,g);
    // cutaway concourse and glazed facade
    [-1,1].forEach(side=>{box(pLen-1,2.7,1.8,wall,0,6.9,side*5.55,g);box(pLen-1.2,1.9,.12,glass,0,6.8,side*6.47,g);box(pLen,.18,2.0,dark,0,8.75,side*5.55,g);});
    // stairs/escalators in open facade
    [-1,1].forEach(side=>{const stairs=new THREE.Group();stairs.position.set(flip?2.8:-2.8,5.35,side*6.5);stairs.rotation.x=-.50;for(let i=0;i<9;i++)box(2.3,.12,.35,mat(i%2?0x4a5557:0x697475),0,i*.15,i*.29,stairs);g.add(stairs);});
    // signage
    const sign=box(3.7,.5,.12,mat(0x17628f),flip?2.7:-2.7,10.15,6.65,g);sign.userData.label=name;
    box(3.35,.055,.04,mat(0xf2c928),flip?2.7:-2.7,9.99,6.72,g);
    for(let i=0;i<7;i++) person(-4.9+Math.random()*9.7,9.45,-1.0+Math.random()*2.0,[0x334e62,0xb14937,0xd09325,0x385d50][i%4]);
    // station piers / entrance room
    [-4.5,4.5].forEach(px=>[-1,1].forEach(side=>cylinder(.42,7.2,concrete,px,3.55,side*5.55,g))); [-1,1].forEach(side=>{box(6.6,2.5,1.8,wall,0,2.25,side*5.55,g);box(6.7,1.7,.1,glass,0,2.5,side*6.48,g);});
    }
  }
  station(-18,'RAJIV CHOWK',false); station(18,'QUTAB MINAR',true);
  // Cross-track concourse inspired by the reference: a blue pedestrian bridge spans both tracks.
  box(7.2,.42,12.8,mat(0x2877a7),0,12.3,0);
  box(5.4,.18,10.6,mat(0x398caf),0,12.62,0);
  for(const x of [-3.4,3.4]) for(let z=-5.4;z<=5.4;z+=1.8) box(.12,1.35,.12,mat(0xe4e8df),x,11.45,z);
  box(3.8,.35,.12,mat(0x24383d),0,12.9,5.2);
  function stationLabel(text, x) {
    const label = document.createElement('canvas'); label.width = 512; label.height = 100;
    const ctx = label.getContext('2d'); ctx.fillStyle = '#213238'; ctx.roundRect(0, 8, 512, 82, 12); ctx.fill();
    ctx.fillStyle = '#f1c03a'; ctx.fillRect(22, 29, 34, 34); ctx.fillStyle = '#ffffff'; ctx.font = '700 36px Manrope, sans-serif'; ctx.fillText(text, 76, 57);
    const texture = new THREE.CanvasTexture(label); texture.encoding = THREE.sRGBEncoding;
    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map:texture, transparent:true, depthTest:false })); sprite.position.set(x, 13.2, 4.8); sprite.scale.set(7.2, 1.4, 1); world.add(sprite);
  }
  stationLabel('RAJIV CHOWK', -18); stationLabel('QUTAB MINAR', 18);
  // A quiet city silhouette provides depth without a costly full Delhi model.
  for (let i = 0; i < 26; i++) { const x = -32 + (i % 13) * 5.3, z = i < 13 ? -10.5 : 10.5, h = 2 + ((i * 17) % 7); box(3.4, h, 2.8, mat(i % 3 ? 0xc2c9c3 : 0xaeb8b1), x, h / 2 - 1, z); }
  // train on southbound spline
  const train = new THREE.Group(); world.add(train); const trainBody=mat(0xd9dddc,{metalness:.62,roughness:.28}), trainWindow=mat(0x244b61,{metalness:.3,roughness:.18}), trainStripe=mat(0x2579a5), doorMat=mat(0xb8c0bf,{metalness:.48,roughness:.34});
  for(let c=0;c<6;c++){const car=new THREE.Group();box(2.8,.82,1.48,trainBody,0,0,0,car);box(2.65,.13,1.35,mat(0xc4cac9),0,.47,0,car);[-.53,.53].forEach(z=>{const side=z+Math.sign(z)*.75;box(1.05,.35,.035,trainWindow,-.56,.07,side,car);box(1.05,.35,.035,trainWindow,.56,.07,side,car);box(.23,.52,.045,doorMat,0,.02,side,car);box(2.55,.10,.04,trainStripe,0,-.32,side,car);});box(.08,.56,1.52,trainStripe,-1.2,0,0,car);car.position.x=(c-2.5)*2.93;train.add(car);} train.position.set(0,9.75,-1.85);
  // Begin between the stations so the hero composition immediately reads as a connected system.
  let phase=.5, night=false, follow=false, saver=false, targetFocus=null;
  const focusPositions={left:new THREE.Vector3(-18,9,0),right:new THREE.Vector3(18,9,0)};
  function setMode(mode){night=mode==='night';scene.background.setHex(night?0x0c1215:palette.bg);scene.fog.color.setHex(night?0x0c1215:palette.bg);ambient.intensity=night?.45:1.15;sun.intensity=night?.3:1.25;document.body.classList.toggle('night',night);}
  document.querySelectorAll('[data-mode]').forEach(btn=>btn.addEventListener('click',()=>{document.querySelectorAll('[data-mode]').forEach(x=>x.classList.remove('active'));btn.classList.add('active');setMode(btn.dataset.mode);}));
  document.querySelectorAll('[data-focus]').forEach(btn=>btn.addEventListener('click',()=>{document.querySelectorAll('[data-focus]').forEach(x=>x.classList.remove('active'));btn.classList.add('active');targetFocus=focusPositions[btn.dataset.focus];}));
  document.getElementById('follow-train').addEventListener('click',e=>{follow=!follow;e.currentTarget.classList.toggle('active',follow);});
  document.getElementById('toggle-detail').addEventListener('click',e=>{saver=!saver;people.visible=!saver;e.currentTarget.classList.toggle('active',saver);renderer.setPixelRatio(saver?1:Math.min(devicePixelRatio,innerWidth<700?1.35:1.8));});
  addEventListener('resize',()=>{camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();renderer.setSize(innerWidth,innerHeight);publishStationAnchors();});
  let last=performance.now(); function animate(now){requestAnimationFrame(animate);const dt=Math.min(.05,(now-last)/1000);last=now;phase=(phase+dt*.024)%1; const x=-23+phase*46; train.position.x=x; train.rotation.y=.0;document.getElementById('progress').style.width=(phase*100)+'%';document.getElementById('eta').textContent='0'+Math.max(0,Math.ceil((1-phase)*4))+':'+String(Math.floor((1-phase)*59)).padStart(2,'0');
    if(targetFocus){controls.target.lerp(targetFocus,.05);if(controls.target.distanceTo(targetFocus)<.12)targetFocus=null;} if(follow){controls.target.lerp(new THREE.Vector3(x,9,0),.04);} controls.update();renderer.render(scene,camera);}
  animate(performance.now());
})();
