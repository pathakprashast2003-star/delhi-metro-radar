import * as THREE from 'three';
import { Creator, MapScene } from '@dvt3d/maplibre-three-plugin';

(() => {
  const stations = {
    rajiv: { name: 'RAJIV CHOWK', coordinates: [77.2196, 28.6329], elevation: -16 },
    qutab: { name: 'QUTAB MINAR', coordinates: [77.186472, 28.51293], elevation: 15 }
  };
  const corridorCenter = [77.2030, 28.5729];
  const map = new maplibregl.Map({
    container: 'map',
    style: 'https://basemaps.cartocdn.com/gl/voyager-gl-style/style.json',
    center: corridorCenter,
    zoom: 11.35,
    pitch: 48,
    bearing: -10,
    maxPitch: 75,
    attributionControl: false,
    canvasContextAttributes: { antialias: true }
  });

  map.addControl(new maplibregl.NavigationControl({ showCompass: true }), 'top-right');
  map.addControl(new maplibregl.AttributionControl({ compact: true, customAttribution: '© OpenStreetMap contributors · © CARTO' }), 'bottom-right');

  let mapScene;
  let corridorObject;
  let train;
  let trainPath;
  let animationFrame = 0;
  let night = false;
  const originLat = corridorCenter[1];
  const metersPerDegreeLon = 111320 * Math.cos(originLat * Math.PI / 180);
  const metersPerDegreeLat = 110574;
  const local = (lngLat, height = 0) => new THREE.Vector3(
    (lngLat[0] - corridorCenter[0]) * metersPerDegreeLon,
    height,
    -(lngLat[1] - corridorCenter[1]) * metersPerDegreeLat
  );
  const material = (color, opts = {}) => new THREE.MeshStandardMaterial({ color, roughness: .72, metalness: .12, ...opts });
  const mats = {
    concrete: material(0x8b9695), darkConcrete: material(0x596567), rail: material(0x25363a, { metalness: .72, roughness: .26 }),
    platform: material(0xf0eee7), tactile: material(0xf2c928), blue: material(0x287fa8), glass: material(0x7db6c4, { transparent: true, opacity: .38, side: THREE.DoubleSide }),
    train: material(0xdfe5e4, { metalness: .42, roughness: .3 }), windows: material(0x18384a, { metalness: .25, roughness: .2 }), stripe: material(0x287fa8)
  };

  function box(parent, size, position, mat, rotationY = 0) {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(...size), mat);
    mesh.position.copy(position);
    mesh.rotation.y = rotationY;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    parent.add(mesh);
    return mesh;
  }

  function makePlatformStation(parent, center, name) {
    const station = new THREE.Group();
    station.position.copy(center);
    parent.add(station);
    // A readable, deliberately simplified DMRC elevated stop. Dimensions are metres.
    box(station, [190, 2.2, 22], new THREE.Vector3(0, 12, 0), mats.darkConcrete);
    for (const side of [-1, 1]) {
      box(station, [150, .65, 7.5], new THREE.Vector3(0, 13.5, side * 8.5), mats.platform);
      box(station, [150, .18, .45], new THREE.Vector3(0, 13.92, side * 5.15), mats.tactile);
      box(station, [145, .45, .28], new THREE.Vector3(0, 14.05, side * 11.5), mats.glass);
      for (let x = -65; x <= 65; x += 26) {
        box(station, [.65, 13, .65], new THREE.Vector3(x, 20, side * 8.5), mats.blue);
        // Curved Delhi blue canopy ribs, open-sided like an elevated Yellow Line station.
        const rib = new THREE.CatmullRomCurve3([
          new THREE.Vector3(x, 27, side * 4.5), new THREE.Vector3(x, 35, side * 7),
          new THREE.Vector3(x, 39, side * 11), new THREE.Vector3(x, 35, side * 15),
          new THREE.Vector3(x, 27, side * 18)
        ]);
        station.add(new THREE.Mesh(new THREE.TubeGeometry(rib, 16, .65, 7, false), mats.blue));
      }
      box(station, [145, .5, 13], new THREE.Vector3(0, 38, side * 11), mats.blue);
    }
    for (const x of [-76, 0, 76]) {
      const pier = new THREE.Mesh(new THREE.CylinderGeometry(2.4, 3, 12, 12), mats.concrete);
      pier.position.set(x, 5, 0); pier.castShadow = true; station.add(pier);
    }
    // Small blue station canopy/sign band. Geographic labels are separate map markers.
    box(station, [32, 2.4, .7], new THREE.Vector3(0, 18, 12.8), mats.blue);
    station.userData.stationName = name;
    return station;
  }

  function makeUndergroundCutaway(parent, center) {
    const station = new THREE.Group();
    station.position.copy(center);
    parent.add(station);
    // Cutaway is raised slightly above grade so the underground island remains legible on a 2D basemap.
    box(station, [280, 1.8, 68], new THREE.Vector3(0, 1.2, 0), mats.darkConcrete);
    box(station, [228, .65, 13], new THREE.Vector3(0, 5, 0), mats.platform);
    box(station, [190, .2, .6], new THREE.Vector3(0, 5.45, 6.2), mats.tactile);
    box(station, [190, .2, .6], new THREE.Vector3(0, 5.45, -6.2), mats.tactile);
    // Open cutaway sides show the island platform, columns and track-level chamber.
    for (const x of [-108, 108]) box(station, [2, 26, 68], new THREE.Vector3(x, -11, 0), mats.concrete);
    box(station, [218, 1.6, 2], new THREE.Vector3(0, -23, -32), mats.concrete);
    box(station, [218, 1.6, 2], new THREE.Vector3(0, -23, 32), mats.concrete);
    for (let x = -82; x <= 82; x += 41) {
      const pillar = new THREE.Mesh(new THREE.CylinderGeometry(1.05, 1.15, 20, 10), mats.concrete);
      pillar.position.set(x, -7, 0); station.add(pillar);
    }
    box(station, [18, 4, 28], new THREE.Vector3(0, 8, 0), mats.blue);
    return station;
  }

  function buildTrain(parent) {
    const group = new THREE.Group();
    const carLength = 17.2;
    for (let index = 0; index < 6; index++) {
      const car = new THREE.Group();
      box(car, [carLength - .6, 3.5, 3.15], new THREE.Vector3(0, 2.5, 0), mats.train);
      box(car, [carLength - 1, .32, 3.2], new THREE.Vector3(0, 4.3, 0), mats.train);
      for (const side of [-1, 1]) {
        box(car, [carLength - 2.4, 1.45, .1], new THREE.Vector3(0, 2.8, side * 1.61), mats.windows);
        box(car, [carLength - 1, .42, .14], new THREE.Vector3(0, 1.45, side * 1.63), mats.stripe);
        for (let doorX = -6; doorX <= 6; doorX += 6) box(car, [.14, 2.05, .16], new THREE.Vector3(doorX, 2.55, side * 1.68), mats.train);
      }
      car.position.x = (index - 2.5) * (carLength + .8);
      group.add(car);
    }
    parent.add(group);
    return group;
  }

  function createCorridorScene() {
    const origin = Creator.createRTCGroup(corridorCenter);
    const geometry = new THREE.Group();
    origin.add(geometry);

    mapScene.addLight(new THREE.HemisphereLight(0xf4f8ff, 0x46515a, 1.8));
    const sun = new THREE.DirectionalLight(0xfff3dc, 2.4); sun.position.set(-600, 1100, 500); geometry.add(sun);

    // Use the project's GTFS Yellow Line shape between Rajiv Chowk and Qutab Minar.
    fetch('src/data/yellow_line_gtfs_shapes.json').then(response => response.json()).then(data => {
      if (!mapScene) return;
      const fullShape = data.shapes.shp_1_31;
      const rajivIndex = 98;
      const qutabIndex = 160;
      const coordinates = [stations.rajiv.coordinates, ...fullShape.slice(rajivIndex, qutabIndex + 1).map(point => [point.lon, point.lat]), stations.qutab.coordinates];
      const points = coordinates.map((coord, index) => {
        const altitude = 9 + 5 * Math.sin(index / (coordinates.length - 1) * Math.PI);
        return local(coord, altitude);
      });
      trainPath = new THREE.CatmullRomCurve3(points, false, 'centripetal', .2);
      trainPath.curveType = 'centripetal';
      // Twin rail lines follow the actual route shape; mesh route height is illustrative.
      const railSeparation = 1.55;
      for (const side of [-1, 1]) {
        const railPoints = [];
        for (let i = 0; i <= 240; i++) {
          const point = trainPath.getPointAt(i / 240);
          const tangent = trainPath.getTangentAt(i / 240);
          const normal = new THREE.Vector3(-tangent.z, 0, tangent.x).normalize();
          point.addScaledVector(normal, side * railSeparation);
          railPoints.push(point);
        }
        const railCurve = new THREE.CatmullRomCurve3(railPoints);
        geometry.add(new THREE.Mesh(new THREE.TubeGeometry(railCurve, 600, .17, 6, false), mats.rail));
      }
      const sleepers = new THREE.InstancedMesh(new THREE.BoxGeometry(2.8, .22, .45), mats.concrete, 260);
      const dummy = new THREE.Object3D();
      for (let i = 0; i < 260; i++) {
        const t = i / 259;
        const point = trainPath.getPointAt(t);
        const tangent = trainPath.getTangentAt(t);
        dummy.position.copy(point).add(new THREE.Vector3(0, -.28, 0));
        dummy.rotation.set(0, Math.atan2(-tangent.z, tangent.x), 0);
        dummy.updateMatrix(); sleepers.setMatrixAt(i, dummy.matrix);
      }
      geometry.add(sleepers);

      // Piers and a continuous concrete viaduct are instanced along the elevated corridor.
      const pierCount = 31;
      const piers = new THREE.InstancedMesh(new THREE.CylinderGeometry(2.1, 2.8, 12, 10), mats.concrete, pierCount);
      const caps = new THREE.InstancedMesh(new THREE.BoxGeometry(13, 1.1, 5), mats.concrete, pierCount);
      for (let i = 0; i < pierCount; i++) {
        const point = trainPath.getPointAt(i / (pierCount - 1));
        dummy.position.set(point.x, point.y - 7, point.z); dummy.rotation.set(0, 0, 0); dummy.updateMatrix(); piers.setMatrixAt(i, dummy.matrix);
        dummy.position.set(point.x, point.y - .95, point.z); dummy.updateMatrix(); caps.setMatrixAt(i, dummy.matrix);
      }
      geometry.add(piers, caps);

      makeUndergroundCutaway(geometry, local(stations.rajiv.coordinates, 0));
      makePlatformStation(geometry, local(stations.qutab.coordinates, 0), 'Qutab Minar');
      train = buildTrain(geometry);
      map.triggerRepaint();
    }).catch(error => {
      console.error('Could not load the Yellow Line shape for the 3D map.', error);
      document.querySelector('.map-status').innerHTML = '<i></i> MAP READY · ROUTE GEOMETRY UNAVAILABLE';
    });

    mapScene.addObject(origin);
  }

  function addStationMarker(station, className) {
    const element = document.createElement('button');
    element.className = `station-marker ${className}`;
    element.type = 'button';
    element.innerHTML = `<span></span>${station.name}`;
    element.setAttribute('aria-label', `Focus ${station.name}`);
    element.addEventListener('click', () => map.flyTo({ center: station.coordinates, zoom: 16.5, pitch: 58, duration: 1000 }));
    new maplibregl.Marker({ element, anchor: 'bottom' }).setLngLat(station.coordinates).addTo(map);
  }

  map.on('load', () => {
    mapScene = new MapScene(map);
    createCorridorScene();
    addStationMarker(stations.rajiv, 'rajiv-marker');
    addStationMarker(stations.qutab, 'qutab-marker');
    document.querySelector('.map-status').innerHTML = '<i></i> GEOGRAPHIC STATIONS · SCHEMATIC 3D CORRIDOR';
  });

  function animate() {
    if (!trainPath || !train) return;
    const phase = (performance.now() * .000012) % 1;
    const point = trainPath.getPointAt(phase);
    const tangent = trainPath.getTangentAt(phase);
    train.position.copy(point);
    train.rotation.y = Math.atan2(-tangent.z, tangent.x);
    const remainingSeconds = Math.ceil((1 - phase) * 480);
    document.getElementById('eta').textContent = `${String(Math.floor(remainingSeconds / 60)).padStart(2, '0')}:${String(remainingSeconds % 60).padStart(2, '0')}`;
    document.getElementById('progress').style.width = `${phase * 100}%`;
    map.triggerRepaint();
    animationFrame = requestAnimationFrame(animate);
  }
  map.on('load', () => { animationFrame = requestAnimationFrame(animate); });

  document.getElementById('recenter').addEventListener('click', () => map.flyTo({ center: corridorCenter, zoom: 11.35, pitch: 48, bearing: -10, duration: 950 }));
  document.getElementById('pitch').addEventListener('click', event => {
    const top = map.getPitch() > 20;
    map.easeTo({ pitch: top ? 0 : 52, duration: 650 });
    event.currentTarget.querySelector('span').textContent = top ? 'Map: top / 3D' : 'Map: 3D / top';
  });
  document.getElementById('daynight').addEventListener('click', event => {
    night = !night;
    document.body.classList.toggle('night', night);
    map.getCanvas().style.filter = night ? 'brightness(.62) saturate(.72)' : '';
    event.currentTarget.querySelector('span').textContent = night ? 'Day view' : 'Night view';
  });
  window.addEventListener('beforeunload', () => cancelAnimationFrame(animationFrame), { once: true });
})();
