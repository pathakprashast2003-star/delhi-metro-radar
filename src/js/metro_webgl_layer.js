/* ============================================================
 * DELHI METRO RADAR — High-Craft 3D Yellow Line MapLibre Layer
 * Mounts detailed MetroKit architectural stations, continuous
 * ballast+sleeper+rail viaducts, cut-open subway track trenches,
 * window-textured context architecture, landscaping, and live
 * articulated MetroKit trains directly onto real Delhi streets.
 * ============================================================ */

window.MetroWebGLLayer = (function () {
  'use strict';

  const ORIGIN_LL = [77.2100, 28.6000];
  const VIADUCT_Y = 17.5;
  const SUBWAY_Y = 0.28;
  const TRACK_HALF_SEP = 4.6;
  const TRAIN_CAR_SCALE = 1.48;
  const FLEET_TRAINS_PER_DIR = 12;
  const OVERTURE_DEFAULT_RELEASE = '2026-10-21.0';
  const isMobileProfile = () => (typeof window !== 'undefined') && (
    window.innerWidth <= 860 ||
    (navigator.maxTouchPoints > 0 && Math.min(window.innerWidth, window.screen ? window.screen.width : window.innerWidth) <= 1024)
  );
  const MAX_PARK_TREES = isMobileProfile() ? 360 : 1200;
  let lastParkSig = '';
  let lastCamActionTs = 0;

  const DELHI_MONUMENTS = [
    {
      id: 'red_fort',
      name: 'Red Fort (Lal Qila)',
      era: 'Mughal · 1648',
      coords: [77.2410, 28.6559],
      img: 'public/monuments/red_fort.jpg',
      station: 'Chandni Chowk',
      tier: 1,
      featured: true,
      has3d: true,
      desc: 'Emperor Shah Jahan’s UNESCO red sandstone fortress and ramparts beside Chandni Chowk.',
      cam: { pitch: 58, bearing: -38, zoom: 17.3 }
    },
    {
      id: 'india_gate',
      name: 'India Gate',
      era: 'Lutyens · 1931',
      coords: [77.2295, 28.6129],
      img: 'public/monuments/india_gate.jpg',
      station: 'Central Secretariat',
      tier: 1,
      featured: true,
      has3d: true,
      desc: '42-metre sandstone triumphal archway anchoring Kartavya Path lawns & Netaji Canopy.',
      cam: { pitch: 56, bearing: -45, zoom: 17.5 }
    },
    {
      id: 'qutab_minar',
      name: 'Qutab Minar',
      era: 'UNESCO · 1193',
      coords: [77.1855, 28.5245],
      img: 'public/monuments/qutab_minar.jpg',
      station: 'Qutab Minar',
      tier: 1,
      featured: true,
      has3d: true,
      desc: '72.5-metre fluted red sandstone victory minaret framed by Mehrauli’s archaeological gardens.',
      cam: { pitch: 60, bearing: -25, zoom: 17.4 }
    },
    {
      id: 'humayun_tomb',
      name: 'Humayun’s Tomb',
      era: 'Mughal · 1570',
      coords: [77.2507, 28.5933],
      img: 'public/monuments/humayun_tomb.jpg',
      station: 'Jor Bagh',
      tier: 2,
      has3d: true,
      desc: 'India’s first Charbagh garden-tomb in red sandstone and gleaming white marble.',
      cam: { pitch: 56, bearing: -28, zoom: 17.4 }
    },
    {
      id: 'lotus_temple',
      name: 'Lotus Temple',
      era: 'Modern · 1986',
      coords: [77.2588, 28.5535],
      img: 'public/monuments/lotus_temple.jpg',
      station: 'Hauz Khas',
      tier: 1,
      has3d: true,
      desc: 'Twenty-seven sculptural white marble petals surrounded by nine serene reflecting pools.',
      cam: { pitch: 54, bearing: -22, zoom: 17.0 }
    },
    {
      id: 'rashtrapati_bhavan',
      name: 'Rashtrapati Bhavan',
      era: 'Lutyens · 1929',
      coords: [77.1994, 28.6143],
      img: 'public/monuments/rashtrapati_bhavan.jpg',
      station: 'Central Secretariat',
      tier: 2,
      desc: 'Presidential Palace crowning Raisina Hill with its iconic copper-and-sandstone dome.',
      cam: { pitch: 54, bearing: 65, zoom: 16.8 }
    },
    {
      id: 'akshardham',
      name: 'Akshardham Temple',
      era: 'Carved Stone · 2005',
      coords: [77.2773, 28.6127],
      img: 'public/monuments/akshardham.jpg',
      station: 'Akshardham',
      tier: 1,
      featured: true,
      has3d: true,
      desc: 'Monumental 43-metre pink sandstone & marble temple complex overlooking the eastern Yamuna floodplains beside Akshardham station.',
      cam: { pitch: 58, bearing: -32, zoom: 17.2 }
    },
    {
      id: 'jama_masjid',
      name: 'Jama Masjid',
      era: 'Mughal · 1656',
      coords: [77.2334, 28.6507],
      img: 'public/monuments/jama_masjid.jpg',
      station: 'Chawri Bazar',
      tier: 3,
      desc: 'Monumental Old Delhi courtyard mosque featuring striped red sandstone & marble minarets.',
      cam: { pitch: 56, bearing: -30, zoom: 17.1 }
    },
    {
      id: 'jantar_mantar',
      name: 'Jantar Mantar',
      era: 'Observatory · 1724',
      coords: [77.2166, 28.6271],
      img: 'public/monuments/jantar_mantar.jpg',
      station: 'Patel Chowk',
      tier: 1,
      featured: true,
      desc: 'Sawai Jai Singh II’s geometric brick astronomical sundials minutes from Patel Chowk.',
      cam: { pitch: 56, bearing: -18, zoom: 17.3 }
    },
    {
      id: 'purana_qila',
      name: 'Purana Qila',
      era: 'Citadel · 1538',
      coords: [77.2437, 28.6096],
      img: 'public/monuments/purana_qila.jpg',
      station: 'Central Secretariat',
      tier: 3,
      desc: 'Sixteenth-century bastions of Indraprastha standing beside a peaceful moat lake.',
      cam: { pitch: 56, bearing: -25, zoom: 16.9 }
    },
    {
      id: 'safdarjung_tomb',
      name: 'Safdarjung’s Tomb',
      era: 'Late Mughal · 1754',
      coords: [77.2106, 28.5893],
      img: 'public/monuments/safdarjung_tomb.jpg',
      station: 'Jor Bagh',
      tier: 3,
      desc: 'Fawn-and-red sandstone garden mausoleum situated directly at Jor Bagh’s gateway.',
      cam: { pitch: 56, bearing: -20, zoom: 17.3 }
    },
    {
      id: 'hauz_khas',
      name: 'Hauz Khas Complex',
      era: 'Sultanate · 1352',
      coords: [77.1930, 28.5539],
      img: 'public/monuments/hauz_khas.jpg',
      station: 'Hauz Khas',
      tier: 3,
      desc: 'Medieval madrasa, domed sandstone tombs & tranquil reservoir bordered by Deer Park.',
      cam: { pitch: 55, bearing: -24, zoom: 17.0 }
    }
  ];

  // Coherent South-East Delhi Daylight Direction (matches MapLibre setLight & AOShadowLayer)
  const SUN_OFFSET_X = 180;
  const SUN_OFFSET_Y = 265;
  const SUN_OFFSET_Z = 140;

  const HINDI_STATION_NAMES = {
    'Samaypur Badli': 'समयपुर बादली',
    'Rohini Sector 18, 19': 'रोहिणी सेक्टर 18, 19',
    'Haiderpur Badli Mor': 'हैदरपुर बादली मोड़',
    'Jahangirpuri': 'जहाँगीरपुरी',
    'Adarsh Nagar': 'आदर्श नगर',
    'Azadpur': 'आज़ादपुर',
    'Model Town': 'मॉडल टाउन',
    'GTB Nagar': 'जीटीबी नगर',
    'Vishwavidyalaya': 'विश्वविद्यालय',
    'Vidhan Sabha': 'विधान सभा',
    'Civil Lines': 'सिविल लाइंस',
    'Kashmere Gate': 'कश्मीरी गेट',
    'Chandni Chowk': 'चाँदनी चौक',
    'Chawri Bazar': 'चावड़ी बाज़ार',
    'New Delhi': 'नई दिल्ली',
    'Rajiv Chowk': 'राजीव चौक',
    'Patel Chowk': 'पटेल चौक',
    'Central Secretariat': 'केंद्रीय सचिवालय',
    'Udyog Bhawan': 'उद्योग भवन',
    'Lok Kalyan Marg': 'लोक कल्याण मार्ग',
    'Jor Bagh': 'जोड़ बाग़',
    'Dilli Haat - INA': 'दिल्ली हाट - आईएनए',
    'AIIMS': 'एम्स',
    'Green Park': 'ग्रीन पार्क',
    'Hauz Khas': 'हौज़ ख़ास',
    'Malviya Nagar': 'मालवीय नगर',
    'Saket': 'साकेत',
    'Qutab Minar': 'क़ुतुब मीनार',
    'Chhatarpur': 'छतरपुर',
    'Sultanpur': 'सुल्तानपुर',
    'Ghitorni': 'घिटोरनी',
    'Arjan Garh': 'अर्जन गढ़',
    'Guru Dronacharya': 'गुरु द्रोणाचार्य',
    'Sikanderpur': 'सिकंदरपुर',
    'MG Road': 'एमजी रोड',
    'IFFCO Chowk': 'इफ़को चौक',
    'Millennium City Centre': 'मिलेनियम सिटी सेंटर',

    // ── Blue Line (Line 3/4) Stations ──
    'Dwarka Sector - 21': 'द्वारका सेक्टर - 21',
    'Dwarka Sector - 8': 'द्वारका सेक्टर - 8',
    'Dwarka Sector - 9': 'द्वारका सेक्टर - 9',
    'Dwarka Sector - 10': 'द्वारका सेक्टर - 10',
    'Dwarka Sector - 11': 'द्वारका सेक्टर - 11',
    'Dwarka Sector - 12': 'द्वारका सेक्टर - 12',
    'Dwarka Sector - 13': 'द्वारका सेक्टर - 13',
    'Dwarka Sector - 14': 'द्वारका सेक्टर - 14',
    'Dwarka': 'द्वारका',
    'Dwarka Mor': 'द्वारका मोड़',
    'Nawada': 'नवादा',
    'Uttam Nagar West': 'उत्तम नगर पश्चिम',
    'Uttam Nagar East': 'उत्तम नगर पूर्व',
    'Janak Puri West': 'जनकपुरी पश्चिम',
    'Janak Puri East': 'जनकपुरी पूर्व',
    'Tilak Nagar': 'तिलक नगर',
    'Subash Nagar': 'सुभाष नगर',
    'Tagore Garden': 'टैगोर गार्डन',
    'Rajouri Garden': 'राजौरी गार्डन',
    'Ramesh Nagar': 'रमेश नगर',
    'Moti Nagar': 'मोती नगर',
    'Kirti Nagar': 'कीर्ति नगर',
    'Shadipur': 'शादीपुर',
    'Patel Nagar': 'पटेल नगर',
    'Rajendra Place': 'राजेंद्र प्लेस',
    'Karol Bagh': 'करोल बाग़',
    'Jhandewalan': 'झंडेवालान',
    'RK Ashram Marg': 'आर.के. आश्रम मार्ग',
    'Barakhamba': 'बाराखंभा',
    'Mandi House': 'मंडी हाउस',
    'Supreme Court': 'सुप्रीम कोर्ट',
    'Indraprastha': 'इंद्रप्रस्थ',
    'Yamuna Bank': 'यमुना बैंक',
    'Akshardham': 'अक्षरधाम',
    'Mayur Vihar-I': 'मयूर विहार - 1',
    'Mayur Vihar Ext': 'मयूर विहार एक्सटेंशन',
    'New Ashok Nagar': 'न्यू अशोक नगर',
    'Noida Sec -15': 'नोएडा सेक्टर - 15',
    'Noida Sec -16': 'नोएडा सेक्टर - 16',
    'Noida Sec -18': 'नोएडा सेक्टर - 18',
    'Botanical Garden': 'बॉटनिकल गार्डन',
    'Golf Course': 'गोल्फ कोर्स',
    'Noida City Centre': 'नोएडा सिटी सेंटर',
    'Noida Sec-34': 'नोएडा सेक्टर - 34',
    'Noida Sec-52': 'नोएडा सेक्टर - 52',
    'Noida Sec-61': 'नोएडा सेक्टर - 61',
    'Noida Sec-59': 'नोएडा सेक्टर - 59',
    'Noida Sec-62': 'नोएडा सेक्टर - 62',
    'Noida Electronic City': 'नोएडा इलेक्ट्रॉनिक सिटी'
  };

  let map = null;
  let glRenderer = null;
  let scene = null;
  let camera = null;
  let originMc = null;
  let meterUnit = 1;
  let originMatrix = null;
  let tempProj = null;

  let isReady = false;
  let infraGroup = null;
  let yellowOnly = false;
  let activeLineId = 'all'; // 'all' | 'yellow-line' | 'blue-line'
  let yellowCorridor = null;
  let blueCorridor = null;
  let vaishaliCorridor = null;
  let yamunaYardData = null;
  let yamunaYardGroup = null;
  let interchangeHubsData = null;
  let allCorridors = [];
  let allStationsData = [];

  let samples = [];
  let totalLen = 0;
  let fastCurveProxy = null;
  let stationsData = [];
  let fleetTrains = [];
  let animLastTime = 0;
  let lastOverviewSyncTime = 0;
  let hoverTooltip = null;
  let matLib = null;
  let sharedGeos = null;
  let selectedStationName = null;

  let overtureLoaded = false;
  let wallShadowLayer = null;
  let sunShadowLight = null;
  let shadowCatcherMesh = null;
  let lastShadowSnapX = Infinity;
  let lastShadowSnapZ = Infinity;
  let parkPool = null;
  let parkRefreshTimer = null;
  let stacChecked = false;
  let overtureWatcherAttached = false;
  let activeBuildingLayerId = 'building-3d';
  let activeBuildingSourceId = 'openmaptiles';

  let hemiLight = null;
  let fillLight = null;
  let trainBeamMat = null;
  let xrayTubeGroup = null;
  let buriedSubwayGroup = null;
  let undergroundRouteGeo = null;
  let allBuriedGuideLines = [];
  let activeWalkCorridor = null;
  let portalDists = [];
  let undergroundXRay = false;
  let subwayRailsVisible = true;
  let cameraTrackDist = 0;
  let cameraAnchorStationDist = 0;
  let lastTrackAnchorTs = 0;
  let railThemeLayers = { major: [], majorHatch: [], transit: [], transitHatch: [], irBallast: [], irSleepers: [], irRails: [] };
  let dmrcMetroLoaded = false;
  let monumentGroups = [];
  let currentSecOfDay = null;
  let lastAtmosMapSec = -99999;
  let lastAtmosMapTs = 0;
  let currentNightGlow = 0;
  let currentShadowAlpha = 0.24;
  let currentSunOffsetX = SUN_OFFSET_X;
  let currentSunOffsetY = SUN_OFFSET_Y;
  let currentSunOffsetZ = SUN_OFFSET_Z;
  let classifiedRoadLayers = null;
  let monumentMarkers = [];
  let majorStationMarkers = [];
  let railHubMarkers = [];
  let monumentMarkersInitialized = false;
  let majorStationMarkersInitialized = false;
  let railHubBounds = null;
  let selectedMonumentId = null;

  const INDIA_RAILWAY_HUBS = [
    {
      id: 'ndls',
      name: 'New Delhi Railway Station',
      code: 'NDLS',
      tier: 'terminal',
      aliases: ['new delhi', 'ndls'],
      platformsLabel: '16 Platforms · Nearest Metro: New Delhi (260m)',
      coords: [77.2202, 28.6421],
      cam: { pitch: 54, bearing: -20, zoom: 16.5 }
    },
    {
      id: 'dli',
      name: 'Old Delhi Junction',
      code: 'DLI',
      tier: 'terminal',
      aliases: ['delhi junction', 'old delhi', 'dli'],
      platformsLabel: '16 Platforms · Nearest Metro: Chandni Chowk / Kashmere',
      coords: [77.2288, 28.6615],
      cam: { pitch: 54, bearing: -18, zoom: 16.4 }
    },
    {"id":"nzm","name":"Hazrat Nizamuddin","code":"NZM","tier":"terminal","aliases":["sarai kale khan"],"platformsLabel":"9 Platforms \u00b7 Delhi Railways","coords":[77.25406,28.58899],"p0":[77.25412,28.58755],"p1":[77.254,28.59042],"roof":"blue","pLen":370,"sLen":240,"minX":-39.2,"maxX":39.2,"pfs":[[-34.2,6.0],[-8.8,6.9],[17.4,10.0],[34.2,6.0]],"trains":[[-28.9,16,8,"rajdhani",0],[-14.2,-18,7,"vande",1],[7.2,16,7,"shatabdi",0]],"cull":3000},
    {"id":"anvt","name":"Anand Vihar Terminal","code":"ANVT","tier":"terminal","aliases":[],"platformsLabel":"7 Platforms \u00b7 Delhi Railways","coords":[77.31514,28.6492],"p0":[77.31392,28.64824],"p1":[77.31636,28.65016],"roof":"blue","pLen":360,"sLen":240,"minX":-29.8,"maxX":29.8,"pfs":[[-24.8,6.0],[-0.1,10.0],[24.8,6.0]],"trains":[[-19.5,16,8,"vande",0],[-9.6,-18,8,"rajdhani",1],[9.4,16,7,"shatabdi",0]],"cull":3000},
    {"id":"dee","name":"Delhi Sarai Rohilla","code":"DEE","tier":"terminal","aliases":[],"platformsLabel":"7 Platforms \u00b7 Delhi Railways","coords":[77.18545,28.66327],"p0":[77.187,28.6628],"p1":[77.1839,28.66373],"roof":"terra","pLen":235,"sLen":170,"minX":-39.3,"maxX":39.3,"pfs":[[-34.3,6.0],[-18.8,4.1],[-5.1,10.0],[21.2,10.0],[34.3,6.0]],"trains":[[-29.0,16,7,"rajdhani",0],[4.5,-18,7,"shatabdi",1]],"cull":3000},
    {"id":"dec","name":"Delhi Cantt","code":"DEC","tier":"terminal","aliases":[],"platformsLabel":"5 Platforms \u00b7 Delhi Railways","coords":[77.11519,28.61202],"p0":[77.11422,28.61086],"p1":[77.11616,28.61318],"roof":"terra","pLen":290,"sLen":180,"minX":-38.2,"maxX":38.2,"pfs":[[-33.2,6.0],[-22.2,7.3],[8.9,10.0],[33.2,6.0]],"trains":[[-27.9,16,7,"shatabdi",0],[-0.1,-18,6,"vande",1]],"cull":3000},
    {"id":"ssb","name":"Shakur Basti","code":"SSB","tier":"major","aliases":[],"platformsLabel":"4 Platforms \u00b7 Delhi Railways","coords":[77.12753,28.68113],"p0":[77.12916,28.68099],"p1":[77.1259,28.68127],"roof":"blue","pLen":270,"sLen":165,"minX":-33.6,"maxX":33.6,"pfs":[[-28.6,6.0],[-18.9,4.7],[10.4,5.8],[28.6,6.0]],"trains":[[-23.3,16,6,"shatabdi",0],[2.0,-18,6,"rajdhani",1]],"cull":2400},
    {"id":"dsa","name":"Delhi Shahdara Junction","code":"DSA","tier":"major","aliases":[],"platformsLabel":"4 Platforms \u00b7 Delhi Railways","coords":[77.29222,28.6731],"p0":[77.29058,28.67307],"p1":[77.29386,28.67312],"roof":"terra","pLen":265,"sLen":160,"minX":-27.3,"maxX":27.3,"pfs":[[-22.3,6.0],[2.7,10.0],[22.3,6.0]],"trains":[[-17.0,16,6,"shatabdi",0],[-10.1,-18,6,"vande",1]],"cull":2400},
    {"id":"tkd","name":"Tughlakabad","code":"TKD","tier":"major","aliases":[],"platformsLabel":"6 Platforms \u00b7 Delhi Railways","coords":[77.29666,28.50333],"p0":[77.29714,28.50196],"p1":[77.29617,28.50471],"roof":"blue","pLen":290,"sLen":170,"minX":-30.7,"maxX":40.3,"pfs":[[-25.7,6.0],[-6.6,3.7],[19.6,9.7],[35.3,6.0]],"trains":[[-20.4,16,7,"rajdhani",0],[2.9,-18,6,"shatabdi",1]],"cull":2400},
    {"id":"szm","name":"Subzi Mandi","code":"SZM","tier":"major","aliases":[],"platformsLabel":"3 Platforms \u00b7 Delhi Railways","coords":[77.20037,28.66835],"p0":[77.20169,28.6675],"p1":[77.19905,28.6692],"roof":"terra","pLen":245,"sLen":150,"minX":-23.4,"maxX":23.4,"pfs":[[-18.4,6.0],[-8.3,5.5],[8.8,4.5],[18.4,6.0]],"trains":[[-13.1,16,6,"shatabdi",0]],"cull":2400},
    {"id":"oka","name":"Okhla","code":"OKA","tier":"station","aliases":[],"platformsLabel":"4 Platforms \u00b7 Delhi Railways","coords":[77.2655,28.55939],"p0":[77.26652,28.55827],"p1":[77.26447,28.56051],"roof":"blue","pLen":225,"sLen":130,"minX":-32.5,"maxX":32.5,"pfs":[[-27.9,5.2],[-6.5,9.3],[14.4,10.0],[27.9,5.2]],"trains":[[-23.0,0,6,"shatabdi",0]],"cull":1850},
    {"id":"tkj","name":"Tilak Bridge","code":"TKJ","tier":"station","aliases":[],"platformsLabel":"4 Platforms \u00b7 Delhi Railways","coords":[77.2374,28.6281],"p0":[77.23877,28.6273],"p1":[77.23604,28.62889],"roof":"terra","pLen":225,"sLen":130,"minX":-37.1,"maxX":37.1,"pfs":[[-32.5,5.2],[-16.5,8.7],[1.5,9.1],[20.5,10.0],[32.5,5.2]],"trains":[[-27.6,0,6,"vande",1]],"cull":1850},
    {"id":"csb","name":"Shivaji Bridge","code":"CSB","tier":"station","aliases":["minto bridge","mnbj"],"platformsLabel":"4 Platforms \u00b7 Also Minto Bridge \u00b7 Near Rajiv Chowk (706m)","coords":[77.22662,28.63337],"p0":[77.22806,28.63269],"p1":[77.22518,28.63406],"roof":"blue","pLen":225,"sLen":130,"minX":-30.7,"maxX":30.7,"pfs":[[-26.1,5.2],[-9.3,9.7],[10.2,10.0],[26.1,5.2]],"trains":[[-21.2,0,6,"shatabdi",0]],"cull":1850},
    {"id":"dsb","name":"Sadar Bazar","code":"DSB","tier":"station","aliases":[],"platformsLabel":"4 Platforms \u00b7 Near Chandni Chowk (1307m)","coords":[77.21698,28.65807],"p0":[77.21731,28.65667],"p1":[77.21665,28.65948],"roof":"terra","pLen":225,"sLen":130,"minX":-44.1,"maxX":44.1,"pfs":[[-39.5,5.2],[-21.7,10.0],[-0.4,10.0],[19.0,8.0],[39.5,5.2]],"trains":[],"cull":1850},
    {"id":"dkz","name":"Delhi Kishanganj","code":"DKZ","tier":"station","aliases":[],"platformsLabel":"4 Platforms \u00b7 Delhi Railways","coords":[77.19788,28.6628],"p0":[77.19641,28.66217],"p1":[77.19935,28.66343],"roof":"blue","pLen":225,"sLen":130,"minX":-37.9,"maxX":37.9,"pfs":[[-33.3,5.2],[-21.4,10.0],[1.1,7.7],[33.3,5.2]],"trains":[],"cull":1850},
    {"id":"vvph","name":"Vivekanand Puri Halt","code":"VVPH","tier":"halt","aliases":[],"platformsLabel":"2 Platforms \u00b7 Delhi Railways","coords":[77.1837,28.66415],"p0":[77.18527,28.66372],"p1":[77.18214,28.66458],"roof":"blue","pLen":110,"sLen":64,"minX":-15.3,"maxX":10.8,"pfs":[[-11.0,4.6],[-2.2,4.3],[6.5,4.6]],"trains":[],"cull":1850},
    {"id":"dbsi","name":"Daya Basti","code":"DBSI","tier":"station","aliases":[],"platformsLabel":"2 Platforms \u00b7 Delhi Railways","coords":[77.1711,28.66676],"p0":[77.1727,28.66646],"p1":[77.1695,28.66705],"roof":"blue","pLen":225,"sLen":130,"minX":-36.9,"maxX":36.9,"pfs":[[-32.3,5.2],[-16.9,6.0],[-4.5,3.7],[32.3,5.2]],"trains":[],"cull":1850},
    {"id":"ptnr","name":"Patel Nagar","code":"PTNR","tier":"station","aliases":[],"platformsLabel":"3 Platforms \u00b7 Delhi Railways","coords":[77.15656,28.6601],"p0":[77.15551,28.659],"p1":[77.1576,28.66121],"roof":"terra","pLen":225,"sLen":130,"minX":-37.1,"maxX":36.8,"pfs":[[-32.5,5.2],[-11.8,5.9],[-1.3,7.0],[14.8,9.3],[32.2,5.2]],"trains":[],"cull":1850},
    {"id":"ktnr","name":"Kirti Nagar Halt","code":"KTNR","tier":"halt","aliases":[],"platformsLabel":"2 Platforms \u00b7 Delhi Railways","coords":[77.14587,28.64744],"p0":[77.14493,28.64626],"p1":[77.14681,28.64861],"roof":"blue","pLen":160,"sLen":76,"minX":-14.1,"maxX":15.9,"pfs":[[-9.8,4.6],[0.9,8.2],[11.6,4.6]],"trains":[],"cull":1850},
    {"id":"nrvr","name":"Naraina Vihar","code":"NRVR","tier":"halt","aliases":[],"platformsLabel":"2 Platforms \u00b7 Delhi Railways","coords":[77.14111,28.6378],"p0":[77.14144,28.63639],"p1":[77.14078,28.6392],"roof":"terra","pLen":160,"sLen":76,"minX":-11.5,"maxX":11.5,"pfs":[[-7.2,4.6],[7.2,4.6]],"trains":[],"cull":1850},
    {"id":"inpr","name":"Indrapuri Halt","code":"INPR","tier":"halt","aliases":[],"platformsLabel":"2 Platforms \u00b7 Delhi Railways","coords":[77.14367,28.6271],"p0":[77.14402,28.62569],"p1":[77.14332,28.6285],"roof":"blue","pLen":160,"sLen":76,"minX":-11.6,"maxX":11.6,"pfs":[[-7.3,4.6],[7.3,4.6]],"trains":[],"cull":1850},
    {"id":"brsq","name":"Brar Square","code":"BRSQ","tier":"halt","aliases":[],"platformsLabel":"2 Platforms \u00b7 Delhi Railways","coords":[77.14051,28.61371],"p0":[77.14037,28.61228],"p1":[77.14065,28.61514],"roof":"terra","pLen":160,"sLen":76,"minX":-11.8,"maxX":11.7,"pfs":[[-7.5,4.6],[7.4,4.6]],"trains":[],"cull":1850},
    {"id":"spmr","name":"Sardar Patel Marg","code":"SPMR","tier":"halt","aliases":[],"platformsLabel":"2 Platforms \u00b7 Delhi Railways","coords":[77.16792,28.59591],"p0":[77.16916,28.59498],"p1":[77.16668,28.59685],"roof":"blue","pLen":160,"sLen":76,"minX":-11.7,"maxX":11.7,"pfs":[[-7.4,4.6],[7.4,4.6]],"trains":[],"cull":1850},
    {"id":"cnj","name":"Chanakyapuri","code":"CNJ","tier":"halt","aliases":[],"platformsLabel":"2 Platforms \u00b7 Delhi Railways","coords":[77.17162,28.59182],"p0":[77.17247,28.59059],"p1":[77.17077,28.59305],"roof":"terra","pLen":160,"sLen":76,"minX":-11.8,"maxX":11.8,"pfs":[[-7.5,4.6],[7.5,4.6]],"trains":[],"cull":1850},
    {"id":"dsj","name":"Delhi Safdarjung","code":"DSJ","tier":"station","aliases":[],"platformsLabel":"3 Platforms \u00b7 Delhi Railways","coords":[77.18641,28.58262],"p0":[77.18792,28.58206],"p1":[77.1849,28.58318],"roof":"blue","pLen":225,"sLen":130,"minX":-40.6,"maxX":40.6,"pfs":[[-36.0,5.2],[-7.0,10.0],[15.7,10.0],[36.0,5.2]],"trains":[[-31.1,0,6,"shatabdi",0]],"cull":1850},
    {"id":"soj","name":"Sarojini Nagar","code":"SOJ","tier":"halt","aliases":[],"platformsLabel":"2 Platforms \u00b7 Delhi Railways","coords":[77.19631,28.58121],"p0":[77.19794,28.58109],"p1":[77.19468,28.58134],"roof":"terra","pLen":160,"sLen":76,"minX":-11.5,"maxX":11.5,"pfs":[[-7.2,4.6],[7.2,4.6]],"trains":[],"cull":1850},
    {"id":"ldcy","name":"Lodhi Colony","code":"LDCY","tier":"halt","aliases":[],"platformsLabel":"2 Platforms \u00b7 Near Jor Bagh (882m)","coords":[77.21686,28.57962],"p0":[77.21523,28.57975],"p1":[77.21849,28.5795],"roof":"blue","pLen":160,"sLen":76,"minX":-11.3,"maxX":11.3,"pfs":[[-7.0,4.6],[7.0,4.6]],"trains":[],"cull":1850},
    {"id":"swnr","name":"Sewa Nagar","code":"SWNR","tier":"halt","aliases":[],"platformsLabel":"2 Platforms \u00b7 Delhi Railways","coords":[77.22768,28.5788],"p0":[77.22605,28.57886],"p1":[77.22932,28.57874],"roof":"terra","pLen":160,"sLen":76,"minX":-11.5,"maxX":11.5,"pfs":[[-7.2,4.6],[7.2,4.6]],"trains":[],"cull":1850},
    {"id":"lpnr","name":"Lajpat Nagar","code":"LPNR","tier":"station","aliases":[],"platformsLabel":"2 Platforms \u00b7 Delhi Railways","coords":[77.24405,28.57904],"p0":[77.24241,28.57901],"p1":[77.24568,28.57908],"roof":"blue","pLen":225,"sLen":130,"minX":-20.9,"maxX":20.9,"pfs":[[-16.3,5.2],[-0.1,8.3],[16.3,5.2]],"trains":[[-11.4,0,6,"shatabdi",0]],"cull":1850},
    {"id":"pgmd","name":"Pragati Maidan","code":"PGMD","tier":"halt","aliases":[],"platformsLabel":"2 Platforms \u00b7 Delhi Railways","coords":[77.24742,28.61609],"p0":[77.24786,28.61471],"p1":[77.24697,28.61747],"roof":"terra","pLen":160,"sLen":76,"minX":-13.6,"maxX":11.3,"pfs":[[-9.3,4.6],[7.0,4.6]],"trains":[],"cull":1850},
    {"id":"mwc","name":"Mandawali-Chander Vihar","code":"MWC","tier":"halt","aliases":[],"platformsLabel":"2 Platforms \u00b7 Delhi Railways","coords":[77.28843,28.62949],"p0":[77.28721,28.62853],"p1":[77.28966,28.63044],"roof":"blue","pLen":160,"sLen":76,"minX":-10.9,"maxX":10.9,"pfs":[[-6.6,4.6],[6.6,4.6]],"trains":[],"cull":1850},
    {"id":"vvb","name":"Vivek Vihar","code":"VVB","tier":"station","aliases":[],"platformsLabel":"4 Platforms \u00b7 Delhi Railways","coords":[77.31829,28.67336],"p0":[77.31992,28.67338],"p1":[77.31665,28.67334],"roof":"terra","pLen":225,"sLen":130,"minX":-11.9,"maxX":11.9,"pfs":[[-7.3,5.2],[7.3,5.2]],"trains":[],"cull":1850},
    {"id":"gkps","name":"Gokulpur Saboli Halt","code":"GKPS","tier":"halt","aliases":[],"platformsLabel":"2 Platforms \u00b7 Delhi Railways","coords":[77.30196,28.70362],"p0":[77.3019,28.70218],"p1":[77.30202,28.70505],"roof":"blue","pLen":160,"sLen":76,"minX":-8.9,"maxX":-0.3,"pfs":[[-4.6,4.6]],"trains":[],"cull":1850},
    {"id":"pm","name":"Palam","code":"PM","tier":"station","aliases":[],"platformsLabel":"3 Platforms \u00b7 Delhi Railways","coords":[77.09272,28.58519],"p0":[77.09174,28.58404],"p1":[77.0937,28.58633],"roof":"terra","pLen":225,"sLen":130,"minX":-23.4,"maxX":23.4,"pfs":[[-18.8,5.2],[2.7,9.5],[18.8,5.2]],"trains":[[-13.9,0,6,"shatabdi",1]],"cull":1850},
    {"id":"nsph","name":"Nasirpur Halt","code":"NSPH","tier":"halt","aliases":[],"platformsLabel":"2 Platforms \u00b7 Delhi Railways","coords":[77.10771,28.60282],"p0":[77.10673,28.60167],"p1":[77.10869,28.60397],"roof":"blue","pLen":160,"sLen":76,"minX":-11.4,"maxX":11.4,"pfs":[[-7.1,4.6],[7.1,4.6]],"trains":[],"cull":1850},
    {"id":"smdp","name":"Shahabad Mohammadpur","code":"SMDP","tier":"halt","aliases":[],"platformsLabel":"2 Platforms \u00b7 Delhi Railways","coords":[77.07146,28.56039],"p0":[77.07048,28.55924],"p1":[77.07244,28.56154],"roof":"terra","pLen":160,"sLen":76,"minX":-11.4,"maxX":11.4,"pfs":[[-7.1,4.6],[7.1,4.6]],"trains":[],"cull":1850},
    {"id":"bwsn","name":"Bijwasan","code":"BWSN","tier":"station","aliases":[],"platformsLabel":"4 Platforms \u00b7 Delhi Railways","coords":[77.05146,28.53685],"p0":[77.05048,28.5357],"p1":[77.05244,28.538],"roof":"blue","pLen":225,"sLen":130,"minX":-18.2,"maxX":18.2,"pfs":[[-13.6,5.2],[13.6,5.2]],"trains":[[-8.7,0,6,"shatabdi",0]],"cull":1850},
    {"id":"mglp","name":"Mangolpuri","code":"MGLP","tier":"halt","aliases":[],"platformsLabel":"2 Platforms \u00b7 Delhi Railways","coords":[77.09147,28.68361],"p0":[77.08984,28.68375],"p1":[77.0931,28.68347],"roof":"terra","pLen":160,"sLen":76,"minX":-11.7,"maxX":11.7,"pfs":[[-7.4,4.6],[7.4,4.6]],"trains":[],"cull":1850},
    {"id":"nno","name":"Nangloi","code":"NNO","tier":"station","aliases":[],"platformsLabel":"3 Platforms \u00b7 Delhi Railways","coords":[77.0574,28.68653],"p0":[77.05577,28.68667],"p1":[77.05903,28.68639],"roof":"blue","pLen":225,"sLen":130,"minX":-17.0,"maxX":17.0,"pfs":[[-12.4,5.2],[12.4,5.2]],"trains":[],"cull":1850},
    {"id":"mdk","name":"Mundka","code":"MDK","tier":"halt","aliases":[],"platformsLabel":"2 Platforms \u00b7 Delhi Railways","coords":[77.0291,28.68893],"p0":[77.02747,28.68907],"p1":[77.03074,28.6888],"roof":"terra","pLen":160,"sLen":76,"minX":-11.5,"maxX":11.5,"pfs":[[-7.2,4.6],[7.2,4.6]],"trains":[],"cull":1850},
    {"id":"ghe","name":"Ghevra","code":"GHE","tier":"station","aliases":[],"platformsLabel":"2 Platforms \u00b7 Delhi Railways","coords":[76.99779,28.69152],"p0":[76.99942,28.69139],"p1":[76.99616,28.69166],"roof":"blue","pLen":225,"sLen":130,"minX":-35.7,"maxX":35.7,"pfs":[[-31.1,5.2],[-16.3,10.0],[17.5,10.0],[31.1,5.2]],"trains":[],"cull":1850},
    {"id":"daz","name":"Delhi Azadpur","code":"DAZ","tier":"station","aliases":[],"platformsLabel":"3 Platforms \u00b7 Near Azadpur (520m)","coords":[77.177,28.70345],"p0":[77.17803,28.70233],"p1":[77.17596,28.70456],"roof":"terra","pLen":225,"sLen":130,"minX":-11.9,"maxX":11.9,"pfs":[[-7.3,5.2],[7.3,5.2]],"trains":[[-2.4,0,6,"shatabdi",1]],"cull":1850},
    {"id":"andi","name":"Adarsh Nagar Delhi","code":"ANDI","tier":"station","aliases":[],"platformsLabel":"3 Platforms \u00b7 Near Adarsh Nagar (432m)","coords":[77.16698,28.71418],"p0":[77.16801,28.71306],"p1":[77.16595,28.7153],"roof":"blue","pLen":225,"sLen":130,"minX":-25.6,"maxX":25.6,"pfs":[[-21.0,5.2],[-8.6,10.0],[21.0,5.2]],"trains":[],"cull":1850},
    {"id":"bhd","name":"Badli","code":"BHD","tier":"station","aliases":[],"platformsLabel":"3 Platforms \u00b7 Near Samaypur Badli (220m)","coords":[77.13727,28.7464],"p0":[77.1383,28.74528],"p1":[77.13623,28.74751],"roof":"terra","pLen":225,"sLen":130,"minX":-17.1,"maxX":17.1,"pfs":[[-12.5,5.2],[12.5,5.2]],"trains":[[-7.6,0,6,"vande",1]],"cull":1850},
    {"id":"khkn","name":"Khera Kalan","code":"KHKN","tier":"station","aliases":[],"platformsLabel":"2 Platforms \u00b7 Delhi Railways","coords":[77.11573,28.76959],"p0":[77.11676,28.76848],"p1":[77.11469,28.77071],"roof":"blue","pLen":225,"sLen":130,"minX":-12.2,"maxX":12.2,"pfs":[[-7.6,5.2],[7.6,5.2]],"trains":[],"cull":1850},
    {"id":"huk","name":"Holambi Kalan","code":"HUK","tier":"station","aliases":[],"platformsLabel":"2 Platforms \u00b7 Delhi Railways","coords":[77.10226,28.80152],"p0":[77.10277,28.80015],"p1":[77.10174,28.80288],"roof":"terra","pLen":225,"sLen":130,"minX":-17.0,"maxX":17.0,"pfs":[[-12.4,5.2],[12.4,5.2]],"trains":[],"cull":1850},
    {"id":"nur","name":"Narela","code":"NUR","tier":"station","aliases":[],"platformsLabel":"3 Platforms \u00b7 Delhi Railways","coords":[77.08539,28.8464],"p0":[77.0859,28.84503],"p1":[77.08488,28.84777],"roof":"blue","pLen":225,"sLen":130,"minX":-17.1,"maxX":17.1,"pfs":[[-12.5,5.2],[12.5,5.2]],"trains":[[-7.6,0,6,"vande",0]],"cull":1850}
  ];
  const _tmpColA = new THREE.Color();
  const _tmpColB = new THREE.Color();

  function haversineMeters(a, b) {
    if (!a || !b) return Infinity;
    const R = 6371000;
    const lat1 = a[1] * (Math.PI / 180);
    const lat2 = b[1] * (Math.PI / 180);
    const dLat = (b[1] - a[1]) * (Math.PI / 180);
    const dLng = (b[0] - a[0]) * (Math.PI / 180);
    const s = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
    return Math.round(2 * R * Math.asin(Math.sqrt(s)));
  }

  function getNearestStationsForLngLat(coords, limit = 2) {
    const list = allStationsData.length ? allStationsData : stationsData;
    if (!coords || !list.length) return [];
    const ranked = [];
    for (let i = 0; i < list.length; i++) {
      const st = list[i];
      if (!st || !st.coords) continue;
      ranked.push({ station: st, distanceM: haversineMeters(coords, st.coords) });
    }
    ranked.sort((x, y) => x.distanceM - y.distanceM);
    return ranked.slice(0, Math.max(1, limit));
  }

  function isOpenCutOrSurfaceDist(distM, elev, pitHalfM = 42.5, targetCorridor = null) {
    if (elev > SUBWAY_Y + 0.35) return true;
    const pDists = (targetCorridor && targetCorridor.portalDists) || portalDists;
    const sData = (targetCorridor && targetCorridor.stationsData) || stationsData;
    for (let i = 0; i < pDists.length; i++) {
      if (Math.abs(pDists[i] - distM) <= 10) return true;
    }
    for (let i = 0; i < sData.length; i++) {
      const st = sData[i];
      if (st.name === 'Yamuna Bank' && Math.abs(st.dist - distM) <= 85) return true;
      if (st.name === 'Rajiv Chowk' && Math.abs(st.dist - distM) <= 52) return true;
      if (st.structure !== 'elevated' && Math.abs(st.dist - distM) <= pitHalfM) return true;
    }
    return false;
  }

  function normalizeStationName(name) {
    return String(name || '').toLowerCase().replace(/[-–—]/g, ' ').replace(/\s+gurugram\b/, '').replace(/\s+/g, ' ').trim();
  }

  function getPreferredOvertureRelease() {
    try {
      const saved = localStorage.getItem('dmrc_overture_release');
      if (saved && /^\d{4}-\d{2}-\d{2}\.\d+$/.test(saved)) return saved;
    } catch (_) { }
    return OVERTURE_DEFAULT_RELEASE;
  }

  const MAX_OVERTURE_PREWARM_CACHE = 8;
  const OVERTURE_TILE_CACHE = new Map();
  let primaryOverturePMTiles = null;
  let primaryOvertureHttpUrl = null;
  let heroCorridorPrewarmed = false;

  function lngLatToTile14(lng, lat) {
    const z = 14;
    const n = 1 << z;
    const x = Math.max(0, Math.min(n - 1, Math.floor(((lng + 180) / 360) * n)));
    const rad = Math.max(-85, Math.min(85, lat)) * (Math.PI / 180);
    const y = Math.max(0, Math.min(n - 1, Math.floor(((1 - Math.log(Math.tan(rad) + 1 / Math.cos(rad)) / Math.PI) / 2) * n)));
    return { z, x, y };
  }

  function evictOverturePrewarmCache() {
    while (OVERTURE_TILE_CACHE.size > MAX_OVERTURE_PREWARM_CACHE) {
      const oldestKey = OVERTURE_TILE_CACHE.keys().next().value;
      if (oldestKey === undefined) break;
      OVERTURE_TILE_CACHE.delete(oldestKey);
    }
  }

  function prewarmOvertureTileZxy(z, x, y) {
    if (!primaryOverturePMTiles || !primaryOvertureHttpUrl) return null;
    const key = `${primaryOvertureHttpUrl}|${z}/${x}/${y}`;
    if (OVERTURE_TILE_CACHE.has(key)) return OVERTURE_TILE_CACHE.get(key);
    const p = primaryOverturePMTiles;
    const reqPromise = p.getZxy(z, x, y).then((res) => {
      if (!res || !res.data) {
        OVERTURE_TILE_CACHE.delete(key);
        return null;
      }
      return res;
    }).catch(() => {
      OVERTURE_TILE_CACHE.delete(key);
      return null;
    });
    OVERTURE_TILE_CACHE.set(key, reqPromise);
    evictOverturePrewarmCache();
    return reqPromise;
  }

  function prewarmOvertureAtLngLat(lng, lat, includeSeams = true) {
    if (!Number.isFinite(lng) || !Number.isFinite(lat)) return;
    if (!primaryOverturePMTiles) return;
    const c = lngLatToTile14(lng, lat);
    prewarmOvertureTileZxy(c.z, c.x, c.y);
    if (!includeSeams) return;
    const seen = new Set([`${c.x}/${c.y}`]);
    const offsets = [[0, 0.0028], [0, -0.0028], [0.0028, 0], [-0.0028, 0]];
    for (let i = 0; i < offsets.length; i++) {
      const nb = lngLatToTile14(lng + offsets[i][0], lat + offsets[i][1]);
      const k = `${nb.x}/${nb.y}`;
      if (!seen.has(k)) {
        seen.add(k);
        prewarmOvertureTileZxy(nb.z, nb.x, nb.y);
      }
    }
  }

  function prewarmOvertureHeroCorridor() {
    if (heroCorridorPrewarmed || !primaryOverturePMTiles) return;
    heroCorridorPrewarmed = true;
    // Warm Rajiv Chowk North (881 KB dense Connaught Place) + South seam tiles silently in background
    prewarmOvertureTileZxy(14, 11706, 6830);
    prewarmOvertureTileZxy(14, 11706, 6831);
  }

  function ensurePMTilesProtocol() {
    if (window._pmtilesProtocolRegistered && window._pmtilesProtocol) return true;
    if (window.pmtiles && typeof window.pmtiles.Protocol === 'function' && window.maplibregl && typeof window.maplibregl.addProtocol === 'function') {
      try {
        const protocol = new window.pmtiles.Protocol();
        const cachedTileHandler = (requestParameters, arg2) => {
          const url = requestParameters && requestParameters.url ? String(requestParameters.url) : '';
          const match = url.match(/^pmtiles:\/\/(https?:\/\/.+?)\/(\d+)\/(\d+)\/(\d+)(?:\.[a-z0-9]+)?$/i);
          if (match && arg2 instanceof AbortController) {
            const key = `${match[1]}|${match[2]}/${match[3]}/${match[4]}`;
            const cachedPromise = OVERTURE_TILE_CACHE.get(key);
            if (cachedPromise) {
              const signal = arg2.signal;
              if (signal && signal.aborted) {
                return Promise.reject(new DOMException('Aborted', 'AbortError'));
              }
              return new Promise((resolve, reject) => {
                let settled = false;
                const onAbort = () => {
                  if (settled) return;
                  settled = true;
                  reject(new DOMException('Aborted', 'AbortError'));
                };
                if (signal) signal.addEventListener('abort', onAbort, { once: true });
                cachedPromise.then((res) => {
                  if (signal) signal.removeEventListener('abort', onAbort);
                  if (settled) return;
                  settled = true;
                  if (res && res.data) {
                    resolve({
                      data: res.data.slice(0),
                      cacheControl: res.cacheControl || '',
                      expires: res.expires || ''
                    });
                  } else {
                    resolve(protocol.tile(requestParameters, arg2));
                  }
                }).catch((err) => {
                  if (signal) signal.removeEventListener('abort', onAbort);
                  if (settled) return;
                  settled = true;
                  reject(err);
                });
              });
            }
          }
          return protocol.tile(requestParameters, arg2);
        };
        window.maplibregl.addProtocol('pmtiles', cachedTileHandler);
        window._pmtilesProtocol = protocol;
        window._pmtilesProtocolRegistered = true;
        return true;
      } catch (e) {
        console.warn('[MetroWebGLLayer] PMTiles protocol setup notice:', e);
      }
    }
    return false;
  }

  // Begin fetching Overture PMTiles header, leaf dir, and hero Qutab tile immediately on script evaluation
  (function prewarmOverturePMTiles() {
    try {
      if (ensurePMTilesProtocol() && window.pmtiles && typeof window.pmtiles.PMTiles === 'function') {
        const releaseTag = getPreferredOvertureRelease();
        const httpUrl = `https://overturemaps-extras-us-west-2.s3.us-west-2.amazonaws.com/tiles/${releaseTag}/buildings.pmtiles`;
        const p = new window.pmtiles.PMTiles(httpUrl);
        window._pmtilesProtocol.add(p);
        primaryOverturePMTiles = p;
        primaryOvertureHttpUrl = httpUrl;
        // Fetching the initial Samaypur Badli Station #1 hero tile warms PMTiles header + Delhi leaf directory in parallel with basemap init
        prewarmOvertureAtLngLat(77.1383, 28.7446, false);
      }
    } catch (_) { }
  })();

  function initOrigin() {
    if (!window.maplibregl || !window.THREE) return;
    originMc = window.maplibregl.MercatorCoordinate.fromLngLat(ORIGIN_LL, 0);
    meterUnit = originMc.meterInMercatorCoordinateUnits();
    // Maps right-handed Three.js Y-up (X=East, Y=Up, Z=South) -> MapLibre Mercator (X=East, Y=South, Z=Up)
    // Determinant is negative (-u^3), matching standard THREE.PerspectiveCamera clip winding (FrontSide outward!).
    originMatrix = new THREE.Matrix4().set(
      meterUnit, 0, 0, originMc.x,
      0, 0, meterUnit, originMc.y,
      0, meterUnit, 0, 0,
      0, 0, 0, 1
    );
    tempProj = new THREE.Matrix4();
  }

  function toLocalMeters(coords, elevM = 0) {
    const c = window.maplibregl.MercatorCoordinate.fromLngLat(coords, elevM);
    return new THREE.Vector3(
      (c.x - originMc.x) / meterUnit,
      c.z / meterUnit,
      (c.y - originMc.y) / meterUnit
    );
  }

  function localMetersToLngLat(pos) {
    const mc = new window.maplibregl.MercatorCoordinate(
      originMc.x + pos.x * meterUnit,
      originMc.y + pos.z * meterUnit,
      0
    );
    const ll = mc.toLngLat();
    return [ll.lng, ll.lat];
  }

  /* ───────────────────────────────────────────────────────────
   * Dedicated Procedural Textures & Architectural Materials
   * ─────────────────────────────────────────────────────────── */
  function makeGridTileTex() {
    const c = document.createElement('canvas');
    c.width = 256;
    c.height = 128;
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#F3F6FA';
    ctx.fillRect(0, 0, 256, 128);
    ctx.strokeStyle = '#CBD5E1';
    ctx.lineWidth = 2;
    for (let x = 0; x <= 256; x += 32) {
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, 128); ctx.stroke();
    }
    for (let y = 0; y <= 128; y += 32) {
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(256, y); ctx.stroke();
    }
    const tex = new THREE.CanvasTexture(c);
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(5, 2);
    return tex;
  }

  function makeBallastSleeperTex() {
    // One 1.15m sleeper bay tiled seamlessly along the entire 47.7km twin track plinth
    const c = document.createElement('canvas');
    c.width = 256;
    c.height = 256;
    const ctx = c.getContext('2d');

    // Crushed granite ballast base
    ctx.fillStyle = '#B8B3A8';
    ctx.fillRect(0, 0, 256, 256);

    // Granite speckle grain (deterministic pattern)
    for (let i = 0; i < 650; i++) {
      const x = (i * 73) % 256;
      const y = (i * 137) % 256;
      ctx.fillStyle = i % 3 === 0 ? '#8C877C' : (i % 3 === 1 ? '#CFCAC0' : '#9E998E');
      ctx.fillRect(x, y, 3, 3);
    }

    // Center raised track sleeper bar (perpendicular across Y = track width)
    ctx.fillStyle = '#5C544B';
    ctx.fillRect(88, 18, 80, 220);
    ctx.fillStyle = '#71685E';
    ctx.fillRect(94, 22, 68, 212);

    // Chamfer shadow edges on sleeper
    ctx.fillStyle = '#3F3A34';
    ctx.fillRect(88, 18, 6, 220);
    ctx.fillRect(162, 18, 6, 220);

    // Twin steel Pandrol rail-clip fastener plates at rail positions (~20% and ~80%)
    ctx.fillStyle = '#94A3B8';
    ctx.fillRect(96, 36, 64, 24);
    ctx.fillRect(96, 196, 64, 24);
    ctx.fillStyle = '#CBD5E1';
    ctx.fillRect(108, 42, 40, 12);
    ctx.fillRect(108, 202, 40, 12);

    const tex = new THREE.CanvasTexture(c);
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.anisotropy = 8;
    return tex;
  }

  function makeBuildingWindowTex() {
    // Rich warm sandstone clay facade + crisp dark-slate window grid (Image-2 style, never washed white!)
    const c = document.createElement('canvas');
    c.width = 256;
    c.height = 256;
    const ctx = c.getContext('2d');

    ctx.fillStyle = '#C9C0B0';
    ctx.fillRect(0, 0, 256, 256);

    // Architectural concrete slab story bands
    ctx.fillStyle = '#B5AC9B';
    for (let y = 0; y < 256; y += 36) {
      ctx.fillRect(0, y, 256, 6);
    }

    // Crisp recessed dark-slate architectural windows
    for (let row = 0; row < 6; row++) {
      for (let col = 0; col < 6; col++) {
        const wx = 14 + col * 39;
        const wy = 14 + row * 38;
        ctx.fillStyle = '#334155';
        ctx.fillRect(wx, wy, 24, 20);
        ctx.fillStyle = '#64748B';
        ctx.fillRect(wx + 2, wy + 2, 20, 7);
      }
    }

    const tex = new THREE.CanvasTexture(c);
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    return tex;
  }

  function makeMapPIDSTex(stName) {
    const c = document.createElement('canvas');
    c.width = 512;
    c.height = 128;
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#0F172A';
    ctx.fillRect(0, 0, 512, 128);
    ctx.strokeStyle = '#334155';
    ctx.lineWidth = 4;
    ctx.strokeRect(4, 4, 504, 120);

    ctx.fillStyle = '#EAB308';
    ctx.fillRect(10, 10, 492, 26);
    ctx.fillStyle = '#0F172A';
    ctx.font = '800 17px -apple-system, Inter, sans-serif';
    ctx.textBaseline = 'middle';
    ctx.fillText(`${stName.toUpperCase()}  ·  LIVE PIDS`, 20, 23);

    ctx.fillStyle = '#FACC15';
    ctx.font = '700 22px "SF Mono", Menlo, monospace';
    ctx.fillText('P1  MILLENNIUM CITY CTR   01 MIN', 20, 64);
    ctx.fillStyle = '#BAE6FD';
    ctx.fillText('P2  SAMAYPUR BADLI        02 MIN', 20, 100);

    const tex = new THREE.CanvasTexture(c);
    tex.minFilter = THREE.LinearFilter;
    return tex;
  }

  function makeBilingualSignTex(hindiName, engName, subtitle, accentHex, secHex) {
    const c = document.createElement('canvas');
    c.width = 512;
    c.height = 112;
    const ctx = c.getContext('2d');

    ctx.fillStyle = '#0F172A';
    ctx.fillRect(0, 0, 512, 112);

    ctx.fillStyle = accentHex || '#EAB308';
    ctx.fillRect(0, 0, 512, 10);
    if (secHex) {
      ctx.fillStyle = secHex;
      ctx.fillRect(0, 102, 512, 10);
    }

    ctx.fillStyle = '#DC2626';
    ctx.beginPath();
    ctx.arc(48, 56, 26, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(19, 51, 58, 10);

    ctx.fillStyle = '#CBD5E1';
    ctx.font = '600 20px "Noto Sans Devanagari", -apple-system, sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(hindiName || engName, 92, 31);

    ctx.fillStyle = '#FFFFFF';
    ctx.font = '800 31px -apple-system, BlinkMacSystemFont, Inter, sans-serif';
    ctx.fillText(engName.toUpperCase(), 92, 64);

    ctx.fillStyle = '#94A3B8';
    ctx.font = '600 14px -apple-system, Inter, sans-serif';
    ctx.fillText(subtitle || 'DELHI METRO · YELLOW LINE', 92, 92);

    const tex = new THREE.CanvasTexture(c);
    tex.minFilter = THREE.LinearFilter;
    return tex;
  }

  function makeSoftShadowDiscTex() {
    const c = document.createElement('canvas');
    c.width = 128;
    c.height = 128;
    const ctx = c.getContext('2d');
    const g = ctx.createRadialGradient(64, 64, 4, 64, 64, 62);
    g.addColorStop(0.0, 'rgba(15, 23, 42, 0.56)');
    g.addColorStop(0.45, 'rgba(15, 23, 42, 0.24)');
    g.addColorStop(1.0, 'rgba(15, 23, 42, 0.0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 128, 128);
    const tex = new THREE.CanvasTexture(c);
    tex.minFilter = THREE.LinearFilter;
    return tex;
  }

  function makeWaterCausticImageData() {
    const N = 128;
    const c = document.createElement('canvas');
    c.width = N;
    c.height = N;
    const ctx = c.getContext('2d');
    const img = ctx.createImageData(N, N);
    const d = img.data;
    const TAU = Math.PI * 2;
    for (let y = 0; y < N; y++) {
      const ny = y / N;
      for (let x = 0; x < N; x++) {
        const nx = x / N;
        const w1 = Math.sin(TAU * (nx * 3 + ny * 2));
        const w2 = Math.sin(TAU * (nx * 5 - ny * 4 + 0.3));
        const w3 = Math.cos(TAU * (nx * 2 + ny * 6 - 0.15));
        const ridge = Math.pow(Math.max(0, 1.0 - Math.abs(w1 * 0.45 + w2 * 0.35 + w3 * 0.25)), 3.2);
        const idx = (y * N + x) * 4;
        d[idx] = 240;
        d[idx + 1] = 250;
        d[idx + 2] = 255;
        d[idx + 3] = Math.min(220, Math.round(ridge * 205));
      }
    }
    return { width: N, height: N, data: new Uint8Array(d.buffer) };
  }

  function makeHeadlightBeamTex() {
    const c = document.createElement('canvas');
    c.width = 128;
    c.height = 64;
    const ctx = c.getContext('2d');
    const grad = ctx.createLinearGradient(128, 32, 0, 32);
    grad.addColorStop(0.0, 'rgba(254, 249, 195, 0.92)');
    grad.addColorStop(0.35, 'rgba(254, 240, 138, 0.42)');
    grad.addColorStop(1.0, 'rgba(254, 240, 138, 0.0)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.moveTo(128, 25);
    ctx.lineTo(128, 39);
    ctx.lineTo(0, 62);
    ctx.lineTo(0, 2);
    ctx.closePath();
    ctx.fill();
    const tex = new THREE.CanvasTexture(c);
    tex.minFilter = THREE.LinearFilter;
    return tex;
  }

  function getMaterials() {
    if (matLib) return matLib;
    const std = (hex, opts) => {
      const mOpts = opts || {};
      const defaultEnv = (mOpts.metalness && mOpts.metalness > 0.15) ? 0.55 : 0.22;
      return new THREE.MeshStandardMaterial(Object.assign({
        color: hex, roughness: 0.78, metalness: 0.04, envMapIntensity: defaultEnv
      }, mOpts));
    };
    const lam = (hex, opts) => new THREE.MeshLambertMaterial(Object.assign({ color: hex }, opts || {}));

    trainBeamMat = new THREE.MeshBasicMaterial({
      map: makeHeadlightBeamTex(),
      transparent: true,
      opacity: 0.0,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.DoubleSide
    });

    matLib = {
      concreteLight: lam(0xDED9CE),
      concreteWeb: lam(0xC2BCB0),
      pierCream: lam(0xD8D2C5),
      terrazzoDeck: lam(0xEAE5D9),
      trenchFloor: lam(0xCBD5E1),
      slateDark: lam(0x1E293B),
      slateCut: lam(0x475569),
      plazaPave: lam(0xD2C9B8),
      sagePark: lam(0xADD096),
      asphaltRoad: lam(0x94A3B8),
      crosswalkWhite: lam(0xF8FAFC),
      steelDark: std(0x334155, { roughness: 0.42, metalness: 0.54 }),
      steelChrome: std(0xCBD5E1, { roughness: 0.28, metalness: 0.68 }),
      railWeb: std(0x475569, { roughness: 0.40, metalness: 0.68 }),
      railCrown: std(0xE2E8F0, { roughness: 0.22, metalness: 0.80 }),
      railTieWood: lam(0x5B5146),
      ballastSleeper: lam(0xFFFFFF, { map: makeBallastSleeperTex() }),
      buildingFacade: lam(0xFFFFFF, { map: makeBuildingWindowTex() }),
      buildingSand: lam(0xEDE6DA, { map: makeBuildingWindowTex() }),
      buildingGlass: std(0xC6D2DC, { map: makeBuildingWindowTex(), roughness: 0.58, metalness: 0.16 }),
      qutabRedStone: lam(0xB85C3C),
      sandstoneBuff: lam(0xE2CCB0),
      brickRed: lam(0xA44A3F),
      lutyensCream: lam(0xF3EAD8),
      terracotta: lam(0xC96F4B),
      cyberTeal: std(0x0EA5E9, { roughness: 0.20, metalness: 0.35, transparent: true, opacity: 0.56, envMapIntensity: 0.48 }),
      bufferRed: std(0xDC2626, { roughness: 0.45, metalness: 0.25 }),
      whiteMarble: std(0xF7F5EE, { roughness: 0.52, metalness: 0.04, envMapIntensity: 0.28 }),
      bronzeStatue: std(0x3B342E, { roughness: 0.44, metalness: 0.62, envMapIntensity: 0.35 }),
      brassGold: std(0xEAB308, { roughness: 0.26, metalness: 0.78, envMapIntensity: 0.45 }),
      treeFoliageDeep: lam(0x497A44),
      treeFoliageMid: lam(0x5C8F52),
      treeFoliageBright: lam(0x70A362),
      treeFoliageAshok: lam(0x376636),
      xrayTubeShell: new THREE.MeshBasicMaterial({
        color: 0x38BDF8,
        transparent: true,
        opacity: 0.28,
        depthWrite: false,
        side: THREE.DoubleSide
      }),
      subwayCutawayGlass: new THREE.MeshBasicMaterial({
        color: 0x38BDF8,
        transparent: true,
        opacity: 0.11,
        depthWrite: false,
        side: THREE.DoubleSide
      }),
      xrayTubeRail: new THREE.MeshBasicMaterial({
        color: 0xFACC15,
        transparent: true,
        opacity: 0.85,
        depthWrite: false
      }),
      shadowDisc: new THREE.MeshBasicMaterial({
        map: makeSoftShadowDiscTex(),
        transparent: true,
        opacity: 0.42,
        depthWrite: false,
        side: THREE.DoubleSide
      }),
      viaductShadow: new THREE.MeshBasicMaterial({
        color: 0x0F172A,
        transparent: true,
        opacity: 0.14,
        depthWrite: false,
        side: THREE.DoubleSide
      }),
      groundShadowCatcher: new THREE.ShadowMaterial({ opacity: 0.22 }),
      lampGlow: new THREE.MeshBasicMaterial({ color: 0xFEF08A }),
      tactileYellow: std(0xFACC15, { emissive: 0xCA8A04, emissiveIntensity: 0.25, roughness: 0.44 }),
      yellowAccent: new THREE.MeshBasicMaterial({ color: 0xEAB308 }),
      tactileBlue: std(0x2563EB, { emissive: 0x1D4ED8, emissiveIntensity: 0.25, roughness: 0.44 }),
      blueAccent: new THREE.MeshBasicMaterial({ color: 0x2563EB }),
      dmrcBlueRoof: std(0x0284C7, { roughness: 0.34, metalness: 0.22, envMapIntensity: 0.36, side: THREE.DoubleSide }),
      redRoof: std(0xB9382E, { roughness: 0.48, metalness: 0.16, envMapIntensity: 0.28, side: THREE.DoubleSide }),
      skylightGlass: new THREE.MeshBasicMaterial({ color: 0xBAE6FD, transparent: true, opacity: 0.42, side: THREE.DoubleSide }),
      concourseGlass: std(0x38BDF8, { transparent: true, opacity: 0.44, roughness: 0.14, metalness: 0.18, envMapIntensity: 0.45 }),
      glassBarrier: std(0xBAE6FD, { transparent: true, opacity: 0.46, roughness: 0.14, metalness: 0.16, envMapIntensity: 0.45 }),
      roundelRed: std(0xDC2626, { emissive: 0x991B1B, emissiveIntensity: 0.28, roughness: 0.42 }),
      afcFlap: std(0xEF4444, { transparent: true, opacity: 0.78 }),
      ledGreen: new THREE.MeshBasicMaterial({ color: 0x22C55E }),
      pidsHousing: lam(0x0F172A),
      placeholderSign: new THREE.MeshBasicMaterial({ color: 0x0F172A }),
      luminaireGlow: new THREE.MeshBasicMaterial({ color: 0xFEF9C3 }),
      tileWall: lam(0xFFFFFF, { map: makeGridTileTex() }),
      treeFoliage: lam(0x588A4F),
      treeFoliageAlt: lam(0x6B9D5E),
      treeTrunk: lam(0x6B4F3A),
      escStep: std(0x475569, { roughness: 0.55, metalness: 0.22 }),
      escGlass: std(0xA7F3D0, { transparent: true, opacity: 0.46, roughness: 0.16 }),
      commuterSkin: lam(0xD99B78),
      commuterShirts: [
        lam(0x2563EB),
        lam(0xE11D48),
        lam(0xF59E0B),
        lam(0x0D9488),
        lam(0x6366F1),
        lam(0x475569)
      ]
    };
    return matLib;
  }

  function createMergedPartsGeo(parts) {
    const nonIdx = parts.map((p) => (p.index ? p.toNonIndexed() : p));
    let totalFloats = 0;
    nonIdx.forEach((p) => { totalFloats += p.attributes.position.array.length; });
    const posArr = new Float32Array(totalFloats);
    const normArr = new Float32Array(totalFloats);
    let offset = 0;
    nonIdx.forEach((p) => {
      const pa = p.attributes.position.array;
      const na = p.attributes.normal.array;
      posArr.set(pa, offset);
      normArr.set(na, offset);
      offset += pa.length;
      p.dispose();
    });
    const merged = new THREE.BufferGeometry();
    merged.setAttribute('position', new THREE.BufferAttribute(posArr, 3));
    merged.setAttribute('normal', new THREE.BufferAttribute(normArr, 3));
    return merged;
  }

  function createOrganicTreeCrownGeo() {
    // Merge 5 asymmetric foliage clusters into 1 sculpted Neem/Banyan crown BufferGeometry (1 draw call!)
    const lobes = [
      { r: 1.44, x: 0.0, y: 0.55, z: 0.0, sx: 1.12, sy: 0.88, sz: 1.06, ry: 0.2 },
      { r: 1.15, x: -0.98, y: -0.18, z: 0.56, sx: 1.08, sy: 0.85, sz: 1.04, ry: 1.1 },
      { r: 1.10, x: 0.92, y: -0.10, z: -0.52, sx: 1.04, sy: 0.88, sz: 1.12, ry: 2.3 },
      { r: 0.96, x: 0.42, y: 0.12, z: 0.92, sx: 1.02, sy: 0.86, sz: 0.98, ry: 0.9 },
      { r: 0.88, x: -0.45, y: 0.88, z: -0.42, sx: 1.00, sy: 0.92, sz: 1.02, ry: 1.8 }
    ];
    const treeDetail = isMobileProfile() ? 0 : 1;
    const parts = lobes.map((lb) => {
      const g = new THREE.IcosahedronGeometry(lb.r, treeDetail);
      g.rotateY(lb.ry);
      g.scale(lb.sx, lb.sy, lb.sz);
      g.translate(lb.x, lb.y, lb.z);
      return g;
    });
    return createMergedPartsGeo(parts);
  }

  function createAshokColumnGeo() {
    // Slender columnar Indian Ashok tree silhouette (3 overlapping tapered cones)
    const tiers = [
      { rb: 1.12, rt: 0.35, h: 2.9, y: -0.6 },
      { rb: 0.94, rt: 0.24, h: 2.7, y: 1.2 },
      { rb: 0.68, rt: 0.06, h: 2.5, y: 2.8 }
    ];
    const parts = tiers.map((t, idx) => {
      const c = new THREE.CylinderGeometry(t.rt, t.rb, t.h, 8);
      c.rotateY(idx * 0.4);
      c.translate(0, t.y, 0);
      return c;
    });
    return createMergedPartsGeo(parts);
  }

  function getSharedStationGeos() {
    if (sharedGeos) return sharedGeos;
    const archR = 16.8;
    const arcSpan = Math.PI * 0.58;
    const arcStart = (Math.PI - arcSpan) / 2;
    const shadowQuad = new THREE.PlaneGeometry(1, 1);
    shadowQuad.rotateX(-Math.PI / 2);
    const beamQuad = new THREE.PlaneGeometry(24, 6.2);
    beamQuad.rotateX(-Math.PI / 2);

    sharedGeos = {
      box1: new THREE.BoxGeometry(1, 1, 1),
      cyl1: new THREE.CylinderGeometry(1, 1, 1, 12),
      shadowQuad,
      beamQuad,
      pierShaft: new THREE.CylinderGeometry(1.35, 1.72, 1, 14),
      tbmArch: new THREE.CylinderGeometry(3.4, 3.4, 5.2, 16, 1, true, 0, Math.PI),
      tbmBore: new THREE.CylinderGeometry(2.9, 2.9, 5.4, 14, 1, false, 0, Math.PI),
      tbmRib: new THREE.TorusGeometry(3.4, 0.24, 6, 16, Math.PI),
      canopySkylight: new THREE.CylinderGeometry(archR + 0.12, archR + 0.12, 82, 22, 1, true, arcStart, arcSpan),
      canopyBay: new THREE.CylinderGeometry(archR + 0.34, archR + 0.34, 17.5, 22, 1, true, arcStart, arcSpan),
      canopyRib: new THREE.TorusGeometry(archR, 0.28, 6, 18, arcSpan),
      treeCrown: createOrganicTreeCrownGeo(),
      ashokCrown: createAshokColumnGeo(),
      commuterBody: new THREE.BoxGeometry(0.62, 1.45, 0.46),
      commuterHead: new THREE.SphereGeometry(0.28, 8, 6),
      haloRing: new THREE.RingGeometry(21.5, 22.8, 48),
      roundelCyl: new THREE.CylinderGeometry(1.0, 1.0, 0.45, 18),
      archR,
      arcStart,
      arcSpan
    };
    return sharedGeos;
  }

  function addBox(parent, w, h, d, mat, x, y, z) {
    const m = new THREE.Mesh(getSharedStationGeos().box1, mat);
    m.scale.set(w, h, d);
    m.position.set(x, y, z);
    m.frustumCulled = false;
    m.castShadow = true;
    m.receiveShadow = true;
    parent.add(m);
    return m;
  }

  /* ───────────────────────────────────────────────────────────
   * 1. Continuous Yellow Line Data + Arc-Length Curve
   * ─────────────────────────────────────────────────────────── */
  function hermiteSmooth(t) {
    const c = Math.max(0, Math.min(1, t));
    return c * c * (3 - 2 * c);
  }

  function buildCorridorCurve(osmData, topoData, svcData, lineKey = 'yellow') {
    const isYellow = lineKey === 'yellow';
    const isBlueVaishali = lineKey === 'blue-vaishali';
    const topoLineKey = isYellow ? 'yellow-line' : 'blue-line';
    const lineId = isYellow ? 'yellow' : (isBlueVaishali ? 'blue-vaishali' : 'blue');
    const lineName = isYellow ? 'Yellow Line (Line 2)' : (isBlueVaishali ? 'Blue Line (Vaishali Branch)' : 'Blue Line (Line 3/4)');
    const lineColorNum = isYellow ? 0xEAB308 : 0x2563EB;
    const lineColorHex = isYellow ? '#EAB308' : '#2563EB';

    const rawCoords = osmData.centerline;
    const nTotal = rawCoords.length;
    const raw2D = rawCoords.map((c) => toLocalMeters(c, 0));
    const densePts = [];

    if (isYellow) {
      const pSouthIdx = 229;
      const rampSouthEndIdx = 237;

      for (let i = 0; i < nTotal; i++) {
        const p = raw2D[i];
        let elev = VIADUCT_Y;
        if (i <= 109) {
          elev = VIADUCT_Y;
        } else if (i >= 111 && i <= pSouthIdx) {
          elev = SUBWAY_Y;
        } else if (i === 110) {
          const pPrev = raw2D[109];
          const flatEnd = new THREE.Vector3().lerpVectors(pPrev, p, 0.28);
          densePts.push(new THREE.Vector3(flatEnd.x, VIADUCT_Y, flatEnd.z));
          elev = VIADUCT_Y - (VIADUCT_Y - SUBWAY_Y) * 0.72;
        } else if (i > pSouthIdx && i < rampSouthEndIdx) {
          const u = (i - pSouthIdx) / (rampSouthEndIdx - pSouthIdx);
          elev = SUBWAY_Y + (VIADUCT_Y - SUBWAY_Y) * hermiteSmooth(u);
        } else {
          elev = VIADUCT_Y;
        }
        const cur3D = new THREE.Vector3(p.x, elev, p.z);

        if (densePts.length > 0) {
          const prev3D = densePts[densePts.length - 1];
          const segD = prev3D.distanceTo(cur3D);
          if (segD > 85) {
            const steps = Math.min(8, Math.ceil(segD / 70));
            for (let s = 1; s < steps; s++) {
              const f = s / steps;
              const interp = new THREE.Vector3().lerpVectors(prev3D, cur3D, f);
              if (i === 111 || i === 110) {
                interp.y = prev3D.y + (cur3D.y - prev3D.y) * hermiteSmooth(f);
              }
              densePts.push(interp);
            }
          }
        }
        densePts.push(cur3D);
      }
    } else if (isBlueVaishali) {
      // ───────────────────────────────────────────────────────────
      // Vaishali Branch (Line 4 — aligned to OSM src[2].0/.4 -> src[4].2/.3):
      // Node 0..5: Yamuna Bank north platform bay -> east throat (elev = 1.2m)
      // Node 6..8: Rises gently to 3.8m over the (368, -180) layer=-1 underpass
      // Node 9..15: Smoothly climbs onto East Delhi viaduct (17.5m) over Noida Link Rd
      // Node 16..end: Standard viaduct height (VIADUCT_Y = 17.5m)
      // ───────────────────────────────────────────────────────────
      const rampCrossStart = 5;
      const rampCrossEnd = 8;
      const rampViaductEnd = 15;
      for (let i = 0; i < nTotal; i++) {
        const p = raw2D[i];
        let elev = VIADUCT_Y;
        if (i <= rampCrossStart) {
          elev = 1.2;
        } else if (i > rampCrossStart && i <= rampCrossEnd) {
          const u = (i - rampCrossStart) / (rampCrossEnd - rampCrossStart);
          elev = 1.2 + (6.4 - 1.2) * hermiteSmooth(u);
        } else if (i > rampCrossEnd && i <= rampViaductEnd) {
          const u = (i - rampCrossEnd) / (rampViaductEnd - rampCrossEnd);
          elev = 6.4 + (VIADUCT_Y - 6.4) * hermiteSmooth(u);
        } else {
          elev = VIADUCT_Y;
        }
        const cur3D = new THREE.Vector3(p.x, elev, p.z);

        if (densePts.length > 0) {
          const prev3D = densePts[densePts.length - 1];
          const segD = prev3D.distanceTo(cur3D);
          if (segD > 85) {
            const steps = Math.min(8, Math.ceil(segD / 70));
            for (let s = 1; s < steps; s++) {
              const f = s / steps;
              const interp = new THREE.Vector3().lerpVectors(prev3D, cur3D, f);
              densePts.push(interp);
            }
          }
        }
        densePts.push(cur3D);
      }
    } else {
      // Blue Line 3D elevation profile:
      // Dwarka Sector - 21 underground terminus & portal transition:
      //   - Node 0 to 5: SUBWAY_Y = 0.28m (Dwarka Sec 21 subterranean station & underpass)
      //   - Node 5 to 12: ramp up from SUBWAY_Y (0.28m) to VIADUCT_Y (17.5m)
      // West viaduct: 12 to 292 (VIADUCT_Y = 17.5m)
      // West ramp down: 292 to 299 (smooth Hermite to SUBWAY_Y = 0.28m)
      // Central underground + Rajiv Chowk Dual-Level Cruciform Bridge (node 305):
      //   - Ramp up nodes 300 -> 304 (SUBWAY_Y 0.28m -> 6.8m)
      //   - Flat Rajiv Chowk upper bridge deck nodes 304 -> 306 (6.8m, clears lower Yellow trains)
      //   - Ramp down nodes 306 -> 310 (6.8m -> SUBWAY_Y 0.28m)
      //   - Barakhamba & Mandi House underground: 310 to 322 (SUBWAY_Y = 0.28m)
      // East ramp up: 323 to 329 (smooth Hermite to VIADUCT_Y = 17.5m)
      // East viaduct & Yamuna River Bridge: 330 to 347 (VIADUCT_Y = 17.5m)
      // Yamuna Bank riverfront descent: 347 to 350 (-944m..-647m beside west depot throat)
      // Yamuna Bank At-Grade Station & 700m Depot: 351 to 361 (elev = 1.2m)
      // Akshardham / Noida Link Rd (709B) overpass ramp: 362 to 366 (elev 1.2m -> 17.5m)
      // East viaduct to Noida Electronic City: 367 to end (VIADUCT_Y = 17.5m)
      const d21UnderEnd = 5;
      const d21RampEnd = 12;
      const rampWStart = 292;
      const rampWEnd = 299;
      const rcUpStart = 300;
      const rcUpEnd = 304;
      const rcDownStart = 306;
      const rcDownEnd = 310;
      const rampEStart = 323;
      const rampEEnd = 329;
      const ybDownStart = 347;
      const ybDownEnd = 350;
      const ybUpStart = 362;
      const ybUpEnd = 366;
      const BLUE_RC_Y = 7.6;

      const blueElevAt = (idxF) => {
        if (idxF <= d21UnderEnd) return SUBWAY_Y;
        if (idxF <= d21RampEnd) {
          return SUBWAY_Y + (VIADUCT_Y - SUBWAY_Y) * hermiteSmooth((idxF - d21UnderEnd) / (d21RampEnd - d21UnderEnd));
        }
        if (idxF < rampWStart) return VIADUCT_Y;
        if (idxF <= rampWEnd) {
          return VIADUCT_Y - (VIADUCT_Y - SUBWAY_Y) * hermiteSmooth((idxF - rampWStart) / (rampWEnd - rampWStart));
        }
        if (idxF < rcUpStart) return SUBWAY_Y;
        if (idxF <= rcUpEnd) {
          return SUBWAY_Y + (BLUE_RC_Y - SUBWAY_Y) * hermiteSmooth((idxF - rcUpStart) / (rcUpEnd - rcUpStart));
        }
        if (idxF <= rcDownStart) return BLUE_RC_Y;
        if (idxF <= rcDownEnd) {
          return BLUE_RC_Y - (BLUE_RC_Y - SUBWAY_Y) * hermiteSmooth((idxF - rcDownStart) / (rcDownEnd - rcDownStart));
        }
        if (idxF < rampEStart) return SUBWAY_Y;
        if (idxF <= rampEEnd) {
          return SUBWAY_Y + (VIADUCT_Y - SUBWAY_Y) * hermiteSmooth((idxF - rampEStart) / (rampEEnd - rampEStart));
        }
        if (idxF < ybDownStart) return VIADUCT_Y;
        if (idxF <= ybDownEnd) {
          return VIADUCT_Y - (VIADUCT_Y - 1.2) * hermiteSmooth((idxF - ybDownStart) / (ybDownEnd - ybDownStart));
        }
        if (idxF < ybUpStart) return 1.2;
        if (idxF <= ybUpEnd) {
          return 1.2 + (VIADUCT_Y - 1.2) * hermiteSmooth((idxF - ybUpStart) / (ybUpEnd - ybUpStart));
        }
        return VIADUCT_Y;
      };

      for (let i = 0; i < nTotal; i++) {
        const p = raw2D[i];
        const elev = blueElevAt(i);
        const cur3D = new THREE.Vector3(p.x, elev, p.z);

        if (densePts.length > 0 && i > 0) {
          const prev3D = densePts[densePts.length - 1];
          const segD = prev3D.distanceTo(cur3D);
          if (segD > 85) {
            const steps = Math.min(8, Math.ceil(segD / 70));
            for (let s = 1; s < steps; s++) {
              const f = s / steps;
              const interp = new THREE.Vector3().lerpVectors(prev3D, cur3D, f);
              interp.y = blueElevAt((i - 1) + f);
              densePts.push(interp);
            }
          }
        }
        densePts.push(cur3D);
      }
    }

    const curve = new THREE.CatmullRomCurve3(densePts, false, 'centripetal', 0.25);
    const approxLen = curve.getLength();
    const numSamples = Math.max(2400, Math.ceil(approxLen / 10));
    const spaced = curve.getSpacedPoints(numSamples);

    const cSamples = [];
    let accDist = 0;
    for (let i = 0; i < spaced.length; i++) {
      const pos = spaced[i];
      if (i > 0) accDist += pos.distanceTo(spaced[i - 1]);
      const pA = spaced[Math.max(0, i - 1)];
      const pB = spaced[Math.min(spaced.length - 1, i + 1)];
      const tan = new THREE.Vector3().subVectors(pB, pA).normalize();
      const y = pos.y;
      let zone = 'tunnel';
      if (y > VIADUCT_Y - 0.35) {
        zone = isYellow ? (pos.z > 0 ? 'elevNorth' : 'elevSouth') : (pos.x < 0 ? 'elevWest' : 'elevEast');
      } else if (y > SUBWAY_Y + 0.35) {
        zone = isYellow ? (pos.z > 0 ? 'rampNorth' : 'rampSouth') : (pos.x < 0 ? 'rampWest' : 'rampEast');
      }
      cSamples.push({ dist: accDist, pos, tan, elev: y, zone });
    }
    const cTotalLen = accDist;

    function sampleAtCorridorDist(distM) {
      if (!cSamples.length || cTotalLen <= 0) return null;
      const clamped = Math.max(0, Math.min(cTotalLen, distM));
      let lo = 0;
      let hi = cSamples.length - 2;
      while (lo < hi) {
        const mid = (lo + hi + 1) >> 1;
        if (cSamples[mid].dist <= clamped) lo = mid;
        else hi = mid - 1;
      }
      const a = cSamples[lo];
      const b = cSamples[lo + 1];
      const span = Math.max(1e-6, b.dist - a.dist);
      const alpha = Math.max(0, Math.min(1, (clamped - a.dist) / span));
      return {
        dist: clamped,
        pos: new THREE.Vector3().lerpVectors(a.pos, b.pos, alpha),
        tan: new THREE.Vector3().lerpVectors(a.tan, b.tan, alpha).normalize(),
        elev: a.elev + (b.elev - a.elev) * alpha,
        zone: alpha < 0.5 ? a.zone : b.zone
      };
    }

    const cFastProxy = {
      getPointAt(u, optionalTarget) {
        const smp = sampleAtCorridorDist(Math.max(0, Math.min(1, u)) * cTotalLen);
        const out = optionalTarget || new THREE.Vector3();
        return smp ? out.copy(smp.pos) : out;
      },
      getTangentAt(u, optionalTarget) {
        const smp = sampleAtCorridorDist(Math.max(0, Math.min(1, u)) * cTotalLen);
        const out = optionalTarget || new THREE.Vector3();
        return smp ? out.copy(smp.tan) : out;
      }
    };

    const topoLookup = new Map();
    if (topoData && Array.isArray(topoData.stations)) {
      topoData.stations.forEach((s) => {
        if (s.line === topoLineKey || (!s.line && isYellow)) topoLookup.set(normalizeStationName(s.name), s);
      });
    }
    const svcLookup = new Map();
    if (svcData && Array.isArray(svcData.stations)) {
      svcData.stations.forEach((s) => {
        svcLookup.set(normalizeStationName(s.name), s);
      });
    }

    const cStationsData = osmData.stations.map((st, idx) => {
      const key = normalizeStationName(st.name);
      const meta = topoLookup.get(key) || {};
      const svc = svcLookup.get(key) || {};
      const stLocal = toLocalMeters(st.coords, 0);
      let bestDist = 0;
      let minD2 = Infinity;
      for (let i = 0; i < cSamples.length; i++) {
        const sp = cSamples[i].pos;
        const d2 = (sp.x - stLocal.x) ** 2 + (sp.z - stLocal.z) ** 2;
        if (d2 < minD2) {
          minD2 = d2;
          bestDist = cSamples[i].dist;
        }
      }
      const smpA = sampleAtCorridorDist(Math.max(0, bestDist - 32));
      const smpB = sampleAtCorridorDist(Math.min(cTotalLen, bestDist + 32));
      const chordTan = new THREE.Vector3().subVectors(smpB.pos, smpA.pos);
      chordTan.y = 0;
      chordTan.normalize();
      const smpCenter = sampleAtCorridorDist(bestDist);

      const svcInts = Array.isArray(svc.interchanges) ? svc.interchanges : [];
      const metaInts = Array.isArray(meta.interchanges) ? meta.interchanges : [];
      const mergedInts = svcInts.length ? svcInts : (metaInts.length ? metaInts : (st.interchanges || []));
      const mergedIntStr = meta.interchange || (svcInts.length ? svcInts.join(' · ') : null) || st.interchange || null;

      return Object.assign({}, meta, svc, st, {
        lineId,
        lineKey,
        isYellow,
        isBlue: !isYellow,
        lineName,
        lineColorHex,
        lineColorNum,
        name: st.name,
        seqIndex: idx,
        dist: bestDist,
        pos: smpCenter.pos.clone(),
        tan: chordTan,
        hindi: HINDI_STATION_NAMES[st.name] || st.name,
        elevM: svc.elevM !== undefined ? svc.elevM : (meta.elevM !== undefined ? meta.elevM : st.elevM),
        major: !!(st.major || svc.major || meta.major || mergedIntStr || mergedInts.length),
        terminus: !!(st.terminus || svc.isTerminal || meta.terminus),
        interchange: mergedIntStr,
        interchanges: mergedInts
      });
    });

    const cPortalDists = [];
    const portalSources = isYellow
      ? [osmData.portalNorth, osmData.portalSouth].filter(Boolean)
      : [osmData.portalDwarka, osmData.portalWest, osmData.portalEast].filter(Boolean);

    const cPortalCoords = portalSources.map((pc) => {
      const pl = toLocalMeters(pc, 0);
      let bestD = 0;
      let md2 = Infinity;
      for (let i = 0; i < cSamples.length; i++) {
        const sp = cSamples[i].pos;
        const d2 = (sp.x - pl.x) ** 2 + (sp.z - pl.z) ** 2;
        if (d2 < md2) { md2 = d2; bestD = cSamples[i].dist; }
      }
      cPortalDists.push(bestD);
      return sampleAtCorridorDist(bestD);
    });

    const corridorObj = {
      id: lineId,
      lineId,
      name: lineName,
      lineKey,
      isYellow,
      isBlue: !isYellow,
      colorNum: lineColorNum,
      colorHex: lineColorHex,
      samples: cSamples,
      totalLen: cTotalLen,
      fastCurveProxy: cFastProxy,
      sampleAtDist: sampleAtCorridorDist,
      stationsData: cStationsData,
      portalDists: cPortalDists,
      portalCoords: cPortalCoords,
      group: new THREE.Group(),
      subwayGroup: null,
      xrayGroup: null,
      fleetTrains: []
    };

    cStationsData.forEach((st) => { st.corridor = corridorObj; });
    return corridorObj;
  }

  function sampleAtDist(distM, corridor = null) {
    const corr = corridor || activeWalkCorridor || ((activeLineId === 'blue' || activeLineId === 'blue-line') ? blueCorridor : yellowCorridor) || yellowCorridor;
    const targetSamples = corr ? corr.samples : samples;
    const targetLen = corr ? corr.totalLen : totalLen;
    if (!targetSamples.length || targetLen <= 0) return null;
    const clamped = Math.max(0, Math.min(targetLen, distM));
    let lo = 0;
    let hi = targetSamples.length - 2;
    while (lo < hi) {
      const mid = (lo + hi + 1) >> 1;
      if (targetSamples[mid].dist <= clamped) lo = mid;
      else hi = mid - 1;
    }
    const a = targetSamples[lo];
    const b = targetSamples[lo + 1];
    const span = Math.max(1e-6, b.dist - a.dist);
    const alpha = Math.max(0, Math.min(1, (clamped - a.dist) / span));
    return {
      dist: clamped,
      pos: new THREE.Vector3().lerpVectors(a.pos, b.pos, alpha),
      tan: new THREE.Vector3().lerpVectors(a.tan, b.tan, alpha).normalize(),
      elev: a.elev + (b.elev - a.elev) * alpha,
      zone: alpha < 0.5 ? a.zone : b.zone
    };
  }

  /* ───────────────────────────────────────────────────────────
   * 2. Textured Ballast/Sleepers, 3D Steel Rails, Viaduct & Trench
   * ─────────────────────────────────────────────────────────── */
  function buildRibbonFromSpans(spanList, profilePts, material, repeatM = 1.15, castShadow = true) {
    if (!spanList || !spanList.length) return null;
    const nProf = profilePts.length;
    const positions = [];
    const normals = [];
    const uvs = [];
    const indices = [];
    const up = new THREE.Vector3(0, 1, 0);
    let vCount = 0;

    for (let spIdx = 0; spIdx < spanList.length; spIdx++) {
      const segSamples = spanList[spIdx];
      if (!segSamples || segSamples.length < 2) continue;
      const ringFrames = [];
      for (let i = 0; i < segSamples.length; i++) {
        const s = segSamples[i];
        const tan = s.tan;
        const right = new THREE.Vector3().crossVectors(tan, up).normalize();
        right.y = 0;
        if (right.lengthSq() < 1e-6) right.set(0, 0, 1);
        right.normalize();
        ringFrames.push({ p: s.pos, dist: s.dist, right, up });
      }
      for (let i = 0; i < ringFrames.length - 1; i++) {
        const f0 = ringFrames[i];
        const f1 = ringFrames[i + 1];
        const u0 = f0.dist / repeatM;
        const u1 = f1.dist / repeatM;

        for (let e = 0; e < nProf; e++) {
          const [latA, yA] = profilePts[e];
          const [latB, yB] = profilePts[(e + 1) % nProf];

          const dLat = latB - latA;
          const dY = yB - yA;
          const nLen = Math.hypot(dLat, dY) || 1;
          const nLat = dY / nLen;
          const nY = -dLat / nLen;

          const a0 = new THREE.Vector3().copy(f0.p).addScaledVector(f0.right, latA).addScaledVector(f0.up, yA);
          const b0 = new THREE.Vector3().copy(f0.p).addScaledVector(f0.right, latB).addScaledVector(f0.up, yB);
          const a1 = new THREE.Vector3().copy(f1.p).addScaledVector(f1.right, latA).addScaledVector(f1.up, yA);
          const b1 = new THREE.Vector3().copy(f1.p).addScaledVector(f1.right, latB).addScaledVector(f1.up, yB);

          const nrm0 = new THREE.Vector3().addScaledVector(f0.right, nLat).addScaledVector(f0.up, nY).normalize();
          const nrm1 = new THREE.Vector3().addScaledVector(f1.right, nLat).addScaledVector(f1.up, nY).normalize();

          positions.push(
            a0.x, a0.y, a0.z,
            b0.x, b0.y, b0.z,
            b1.x, b1.y, b1.z,
            a1.x, a1.y, a1.z
          );
          normals.push(
            nrm0.x, nrm0.y, nrm0.z,
            nrm0.x, nrm0.y, nrm0.z,
            nrm1.x, nrm1.y, nrm1.z,
            nrm1.x, nrm1.y, nrm1.z
          );
          uvs.push(u0, 0, u0, 1, u1, 1, u1, 0);
          indices.push(vCount, vCount + 1, vCount + 2, vCount, vCount + 2, vCount + 3);
          vCount += 4;
        }
      }
    }

    if (!positions.length) return null;
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geo.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    geo.setIndex(indices);
    const mesh = new THREE.Mesh(geo, material);
    mesh.frustumCulled = false;
    mesh.castShadow = castShadow;
    mesh.receiveShadow = true;
    return mesh;
  }

  function buildRibbonFromSamples(segSamples, profilePts, material, repeatM = 1.15) {
    if (!segSamples || segSamples.length < 2) return null;
    return buildRibbonFromSpans([segSamples], profilePts, material, repeatM, true);
  }

  function extractSpans(predicate, bridgeOverlap = false, targetSamples = null) {
    const smps = targetSamples || samples;
    const spans = [];
    let cur = [];
    for (let i = 0; i < smps.length; i++) {
      if (predicate(smps[i])) {
        if (bridgeOverlap && cur.length === 0 && i > 0) cur.push(smps[i - 1]);
        cur.push(smps[i]);
      } else if (cur.length > 0) {
        if (bridgeOverlap) cur.push(smps[i]);
        if (cur.length > 1) spans.push(cur);
        cur = [];
      }
    }
    if (cur.length > 1) spans.push(cur);
    return spans;
  }

  function buildTrackInfrastructure(parent, portalCoords, corridor = null) {
    const m = getMaterials();
    const g = getSharedStationGeos();
    const c = corridor || yellowCorridor;
    const cSamples = c ? c.samples : samples;
    const cStations = c ? c.stationsData : stationsData;
    const cLen = c ? c.totalLen : totalLen;
    const isBlue = Boolean(c && (c.isBlue || c.lineId === 'blue' || c.lineKey === 'blue'));
    const spineMat = isBlue ? m.tactileBlue : m.tactileYellow;
    const guideMat = isBlue ? m.blueAccent : m.yellowAccent;

    // 1. Elevated Box-Girder Viaduct & Transition Ramps (smooth watertight bridge spans)
    const viaductDeckProf = [
      [-6.8, 0.0], [-6.8, -0.85], [-3.6, -2.55], [3.6, -2.55], [6.8, -0.85], [6.8, 0.0]
    ];
    const parapetLProf = [[-6.75, 0.0], [-6.20, 0.0], [-6.20, 1.05], [-6.75, 1.05]];
    const parapetRProf = [[6.20, 0.0], [6.75, 0.0], [6.75, 1.05], [6.20, 1.05]];
    const lineSpineProf = [[-0.28, 0.0], [0.28, 0.0], [0.28, 0.45], [-0.28, 0.45]];

    const isNearRajivBlueRamp = (s) => Boolean(
      isBlue && cStations && cStations.some((st) => st.name === 'Rajiv Chowk' && Math.abs(st.dist - s.dist) <= 460)
    );
    const isInsideRajivBridge = (s) => Boolean(
      isBlue && cStations && cStations.some((st) => st.name === 'Rajiv Chowk' && Math.abs(st.dist - s.dist) <= 55)
    );
    const elevatedAndRampSpans = extractSpans((s) => s.elev > 1.35 && !isNearRajivBlueRamp(s), true, cSamples);
    const rajivRampSpans = extractSpans((s) => s.elev > 1.35 && isNearRajivBlueRamp(s) && !isInsideRajivBridge(s), true, cSamples);
    const rajivBridgeWireSpans = extractSpans((s) => isInsideRajivBridge(s), true, cSamples);
    const atGradeFormationSpans = extractSpans((s) => s.elev > SUBWAY_Y + 0.35 && s.elev <= 1.35, true, cSamples);

    atGradeFormationSpans.forEach((span) => {
      const groundBedMat = m.slateCut.clone();
      groundBedMat.color.setHex(0x363D47);
      const groundBedProf = [[-6.8, -0.22], [6.8, -0.22], [6.2, 0.01], [-6.2, 0.01]];
      const bedMesh = buildRibbonFromSamples(span, groundBedProf, groundBedMat);
      if (bedMesh) parent.add(bedMesh);
      [-TRACK_HALF_SEP, TRACK_HALF_SEP].forEach((lat) => {
        const wireProf = [[lat - 0.08, 5.8], [lat + 0.08, 5.8], [lat + 0.08, 5.95], [lat - 0.08, 5.95]];
        const wireM = buildRibbonFromSamples(span, wireProf, m.steelDark);
        if (wireM) parent.add(wireM);
      });
    });

    const rcRampDeckProf = [[-6.8, 0.0], [-6.8, -1.15], [6.8, -1.15], [6.8, 0.0]];
    rajivRampSpans.forEach((span) => {
      [
        buildRibbonFromSamples(span, rcRampDeckProf, m.concreteLight),
        buildRibbonFromSamples(span, parapetLProf, m.concreteWeb),
        buildRibbonFromSamples(span, parapetRProf, m.concreteWeb),
        buildRibbonFromSamples(span, lineSpineProf, spineMat)
      ].forEach((mesh) => mesh && parent.add(mesh));
      [-TRACK_HALF_SEP, TRACK_HALF_SEP].forEach((lat) => {
        const wireProf = [[lat - 0.08, 5.8], [lat + 0.08, 5.8], [lat + 0.08, 5.95], [lat - 0.08, 5.95]];
        const wireM = buildRibbonFromSamples(span, wireProf, m.steelDark);
        if (wireM) parent.add(wireM);
      });
    });
    rajivBridgeWireSpans.forEach((span) => {
      [-TRACK_HALF_SEP, TRACK_HALF_SEP].forEach((lat) => {
        const wireProf = [[lat - 0.08, 5.8], [lat + 0.08, 5.8], [lat + 0.08, 5.95], [lat - 0.08, 5.95]];
        const wireM = buildRibbonFromSamples(span, wireProf, m.steelDark);
        if (wireM) parent.add(wireM);
      });
    });

    elevatedAndRampSpans.forEach((span) => {
      [
        buildRibbonFromSamples(span, viaductDeckProf, m.concreteLight),
        buildRibbonFromSamples(span, parapetLProf, m.concreteWeb),
        buildRibbonFromSamples(span, parapetRProf, m.concreteWeb),
        buildRibbonFromSamples(span, lineSpineProf, spineMat)
      ].forEach((mesh) => mesh && parent.add(mesh));

      // Overhead OHE Catenary Wire along elevated spans
      [-TRACK_HALF_SEP, TRACK_HALF_SEP].forEach((lat) => {
        const wireProf = [[lat - 0.08, 5.8], [lat + 0.08, 5.8], [lat + 0.08, 5.95], [lat - 0.08, 5.95]];
        const wireM = buildRibbonFromSamples(span, wireProf, m.steelDark);
        if (wireM) parent.add(wireM);
      });
    });

    // 2. Subterranean Subway Cutaway Tunnels Between Stations (shown by default with rails; toggleable via Rails or X-Ray)
    if (!buriedSubwayGroup) {
      buriedSubwayGroup = new THREE.Group();
      buriedSubwayGroup.visible = subwayRailsVisible || undergroundXRay;
      parent.add(buriedSubwayGroup);
    }
    const lineSubwayGroup = new THREE.Group();
    buriedSubwayGroup.add(lineSubwayGroup);

    const rajivStInCorridor = cStations ? cStations.find((st) => st.name === 'Rajiv Chowk') : null;
    const tunnelSpans = extractSpans((s) => s.elev <= SUBWAY_Y + 0.35, true, cSamples);
    // Share the exact 44m chamber half-length boundary between surface station pits and buried cutaway trenches (zero gap / zero floating sleepers)
    const surfaceTrackSpans = extractSpans((s) => isOpenCutOrSurfaceDist(s.dist, s.elev, 42.0, c), false, cSamples);
    const buriedTrackSpans = extractSpans((s) => !isOpenCutOrSurfaceDist(s.dist, s.elev, 42.0, c), true, cSamples);
    const buriedShellSpans = extractSpans(
      (s) => !isOpenCutOrSurfaceDist(s.dist, s.elev, 42.0, c) && !(rajivStInCorridor && Math.abs(s.dist - rajivStInCorridor.dist) <= 74),
      true,
      cSamples
    );

    buriedTrackSpans.forEach((span) => {
      if (span.length < 2) return;
      const coords = [];
      for (let i = 0; i < span.length; i += 2) coords.push(localMetersToLngLat(span[i].pos));
      const lastPt = localMetersToLngLat(span[span.length - 1].pos);
      if (coords[coords.length - 1][0] !== lastPt[0] || coords[coords.length - 1][1] !== lastPt[1]) {
        coords.push(lastPt);
      }
      if (coords.length >= 2) allBuriedGuideLines.push(coords);
    });
    undergroundRouteGeo = {
      type: 'Feature',
      geometry: { type: 'MultiLineString', coordinates: allBuriedGuideLines }
    };

    const trenchBedProf = [[-6.4, -0.20], [6.4, -0.20], [6.4, 0.02], [-6.4, 0.02]];
    const trenchWallL = [[-6.8, -0.20], [-6.25, -0.20], [-6.25, 1.15], [-6.8, 1.15]];
    const trenchWallR = [[6.25, -0.20], [6.8, -0.20], [6.8, 1.15], [6.25, 1.15]];
    const trenchCopingL = [[-7.25, 1.15], [-6.15, 1.15], [-6.15, 1.38], [-7.25, 1.38]];
    const trenchCopingR = [[6.15, 1.15], [7.25, 1.15], [7.25, 1.38], [6.15, 1.38]];
    const subCenterBar = [[-0.22, 0.02], [0.22, 0.02], [0.22, 0.32], [-0.22, 0.32]];
    const subCutawayGlassProf = [
      [-6.2, 1.35], [-5.2, 3.6], [-2.5, 4.9], [0.0, 5.2],
      [2.5, 4.9], [5.2, 3.6], [6.2, 1.35]
    ];
    const subCutawayCrown = buildRibbonFromSpans(buriedShellSpans, subCutawayGlassProf, m.subwayCutawayGlass, 1.15, false);
    if (subCutawayCrown) {
      subCutawayCrown.renderOrder = 2;
      lineSubwayGroup.add(subCutawayCrown);
    }

    [
      buildRibbonFromSpans(buriedShellSpans, trenchBedProf, m.trenchFloor, 1.15, false),
      buildRibbonFromSpans(buriedShellSpans, trenchWallL, m.slateCut, 1.15, false),
      buildRibbonFromSpans(buriedShellSpans, trenchWallR, m.slateCut, 1.15, false),
      buildRibbonFromSpans(buriedShellSpans, trenchCopingL, m.concreteLight, 1.15, false),
      buildRibbonFromSpans(buriedShellSpans, trenchCopingR, m.concreteLight, 1.15, false),
      buildRibbonFromSpans(buriedShellSpans, subCenterBar, spineMat, 1.15, false)
    ].forEach((mesh) => mesh && lineSubwayGroup.add(mesh));

    // 3. Merged Ribbon Track Beds + Dual-Tone Rails + Third Rail (14 merged draw calls instead of ~264 span meshes!)
    const addTrackRibbons = (targetParent, spanList) => {
      [-TRACK_HALF_SEP, TRACK_HALF_SEP].forEach((lat) => {
        const sideSign = Math.sign(lat);
        const ballastProf = [[lat - 1.58, 0.0], [lat + 1.58, 0.0], [lat + 1.38, 0.24], [lat - 1.38, 0.24]];
        const ballastM = buildRibbonFromSpans(spanList, ballastProf, m.ballastSleeper, 1.15, false);
        if (ballastM) targetParent.add(ballastM);

        [-0.95, 0.95].forEach((gOff) => {
          const rLat = lat + gOff;
          const webProf = [[rLat - 0.14, 0.24], [rLat + 0.14, 0.24], [rLat + 0.12, 0.42], [rLat - 0.12, 0.42]];
          const crownProf = [[rLat - 0.10, 0.42], [rLat + 0.10, 0.42], [rLat + 0.10, 0.50], [rLat - 0.10, 0.50]];
          const webM = buildRibbonFromSpans(spanList, webProf, m.railWeb, 1.15, false);
          const crownM = buildRibbonFromSpans(spanList, crownProf, m.railCrown, 1.15, false);
          if (webM) targetParent.add(webM);
          if (crownM) targetParent.add(crownM);
        });

                const guideLat = lat + sideSign * 1.48;
        const guideProf = [[guideLat - 0.09, 0.22], [guideLat + 0.09, 0.22], [guideLat + 0.09, 0.38], [guideLat - 0.09, 0.38]];
        const guideM = buildRibbonFromSpans(spanList, guideProf, guideMat, 1.15, false);
        if (guideM) targetParent.add(guideM);
      });
    };
    addTrackRibbons(parent, surfaceTrackSpans);
    addTrackRibbons(lineSubwayGroup, buriedTrackSpans);

    // 4. Instanced 3D Raised Cross-Sleepers, Piers, OHE & Cutaway Cross Beams
    const pierLocations = [];
    const oheLocations = [];
    const trenchBeamLocations = [];
    const surfaceSleeperLocations = [];
    const buriedSleeperLocations = [];

    const rcRampPierLocations = [];
    for (let d = 24; d < cLen - 24; d += 44) {
      const smp = sampleAtDist(d, c);
      if (!smp) continue;
      if (isBlue && rajivStInCorridor && Math.abs(d - rajivStInCorridor.dist) > 74 && Math.abs(d - rajivStInCorridor.dist) <= 440 && smp.elev >= 3.0 && smp.elev < VIADUCT_Y - 1.5) {
        rcRampPierLocations.push(smp);
        continue;
      }
      if (smp.elev < VIADUCT_Y - 1.5) continue;
      const nearElevSt = cStations.some((st) => st.structure === 'elevated' && Math.abs(st.dist - d) < 46);
      if (!nearElevSt) pierLocations.push(smp);
    }
    for (let d = 30; d < cLen - 30; d += 62) {
      const smp = sampleAtDist(d, c);
      if (!smp || smp.elev < VIADUCT_Y - 1.5) continue;
      const nearElevSt = cStations.some((st) => st.structure === 'elevated' && Math.abs(st.dist - d) < 45);
      if (!nearElevSt) oheLocations.push(smp);
    }
    for (let d = 24; d < cLen - 24; d += 22) {
      const smp = sampleAtDist(d, c);
      if (!smp || smp.elev > SUBWAY_Y + 0.35) continue;
      const nearUgSt = cStations.some((st) => st.structure !== 'elevated' && Math.abs(st.dist - d) < (st.name === 'Rajiv Chowk' ? 74 : 48));
      if (!nearUgSt) trenchBeamLocations.push(smp);
    }
    for (let d = 6; d < cLen - 6; d += 1.35) {
      const nearFocus = cStations.some((st) => Math.abs(st.dist - d) < 220);
      const smp = sampleAtDist(d, c);
      if (!smp) continue;
      if (nearFocus || (smp.elev > SUBWAY_Y + 0.5 && smp.elev < VIADUCT_Y - 0.5)) {
        if (isOpenCutOrSurfaceDist(smp.dist, smp.elev, 42.0, c)) surfaceSleeperLocations.push(smp);
        else buriedSleeperLocations.push(smp);
      }
    }

    const dummy = new THREE.Object3D();
    if (pierLocations.length) {
      const shaftInst = new THREE.InstancedMesh(g.pierShaft, m.pierCream, pierLocations.length);
      const capInst = new THREE.InstancedMesh(g.box1, m.concreteLight, pierLocations.length);
      const plinthInst = new THREE.InstancedMesh(g.box1, m.concreteWeb, pierLocations.length);
      const pierAoInst = new THREE.InstancedMesh(g.shadowQuad, m.shadowDisc, pierLocations.length);
      shaftInst.frustumCulled = capInst.frustumCulled = plinthInst.frustumCulled = pierAoInst.frustumCulled = false;
      shaftInst.castShadow = capInst.castShadow = plinthInst.castShadow = true;
      shaftInst.receiveShadow = capInst.receiveShadow = plinthInst.receiveShadow = true;

      pierLocations.forEach((smp, idx) => {
        const yaw = Math.atan2(-smp.tan.z, smp.tan.x);
        const capH = 2.0;
        const capBotY = smp.pos.y - 2.4 - capH;
        const shaftH = Math.max(1.5, capBotY - 0.6);

        dummy.position.set(smp.pos.x, 0.30, smp.pos.z);
        dummy.rotation.set(0, yaw, 0);
        dummy.scale.set(4.0, 0.6, 4.4);
        dummy.updateMatrix();
        plinthInst.setMatrixAt(idx, dummy.matrix);

        dummy.position.set(smp.pos.x - 1.2, 0.25, smp.pos.z - 0.9);
        dummy.rotation.set(0, yaw, 0);
        dummy.scale.set(11.5, 1, 11.5);
        dummy.updateMatrix();
        pierAoInst.setMatrixAt(idx, dummy.matrix);

        dummy.position.set(smp.pos.x, 0.6 + shaftH / 2, smp.pos.z);
        dummy.rotation.set(0, yaw, 0);
        dummy.scale.set(1, shaftH, 1);
        dummy.updateMatrix();
        shaftInst.setMatrixAt(idx, dummy.matrix);

        dummy.position.set(smp.pos.x, capBotY + capH / 2, smp.pos.z);
        dummy.rotation.set(0, yaw, 0);
        dummy.scale.set(3.0, capH, 12.2);
        dummy.updateMatrix();
        capInst.setMatrixAt(idx, dummy.matrix);
      });
      parent.add(pierAoInst, plinthInst, shaftInst, capInst);
    }

    if (rcRampPierLocations.length) {
      const rShaftInst = new THREE.InstancedMesh(g.pierShaft, m.pierCream, rcRampPierLocations.length);
      const rCapInst = new THREE.InstancedMesh(g.box1, m.concreteLight, rcRampPierLocations.length);
      rShaftInst.frustumCulled = rCapInst.frustumCulled = false;
      rShaftInst.castShadow = rCapInst.castShadow = true;
      rShaftInst.receiveShadow = rCapInst.receiveShadow = true;
      rcRampPierLocations.forEach((smp, idx) => {
        const yaw = Math.atan2(-smp.tan.z, smp.tan.x);
        const capH = 0.85;
        const capBotY = smp.pos.y - 1.15 - capH;
        const shaftH = Math.max(0.6, capBotY - 0.15);
        dummy.position.set(smp.pos.x, 0.15 + shaftH * 0.5, smp.pos.z);
        dummy.rotation.set(0, yaw, 0);
        dummy.scale.set(0.9, shaftH, 0.9);
        dummy.updateMatrix();
        rShaftInst.setMatrixAt(idx, dummy.matrix);
        dummy.position.set(smp.pos.x, capBotY + capH * 0.5, smp.pos.z);
        dummy.rotation.set(0, yaw, 0);
        dummy.scale.set(2.4, capH, 11.4);
        dummy.updateMatrix();
        rCapInst.setMatrixAt(idx, dummy.matrix);
      });
      parent.add(rShaftInst, rCapInst);
    }

    if (oheLocations.length) {
      const mastInst = new THREE.InstancedMesh(g.box1, m.steelDark, oheLocations.length * 2);
      const beamInst = new THREE.InstancedMesh(g.box1, m.steelDark, oheLocations.length);
      mastInst.frustumCulled = beamInst.frustumCulled = false;

      oheLocations.forEach((smp, idx) => {
        const yaw = Math.atan2(-smp.tan.z, smp.tan.x);
        const right = new THREE.Vector3(-smp.tan.z, 0, smp.tan.x).normalize();

        [-6.4, 6.4].forEach((lat, side) => {
          dummy.position.set(smp.pos.x + right.x * lat, smp.pos.y + 3.4, smp.pos.z + right.z * lat);
          dummy.rotation.set(0, yaw, 0);
          dummy.scale.set(0.32, 6.6, 0.32);
          dummy.updateMatrix();
          mastInst.setMatrixAt(idx * 2 + side, dummy.matrix);
        });

        dummy.position.set(smp.pos.x, smp.pos.y + 6.6, smp.pos.z);
        dummy.rotation.set(0, yaw, 0);
        dummy.scale.set(0.34, 0.32, 13.2);
        dummy.updateMatrix();
        beamInst.setMatrixAt(idx, dummy.matrix);
      });
      parent.add(mastInst, beamInst);
    }

    if (trenchBeamLocations.length) {
      const braceInst = new THREE.InstancedMesh(g.box1, m.steelDark, trenchBeamLocations.length);
      braceInst.frustumCulled = false;
      trenchBeamLocations.forEach((smp, idx) => {
        const yaw = Math.atan2(-smp.tan.z, smp.tan.x);
        dummy.position.set(smp.pos.x, SUBWAY_Y + 1.25, smp.pos.z);
        dummy.rotation.set(0, yaw, 0);
        dummy.scale.set(0.35, 0.24, 13.0);
        dummy.updateMatrix();
        braceInst.setMatrixAt(idx, dummy.matrix);
      });
      lineSubwayGroup.add(braceInst);
    }

    const addSleeperInsts = (targetParent, list) => {
      if (!list.length) return;
      const tieInst = new THREE.InstancedMesh(g.box1, m.railTieWood, list.length * 2);
      tieInst.frustumCulled = false;
      list.forEach((smp, idx) => {
        const yaw = Math.atan2(-smp.tan.z, smp.tan.x);
        const right = new THREE.Vector3(-smp.tan.z, 0, smp.tan.x).normalize();
        [-TRACK_HALF_SEP, TRACK_HALF_SEP].forEach((lat, side) => {
          dummy.position.set(
            smp.pos.x + right.x * lat,
            smp.pos.y + 0.26,
            smp.pos.z + right.z * lat
          );
          dummy.rotation.set(0, yaw, 0);
          dummy.scale.set(0.42, 0.14, 2.75);
          dummy.updateMatrix();
          tieInst.setMatrixAt(idx * 2 + side, dummy.matrix);
        });
      });
      targetParent.add(tieInst);
    };
    addSleeperInsts(parent, surfaceSleeperLocations);
    addSleeperInsts(lineSubwayGroup, buriedSleeperLocations);

    // 5. Ribbed Concrete TBM Portal Gatehouses at portalCoords
    if (portalCoords && portalCoords.length) {
      portalCoords.forEach((smp) => {
        if (!smp) return;
        const pg = new THREE.Group();
        pg.position.set(smp.pos.x, SUBWAY_Y, smp.pos.z);
        pg.rotation.y = Math.atan2(-smp.tan.z, smp.tan.x);

        addBox(pg, 18, 6.4, 15.6, m.concreteLight, 0, 3.2, 0);
        addBox(pg, 18.6, 0.9, 16.2, spineMat, 0, 6.6, 0);
        [-TRACK_HALF_SEP, TRACK_HALF_SEP].forEach((tz) => {
          const arch = new THREE.Mesh(g.tbmArch, m.concreteLight);
          arch.rotation.z = Math.PI / 2;
          arch.position.set(0, 2.0, tz);
          arch.scale.set(1.2, 2.2, 1.0);
          pg.add(arch);

          const bore = new THREE.Mesh(g.tbmBore, m.slateDark);
          bore.rotation.z = Math.PI / 2;
          bore.position.set(0, 2.0, tz);
          bore.scale.set(1.15, 2.25, 0.95);
          pg.add(bore);
        });
        parent.add(pg);
      });
    }

    // 6. X-Ray Subterranean Cutaway Tunnel Shell & Station Interchange Boxes (toggled via setUndergroundXRay)
    if (!xrayTubeGroup) {
      xrayTubeGroup = new THREE.Group();
      xrayTubeGroup.visible = undergroundXRay;
      parent.add(xrayTubeGroup);
    }
    const lineXrayGroup = new THREE.Group();
    xrayTubeGroup.add(lineXrayGroup);

    const xrayShellProf = [
      [-5.8, 0.2], [-5.2, 4.0], [-2.8, 6.2], [0.0, 6.8],
      [2.8, 6.2], [5.2, 4.0], [5.8, 0.2]
    ];
    const xrayRailLProf = [
      [-TRACK_HALF_SEP - 0.35, 0.55], [-TRACK_HALF_SEP + 0.35, 0.55],
      [-TRACK_HALF_SEP + 0.35, 1.05], [-TRACK_HALF_SEP - 0.35, 1.05]
    ];
    const xrayRailRProf = [
      [TRACK_HALF_SEP - 0.35, 0.55], [TRACK_HALF_SEP + 0.35, 0.55],
      [TRACK_HALF_SEP + 0.35, 1.05], [TRACK_HALF_SEP - 0.35, 1.05]
    ];
    tunnelSpans.forEach((span) => {
      [
        buildRibbonFromSamples(span, xrayShellProf, m.xrayTubeShell),
        buildRibbonFromSamples(span, xrayRailLProf, m.xrayTubeRail),
        buildRibbonFromSamples(span, xrayRailRProf, m.xrayTubeRail)
      ].forEach((mesh) => {
        if (!mesh) return;
        mesh.castShadow = false;
        mesh.receiveShadow = false;
        mesh.renderOrder = 3;
        lineXrayGroup.add(mesh);
      });
    });

    // Illuminated cyan structural TBM bore ribs along underground spans in X-Ray mode
    const xrayRibSamples = [];
    for (let d = 30; d < cLen - 30; d += 34) {
      const smp = sampleAtDist(d, c);
      if (smp && smp.elev <= SUBWAY_Y + 0.35) xrayRibSamples.push(smp);
    }
    if (xrayRibSamples.length) {
      const ribGeo = new THREE.TorusGeometry(5.6, 0.22, 6, 16, Math.PI);
      const ribMat = new THREE.MeshBasicMaterial({
        color: isBlue ? 0x60A5FA : 0x7DD3FC,
        transparent: true,
        opacity: 0.65,
        depthWrite: false
      });
      const ribInst = new THREE.InstancedMesh(ribGeo, ribMat, xrayRibSamples.length);
      ribInst.frustumCulled = false;
      ribInst.renderOrder = 4;
      const rDummy = new THREE.Object3D();
      xrayRibSamples.forEach((smp, i) => {
        rDummy.position.set(smp.pos.x, smp.pos.y + 0.35, smp.pos.z);
        rDummy.rotation.set(0, Math.atan2(-smp.tan.z, smp.tan.x) + Math.PI / 2, 0);
        rDummy.updateMatrix();
        ribInst.setMatrixAt(i, rDummy.matrix);
      });
      lineXrayGroup.add(ribInst);
    }

    const UNDERGROUND_SIDE_SET = new Set([
      'GTB Nagar', 'Vishwavidyalaya', 'Vidhan Sabha', 'Civil Lines', 'Central Secretariat',
      'RK Ashram Marg', 'Barakhamba Road', 'Mandi House'
    ]);
    cStations.forEach((st) => {
      if (st.structure === 'elevated') return;
      const isSide = UNDERGROUND_SIDE_SET.has(st.name);
      const xg = new THREE.Group();
      xg.position.set(st.pos.x, 0.6, st.pos.z);
      xg.rotation.y = Math.atan2(-st.tan.z, st.tan.x);
      const hull = new THREE.Mesh(g.box1, m.xrayTubeShell);
      hull.scale.set(84, 9.2, isSide ? 26 : 22);
      hull.position.y = 4.6;
      hull.renderOrder = 3;
      xg.add(hull);
      const secHex = pickInterchangeHex(st);
      if (secHex) {
        const crossMat = new THREE.MeshBasicMaterial({
          color: secHex, transparent: true, opacity: 0.30, depthWrite: false
        });
        const cross = new THREE.Mesh(g.box1, crossMat);
        cross.scale.set(14, 4.4, 118);
        cross.position.y = 2.4;
        cross.renderOrder = 4;
        xg.add(cross);
        const railLineMat = new THREE.MeshBasicMaterial({
          color: secHex, transparent: true, opacity: 0.85, depthWrite: false
        });
        [-3.2, 3.2].forEach((rx) => {
          const lineMesh = new THREE.Mesh(g.box1, railLineMat);
          lineMesh.scale.set(0.55, 0.45, 118);
          lineMesh.position.set(rx, 0.9, 0);
          lineMesh.renderOrder = 4;
          xg.add(lineMesh);
        });
      }
      lineXrayGroup.add(xg);
    });
  }

  /* ───────────────────────────────────────────────────────────
   * 2B. Beautiful Delhi Boulevard Medians, Groves, Lamps, Skyline & Landmarks
   * ─────────────────────────────────────────────────────────── */
  function createSeededRand(seed) {
    let s = seed >>> 0;
    return function () {
      s = (s + 0x6D2B79F5) >>> 0;
      let t = Math.imul(s ^ (s >>> 15), 1 | s);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function getRailYardBounds() {
    if (railHubBounds) return railHubBounds;
    if (!originMc) return [];
    const boxes = [];
    const toBox = (lngMin, latMin, lngMax, latMax) => {
      const a = toLocalMeters([lngMin, latMin], 0);
      const b = toLocalMeters([lngMax, latMax], 0);
      return {
        oriented: false,
        minX: Math.min(a.x, b.x),
        maxX: Math.max(a.x, b.x),
        minZ: Math.min(a.z, b.z),
        maxZ: Math.max(a.z, b.z)
      };
    };
    boxes.push(
      toBox(77.2180, 28.6375, 77.2226, 28.6478),
      toBox(77.2215, 28.6598, 77.2345, 28.6632)
    );
    INDIA_RAILWAY_HUBS.forEach((hub) => {
      if (!hub.p0 || !hub.p1) return;
      const anchor = toLocalMeters(hub.coords, 0);
      const p0 = toLocalMeters(hub.p0, 0);
      const p1 = toLocalMeters(hub.p1, 0);
      const tan = p1.sub(p0);
      tan.y = 0;
      const n = tan.length();
      if (n < 1e-3) return;
      const ux = tan.x / n;
      const uz = tan.z / n;
      const halfL = (hub.pLen || 200) * 0.54 + 22;
      const halfW = Math.max(18, ((hub.maxX || 14) - (hub.minX || -14)) * 0.52 + 16);
      boxes.push({
        oriented: true,
        x: anchor.x,
        z: anchor.z,
        ux,
        uz,
        halfL,
        halfW,
        boundR: halfL + halfW
      });
    });
    railHubBounds = boxes;
    return railHubBounds;
  }

  function isPointInRailYard(x, z) {
    const boxes = getRailYardBounds();
    for (let i = 0; i < boxes.length; i++) {
      const rb = boxes[i];
      if (!rb.oriented) {
        if (x >= rb.minX && x <= rb.maxX && z >= rb.minZ && z <= rb.maxZ) return true;
      } else {
        const dx = x - rb.x;
        const dz = z - rb.z;
        if (Math.abs(dx) > rb.boundR || Math.abs(dz) > rb.boundR) continue;
        const along = Math.abs(dx * rb.ux + dz * rb.uz);
        const perp = Math.abs(dx * rb.uz - dz * rb.ux);
        if (along <= rb.halfL && perp <= rb.halfW) return true;
      }
    }
    return false;
  }

  function ensureMonumentBuilt(mon) {
    if (!mon || mon.group || typeof mon.buildFn !== 'function') return;
    const grp = mon.buildFn();
    mon.buildFn = null;
    if (!grp) return;
    const sMeshes = [];
    grp.traverse((obj) => {
      if (obj.isMesh) {
        obj.frustumCulled = false;
        obj.receiveShadow = true;
        if (!obj.material || !obj.material.transparent) {
          sMeshes.push(obj);
        }
      }
    });
    if (mon.parent) mon.parent.add(grp);
    mon.group = grp;
    mon.shadowMeshes = sMeshes;
    mon._inShadow = false;
  }

  function buildBeautifulDelhiEnvironment(parent) {
    const m = getMaterials();
    const g = getSharedStationGeos();
    const rand = createSeededRand(20261110);
    monumentGroups = [];
    railHubBounds = null;

    // 1. Landscaped Sage Boulevard Median + Travertine Curbs + Soft Viaduct Ground Shadow beneath elevated piers
    const medianProf = [[-4.2, 0.08], [4.2, 0.08], [4.2, 0.24], [-4.2, 0.24]];
    const curbLProf = [[-4.55, 0.08], [-4.15, 0.08], [-4.15, 0.38], [-4.55, 0.38]];
    const curbRProf = [[4.15, 0.08], [4.55, 0.08], [4.55, 0.38], [4.15, 0.38]];
    const viaductShadowProf = [[-6.8, 0.14], [6.8, 0.14], [6.8, 0.15], [-6.8, 0.15]];
    const elevatedOnlySpans = extractSpans((s) => s.elev >= VIADUCT_Y - 0.5, false);
    elevatedOnlySpans.forEach((span) => {
      const groundSpan = span.map((s) => ({
        dist: s.dist,
        tan: s.tan,
        pos: new THREE.Vector3(s.pos.x, 0, s.pos.z)
      }));
      const shadowSpan = span.map((s) => ({
        dist: s.dist,
        tan: s.tan,
        pos: new THREE.Vector3(s.pos.x - 4.8, 0, s.pos.z - 3.6)
      }));
      const shadMesh = buildRibbonFromSamples(shadowSpan, viaductShadowProf, m.viaductShadow);
      if (shadMesh) {
        shadMesh.castShadow = false;
        shadMesh.receiveShadow = false;
        parent.add(shadMesh);
      }
      [
        buildRibbonFromSamples(groundSpan, medianProf, m.sagePark),
        buildRibbonFromSamples(groundSpan, curbLProf, m.concreteLight),
        buildRibbonFromSamples(groundSpan, curbRProf, m.concreteLight)
      ].forEach((mesh) => {
        if (!mesh) return;
        mesh.castShadow = false;
        mesh.receiveShadow = true;
        parent.add(mesh);
      });
    });

    const nearAnyStation = (x, z, rad) => {
      const r2 = rad * rad;
      const list = allStationsData.length ? allStationsData : stationsData;
      for (let i = 0; i < list.length; i++) {
        const sp = list[i].pos;
        const dx = x - sp.x;
        const dz = z - sp.z;
        if (dx * dx + dz * dz < r2) return true;
      }
      return false;
    };

    const nearTrackCenterline = (x, z, minDistM) => {
      const r2 = minDistM * minDistM;
      const corridors = allCorridors.length ? allCorridors : [yellowCorridor, blueCorridor].filter(Boolean);
      for (let c = 0; c < corridors.length; c++) {
        const smps = corridors[c].samples;
        if (!smps) continue;
        for (let i = 0; i < smps.length; i += 3) {
          const sp = smps[i].pos;
          const dx = x - sp.x;
          const dz = z - sp.z;
          if (dx * dx + dz * dz < r2) return true;
        }
      }
      return false;
    };

    const rajivSt = stationsData.find((s) => s.name === 'Rajiv Chowk');
    const qutabSt = stationsData.find((s) => s.name === 'Qutab Minar');
    const secStart = stationsData.find((s) => s.name === 'Patel Chowk');
    const jorStart = stationsData.find((s) => s.name === 'Jor Bagh');

    // 2. Sculpted Delhi Botanical Trees (Broadleaf Neem/Banyan + Columnar Lutyens Ashok!)
    const trees = []; // { x, z, scale, shade (0..2 broadleaf, 3 = Ashok), sx, sy, sz, yaw }

    // A) Natural Boulevard Avenue Trees
    for (let d = 30; d < totalLen - 30; d += 26) {
      if ((Math.round(d / 26) * 7) % 5 === 0) continue;
      const smp = sampleAtDist(d);
      if (!smp) continue;
      if (stationsData.some((st) => Math.abs(st.dist - d) < 52)) continue;
      const right = new THREE.Vector3(-smp.tan.z, 0, smp.tan.x).normalize();
      [-1, 1].forEach((side) => {
        if (rand() < 0.14) return;
        const offset = 14.2 + rand() * 5.2;
        const tx = smp.pos.x + right.x * (side * offset) + (rand() - 0.5) * 4.0;
        const tz = smp.pos.z + right.z * (side * offset) + (rand() - 0.5) * 4.0;
        if (!nearAnyStation(tx, tz, 46) && !isPointInRailYard(tx, tz)) {
          const isAshok = rand() < 0.28;
          trees.push({
            x: tx,
            z: tz,
            scale: 0.78 + rand() * 0.58,
            shade: isAshok ? 3 : Math.floor(rand() * 3),
            sx: 0.88 + rand() * 0.28,
            sy: 0.90 + rand() * 0.30,
            sz: 0.88 + rand() * 0.28,
            yaw: rand() * Math.PI * 2
          });
        }
      });
    }

    // B) Botanical Groves in Sanjay Van / Mehrauli Forest around Qutab Minar & Chhatarpur
    if (qutabSt) {
      for (let i = 0; i < 340; i++) {
        const d = qutabSt.dist - 550 + rand() * 1900;
        const smp = sampleAtDist(Math.max(20, Math.min(totalLen - 20, d)));
        if (!smp) continue;
        const right = new THREE.Vector3(-smp.tan.z, 0, smp.tan.x).normalize();
        const side = rand() < 0.72 ? 1 : -1;
        const lat = (24 + rand() * 210) * side;
        const tx = smp.pos.x + right.x * lat + (rand() - 0.5) * 18;
        const tz = smp.pos.z + right.z * lat + (rand() - 0.5) * 18;
        if (!nearAnyStation(tx, tz, 46)) {
          trees.push({
            x: tx,
            z: tz,
            scale: 0.92 + rand() * 0.92,
            shade: rand() < 0.18 ? 3 : Math.floor(rand() * 3),
            sx: 0.88 + rand() * 0.30,
            sy: 0.88 + rand() * 0.32,
            sz: 0.88 + rand() * 0.30,
            yaw: rand() * Math.PI * 2
          });
        }
      }
    }

    // C) Ceremonial Lutyens' Green Canopy (Patel Chowk .. Jor Bagh — iconic Ashok-lined avenues!)
    if (secStart && jorStart) {
      for (let d = secStart.dist; d <= jorStart.dist; d += 24) {
        const smp = sampleAtDist(d);
        if (!smp || nearAnyStation(smp.pos.x, smp.pos.z, 52)) continue;
        const right = new THREE.Vector3(-smp.tan.z, 0, smp.tan.x).normalize();
        [-34, 34].forEach((lat) => {
          trees.push({
            x: smp.pos.x + right.x * (lat + (rand() - 0.5) * 4.5),
            z: smp.pos.z + right.z * (lat + (rand() - 0.5) * 4.5),
            scale: 1.05 + rand() * 0.48,
            shade: rand() < 0.45 ? 3 : Math.floor(rand() * 3),
            sx: 0.92 + rand() * 0.24,
            sy: 0.92 + rand() * 0.28,
            sz: 0.92 + rand() * 0.24,
            yaw: rand() * Math.PI * 2
          });
        });
      }
    }

    // D) Connaught Place Central Park Natural Grove
    if (rajivSt) {
      for (let i = 0; i < 68; i++) {
        const clusterAng = ((i % 7) / 7) * Math.PI * 2 + (rand() - 0.5) * 0.72;
        const rad = 64 + Math.sqrt(rand()) * 96;
        const tx = rajivSt.pos.x + Math.cos(clusterAng) * rad + (rand() - 0.5) * 8;
        const tz = rajivSt.pos.z + Math.sin(clusterAng) * rad + (rand() - 0.5) * 8;
        if (!nearAnyStation(tx, tz, 48) && !nearTrackCenterline(tx, tz, 17)) {
          trees.push({
            x: tx,
            z: tz,
            scale: 0.88 + rand() * 0.58,
            shade: rand() < 0.24 ? 3 : Math.floor(rand() * 3),
            sx: 0.86 + rand() * 0.30,
            sy: 0.88 + rand() * 0.30,
            sz: 0.86 + rand() * 0.30,
            yaw: rand() * Math.PI * 2
          });
        }
      }
    }

    // Emit InstancedMesh calls + Ground Contact AO Discs
    const dummy = new THREE.Object3D();
    const foliageMats = [m.treeFoliageDeep, m.treeFoliageMid, m.treeFoliageBright, m.treeFoliageAshok];
    // shortcut: mobile omits directional tree shadows (keeps contact AO disc) to save ~1M shadow triangles/frame; re-enable if GPU budget allows
    const treeCastShadow = !isMobileProfile();
    if (trees.length) {
      const trunkInst = new THREE.InstancedMesh(g.cyl1, m.treeTrunk, trees.length);
      const treeAoInst = new THREE.InstancedMesh(g.shadowQuad, m.shadowDisc, trees.length);
      trunkInst.frustumCulled = treeAoInst.frustumCulled = false;
      trunkInst.castShadow = treeCastShadow;
      const byShade = [[], [], [], []];
      trees.forEach((tr, i) => {
        const s = tr.scale;
        dummy.position.set(tr.x, 1.85 * s, tr.z);
        dummy.rotation.set(0, tr.yaw || 0, 0);
        dummy.scale.set(0.34 * s, 3.7 * s, 0.34 * s);
        dummy.updateMatrix();
        trunkInst.setMatrixAt(i, dummy.matrix);

        dummy.position.set(tr.x - 1.0 * s, 0.16, tr.z - 0.7 * s);
        dummy.rotation.set(0, 0, 0);
        dummy.scale.set(5.0 * s, 1, 5.0 * s);
        dummy.updateMatrix();
        treeAoInst.setMatrixAt(i, dummy.matrix);
        byShade[tr.shade % 4].push(tr);
      });
      parent.add(treeAoInst, trunkInst);

      byShade.forEach((groupList, sIdx) => {
        if (!groupList.length) return;
        const geo = sIdx === 3 ? g.ashokCrown : g.treeCrown;
        const yOff = sIdx === 3 ? 5.6 : 4.9;
        const crownInst = new THREE.InstancedMesh(geo, foliageMats[sIdx], groupList.length);
        crownInst.frustumCulled = false;
        crownInst.castShadow = treeCastShadow;
        crownInst.receiveShadow = true;
        groupList.forEach((tr, gi) => {
          const s = tr.scale;
          dummy.position.set(tr.x, yOff * s, tr.z);
          dummy.rotation.set(0, tr.yaw || (gi * 0.7), 0);
          dummy.scale.set((tr.sx || 1) * s, (tr.sy || 1.05) * s, (tr.sz || 1) * s);
          dummy.updateMatrix();
          crownInst.setMatrixAt(gi, dummy.matrix);
        });
        parent.add(crownInst);
      });
    }

    // 2E) Dynamic OSM-Park Polygon Canopy Pool (3 broadleaf tones + columnar Ashok species!)
    const parkTrunkInst = new THREE.InstancedMesh(g.cyl1, m.treeTrunk, MAX_PARK_TREES);
    const parkAoInst = new THREE.InstancedMesh(g.shadowQuad, m.shadowDisc, MAX_PARK_TREES);
    const parkCrownInsts = foliageMats.map((mat, sIdx) => {
      const ci = new THREE.InstancedMesh(
        sIdx === 3 ? g.ashokCrown : g.treeCrown,
        mat,
        Math.ceil(MAX_PARK_TREES / 2)
      );
      ci.count = 0;
      ci.frustumCulled = false;
      ci.castShadow = treeCastShadow;
      ci.receiveShadow = true;
      parent.add(ci);
      return ci;
    });
    parkTrunkInst.count = 0;
    parkAoInst.count = 0;
    parkTrunkInst.frustumCulled = parkAoInst.frustumCulled = false;
    parkTrunkInst.castShadow = treeCastShadow;
    parent.add(parkAoInst, parkTrunkInst);
    parkPool = {
      trunkInst: parkTrunkInst,
      aoInst: parkAoInst,
      crownInsts: parkCrownInsts,
      nearAnyStation,
      nearTrackCenterline
    };

    // 3. Boulevard Lamp Posts along elevated viaduct curbs
    const lamps = [];
    for (let d = 35; d < totalLen - 35; d += 40) {
      const smp = sampleAtDist(d);
      if (!smp || smp.elev < VIADUCT_Y - 1.5 || nearAnyStation(smp.pos.x, smp.pos.z, 54)) continue;
      const right = new THREE.Vector3(-smp.tan.z, 0, smp.tan.x).normalize();
      const side = ((Math.round(d / 40) % 2) === 0) ? 1 : -1;
      lamps.push({
        x: smp.pos.x + right.x * (side * 4.35),
        z: smp.pos.z + right.z * (side * 4.35),
        yaw: Math.atan2(-smp.tan.z, smp.tan.x)
      });
    }
    if (lamps.length) {
      const postInst = new THREE.InstancedMesh(g.cyl1, m.steelDark, lamps.length);
      const glowInst = new THREE.InstancedMesh(g.box1, m.lampGlow, lamps.length);
      postInst.frustumCulled = glowInst.frustumCulled = false;
      lamps.forEach((lp, i) => {
        dummy.position.set(lp.x, 3.2, lp.z);
        dummy.rotation.set(0, lp.yaw, 0);
        dummy.scale.set(0.14, 6.4, 0.14);
        dummy.updateMatrix();
        postInst.setMatrixAt(i, dummy.matrix);

        dummy.position.set(lp.x, 6.45, lp.z);
        dummy.scale.set(0.55, 0.25, 0.55);
        dummy.updateMatrix();
        glowInst.setMatrixAt(i, dummy.matrix);
      });
      parent.add(postInst, glowInst);
    }

    // Helper: register monument (eager or on-demand lazy builder) for fast camera distance & shadow culling
    const registerMonument = (name, grp, pos, visDistM = 4600) => {
      const sMeshes = [];
      grp.traverse((obj) => {
        if (obj.isMesh) {
          obj.frustumCulled = false;
          obj.receiveShadow = true;
          if (!obj.material || !obj.material.transparent) {
            sMeshes.push(obj);
          }
        }
      });
      parent.add(grp);
      monumentGroups.push({
        name,
        group: grp,
        x: pos.x,
        z: pos.z,
        visR2: visDistM * visDistM,
        shadowMeshes: sMeshes,
        _inShadow: false
      });
    };

    const registerLazyMonument = (name, pos, visDistM, buildFn) => {
      monumentGroups.push({
        name,
        group: null,
        parent,
        buildFn,
        x: pos.x,
        z: pos.z,
        visR2: visDistM * visDistM,
        shadowMeshes: [],
        _inShadow: false
      });
    };

    // 4A. Qutab Minar (72.5m Tapered Red Sandstone Minaret at [77.1855, 28.5245])
    const qmPos = toLocalMeters([77.1855, 28.5245], 0);
    const qmGroup = new THREE.Group();
    qmGroup.position.set(qmPos.x, 0, qmPos.z);
    const qmDais = new THREE.Mesh(new THREE.CylinderGeometry(16.8, 17.6, 0.32, 16), m.plazaPave);
    qmDais.position.y = 0.24;
    const qmPedestal = new THREE.Mesh(new THREE.CylinderGeometry(11.6, 12.4, 1.35, 8), m.sandstoneBuff);
    qmPedestal.position.y = 1.05;
    qmGroup.add(qmDais, qmPedestal);
    const tierHeights = [24, 17, 13, 10, 8];
    const tierRads = [[7.4, 5.8], [5.6, 4.4], [4.2, 3.3], [3.2, 2.5], [2.4, 1.8]];
    let yAcc = 1.6;
    tierHeights.forEach((th, idx) => {
      const [rBot, rTop] = tierRads[idx];
      const cyl = new THREE.Mesh(
        new THREE.CylinderGeometry(rTop, rBot, th, 20),
        idx >= 3 ? m.sandstoneBuff : m.qutabRedStone
      );
      cyl.position.y = yAcc + th * 0.5;
      qmGroup.add(cyl);
      if (idx < 3) {
        for (let fi = 0; fi < 10; fi++) {
          const ang = (fi / 10) * Math.PI * 2;
          const rMid = (rBot + rTop) * 0.5;
          const rib = addBox(qmGroup, 0.48, th - 0.8, 0.48, m.sandstoneBuff, Math.cos(ang) * rMid, yAcc + th * 0.5, Math.sin(ang) * rMid);
          rib.rotation.y = -ang;
        }
      }
      const bal = new THREE.Mesh(new THREE.CylinderGeometry(rTop + 1.0, rTop + 0.45, 1.5, 20), m.sandstoneBuff);
      bal.position.y = yAcc + th;
      qmGroup.add(bal);
      yAcc += th;
    });
    const cupola = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 1.9, 3.4, 16), m.qutabRedStone);
    cupola.position.y = yAcc + 1.7;
    qmGroup.add(cupola);
    registerMonument('Qutab Minar', qmGroup, qmPos, 5500);

    // 4B. India Gate Sculpted Triumphal Archway (42m Memorial at [77.2295, 28.6129])
    const igPos = toLocalMeters([77.2295, 28.6129], 0);
    const igGroup = new THREE.Group();
    igGroup.position.set(igPos.x, 0, igPos.z);
    igGroup.rotation.y = Math.PI / 2;

    const igOuterDais = new THREE.Mesh(new THREE.CylinderGeometry(16.4, 17.2, 0.34, 16), m.plazaPave);
    igOuterDais.position.y = 0.24;
    const igInnerDais = new THREE.Mesh(new THREE.CylinderGeometry(13.2, 13.8, 0.42, 16), m.sandstoneBuff);
    igInnerDais.position.y = 0.58;
    igGroup.add(igOuterDais, igInnerDais);
    addBox(igGroup, 26.8, 1.35, 11.4, m.sandstoneBuff, 0, 1.40, 0);
    addBox(igGroup, 25.0, 0.75, 10.2, m.qutabRedStone, 0, 2.35, 0);
    addBox(igGroup, 3.4, 0.9, 3.4, m.qutabRedStone, 0, 1.15, 0);

    const archShape = new THREE.Shape();
    archShape.moveTo(-8.4, 2.0);
    archShape.lineTo(-8.4, 27.0);
    archShape.lineTo(8.4, 27.0);
    archShape.lineTo(8.4, 2.0);
    archShape.lineTo(5.1, 2.0);
    archShape.lineTo(5.1, 17.6);
    archShape.absarc(0, 17.6, 5.1, 0, Math.PI, false);
    archShape.lineTo(-5.1, 2.0);
    archShape.closePath();

    const archExtrude = new THREE.ExtrudeGeometry(archShape, { depth: 8.6, bevelEnabled: false, curveSegments: 20 });
    archExtrude.translate(0, 0, -4.3);
    const archMesh = new THREE.Mesh(archExtrude, m.sandstoneBuff);
    igGroup.add(archMesh);
    [-10.2, 10.2].forEach((px) => {
      addBox(igGroup, 3.6, 22.8, 9.2, m.sandstoneBuff, px, 13.8, 0);
      addBox(igGroup, 4.1, 0.85, 9.8, m.concreteLight, px, 25.4, 0);
      addBox(igGroup, 1.8, 8.2, 9.6, m.slateCut, px, 8.6, 0);
    });
    addBox(igGroup, 24.4, 0.95, 9.6, m.concreteLight, 0, 27.2, 0);
    addBox(igGroup, 23.4, 8.4, 8.8, m.sandstoneBuff, 0, 31.8, 0);
    addBox(igGroup, 26.0, 1.35, 10.4, m.sandstoneBuff, 0, 36.6, 0);
    addBox(igGroup, 24.2, 1.45, 9.6, m.qutabRedStone, 0, 38.0, 0);
    addBox(igGroup, 18.0, 1.1, 7.6, m.sandstoneBuff, 0, 39.2, 0);
    addBox(igGroup, 9.8, 1.7, 6.8, m.sandstoneBuff, 0, 40.5, 0);
    const igDome = new THREE.Mesh(new THREE.CylinderGeometry(1.1, 2.8, 1.9, 16), m.qutabRedStone);
    igDome.position.set(0, 42.2, 0);
    igGroup.add(igDome);
    registerMonument('India Gate', igGroup, igPos, 5000);

    // 4C. Netaji Subhash Chandra Bose Canopy Pavilion (Kartavya Path Circle East of India Gate [77.23125, 28.6126])
    const ncPos = toLocalMeters([77.23125, 28.6126], 0);
    const ncGroup = new THREE.Group();
    ncGroup.position.set(ncPos.x, 0, ncPos.z);
    const ncApron = new THREE.Mesh(new THREE.CylinderGeometry(9.8, 10.4, 0.28, 16), m.plazaPave);
    ncApron.position.y = 0.22;
    const ncSteps = new THREE.Mesh(new THREE.CylinderGeometry(6.4, 7.1, 0.72, 8), m.sandstoneBuff);
    ncSteps.position.y = 0.68;
    const ncBase = new THREE.Mesh(new THREE.CylinderGeometry(4.2, 4.5, 0.78, 8), m.qutabRedStone);
    ncBase.position.y = 1.38;
    ncGroup.add(ncApron, ncSteps, ncBase);
    // 4 Carved Lutyens Sandstone Columns
    [[-2.5, -2.5], [2.5, -2.5], [-2.5, 2.5], [2.5, 2.5]].forEach(([cx, cz]) => {
      addBox(ncGroup, 0.85, 8.6, 0.85, m.sandstoneBuff, cx, 5.9, cz);
      addBox(ncGroup, 1.15, 0.55, 1.15, m.qutabRedStone, cx, 10.2, cz);
    });
    // Chhatri Cornice & Domed Cupola
    addBox(ncGroup, 8.8, 0.65, 8.8, m.qutabRedStone, 0, 10.8, 0);
    addBox(ncGroup, 6.8, 1.25, 6.8, m.sandstoneBuff, 0, 11.7, 0);
    const ncDome = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 3.2, 2.8, 16), m.qutabRedStone);
    ncDome.position.y = 13.7;
    const ncFinial = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.22, 1.4, 8), m.brassGold);
    ncFinial.position.y = 15.7;
    // Black-granite pedestal & heroic statue inside canopy
    addBox(ncGroup, 1.5, 2.2, 1.5, m.slateDark, 0, 2.8, 0);
    addBox(ncGroup, 0.72, 2.6, 0.56, m.bronzeStatue, 0, 5.2, 0);
    ncGroup.add(ncDome, ncFinial);
    registerMonument('Netaji Canopy', ncGroup, ncPos, 4500);

    // 4D. Humayun's Tomb (Mughal Red Sandstone & White Marble Onion Dome at [77.2507, 28.5933])
    const htPos = toLocalMeters([77.2507, 28.5933], 0);
    const htGroup = new THREE.Group();
    htGroup.position.set(htPos.x, 0, htPos.z);
    addBox(htGroup, 42, 0.26, 42, m.plazaPave, 0, 0.20, 0);
    addBox(htGroup, 34, 3.4, 34, m.qutabRedStone, 0, 1.9, 0);
    addBox(htGroup, 34.6, 0.52, 34.6, m.sandstoneBuff, 0, 3.7, 0);
    // Main mausoleum chamber + beveled octagonal mass
    addBox(htGroup, 21.5, 9.8, 15.8, m.qutabRedStone, 0, 8.8, 0);
    addBox(htGroup, 15.8, 9.8, 21.5, m.qutabRedStone, 0, 8.8, 0);
    addBox(htGroup, 18.8, 9.8, 18.8, m.qutabRedStone, 0, 8.8, 0);
    addBox(htGroup, 21.8, 0.6, 16.0, m.whiteMarble, 0, 13.7, 0);
    addBox(htGroup, 16.0, 0.6, 21.8, m.whiteMarble, 0, 13.7, 0);
    // Grand recessed Pishtaq portals (N/S/E/W)
    addBox(htGroup, 22.1, 6.8, 6.2, m.slateDark, 0, 7.2, 0);
    addBox(htGroup, 6.2, 6.8, 22.1, m.slateDark, 0, 7.2, 0);
    // 4 Corner Rooftop Chhatri Kiosks
    [[-6.8, -6.8], [6.8, -6.8], [-6.8, 6.8], [6.8, 6.8]].forEach(([kx, kz]) => {
      addBox(htGroup, 2.8, 2.9, 2.8, m.sandstoneBuff, kx, 15.4, kz);
      const kd = new THREE.Mesh(new THREE.SphereGeometry(1.65, 10, 8), m.whiteMarble);
      kd.position.set(kx, 17.5, kz);
      htGroup.add(kd);
    });
    // High Marble Drum + Iconic Double Onion Dome + Kalash Spire
    const htDrum = new THREE.Mesh(new THREE.CylinderGeometry(5.6, 5.9, 3.6, 20), m.whiteMarble);
    htDrum.position.y = 15.7;
    const htDome = new THREE.Mesh(new THREE.SphereGeometry(6.1, 20, 14), m.whiteMarble);
    htDome.scale.set(1.0, 1.18, 1.0);
    htDome.position.y = 20.6;
    const htSpire = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.36, 3.6, 8), m.brassGold);
    htSpire.position.y = 28.6;
    htGroup.add(htDrum, htDome, htSpire);
    registerMonument("Humayun's Tomb", htGroup, htPos, 4800);

    // 4E. Red Fort / Lal Qila Lahori Gate Bastion ([77.2410, 28.6559] facing West down Chandni Chowk)
    const rfPos = toLocalMeters([77.2410, 28.6559], 0);
    const rfGroup = new THREE.Group();
    rfGroup.position.set(rfPos.x, 0, rfPos.z);
    addBox(rfGroup, 16.0, 0.30, 52.0, m.plazaPave, -2.0, 0.22, 0);
    // Curtain Rampart Wall & Crenelated Merlon Battlements
    addBox(rfGroup, 7.4, 13.8, 44.0, m.qutabRedStone, 2.0, 6.9, 0);
    addBox(rfGroup, 7.9, 0.70, 44.6, m.sandstoneBuff, 2.0, 13.9, 0);
    for (let mz = -20.5; mz <= 20.5; mz += 2.7) {
      addBox(rfGroup, 1.0, 1.5, 1.4, m.qutabRedStone, -1.2, 14.9, mz);
    }
    // Flanking Octagonal Bastion Towers
    [-19.5, 19.5].forEach((bz) => {
      const bst = new THREE.Mesh(new THREE.CylinderGeometry(4.6, 5.4, 15.6, 10), m.qutabRedStone);
      bst.position.set(-1.5, 7.8, bz);
      rfGroup.add(bst);
    });
    // Central Lahori Gatehouse Keep + Grand West-Facing Vaulted Arch + Twin White Chhatris
    addBox(rfGroup, 10.8, 18.2, 13.4, m.qutabRedStone, -0.5, 9.1, 0);
    addBox(rfGroup, 1.8, 9.4, 6.2, m.slateDark, -5.6, 5.2, 0);
    addBox(rfGroup, 11.8, 0.85, 14.4, m.sandstoneBuff, -0.5, 18.2, 0);
    [-3.6, 3.6].forEach((cz) => {
      addBox(rfGroup, 3.2, 3.2, 3.2, m.sandstoneBuff, -1.2, 20.0, cz);
      const md = new THREE.Mesh(new THREE.SphereGeometry(2.0, 12, 10), m.whiteMarble);
      md.scale.set(1.0, 1.15, 1.0);
      md.position.set(-1.2, 22.3, cz);
      const mf = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.18, 1.4, 8), m.brassGold);
      mf.position.set(-1.2, 25.0, cz);
      rfGroup.add(md, mf);
    });
    // Lahori Gate Mast Flagpole + Tricolor Accent
    addBox(rfGroup, 0.28, 8.8, 0.28, m.steelChrome, -3.5, 22.8, 0);
    addBox(rfGroup, 0.16, 0.65, 3.4, new THREE.MeshBasicMaterial({ color: 0xFF9933 }), -3.5, 26.8, 1.8);
    addBox(rfGroup, 0.16, 0.65, 3.4, m.whiteMarble, -3.5, 26.15, 1.8);
    addBox(rfGroup, 0.16, 0.65, 3.4, new THREE.MeshBasicMaterial({ color: 0x138808 }), -3.5, 25.5, 1.8);
    // 4E. Indian Railways Terminal Hubs: New Delhi Railway Station (NDLS) & Old Delhi Junction (DLI + Lothian Rail Bridge)
    const buildIndianRailwaysHubs = () => {
      const irBlueRoof = new THREE.MeshStandardMaterial({ color: 0x1D4ED8, roughness: 0.44, metalness: 0.24, side: THREE.DoubleSide });
      const irTerracottaRoof = new THREE.MeshStandardMaterial({ color: 0xB4533C, roughness: 0.52, metalness: 0.14, side: THREE.DoubleSide });
      const irPlatDeck = new THREE.MeshLambertMaterial({ color: 0xB8BFC9 });
      const irGraniteEdge = new THREE.MeshLambertMaterial({ color: 0x334155 });
      const irBallastMat = new THREE.MeshLambertMaterial({ color: 0x9C9486 });
      const irLhbRed = new THREE.MeshStandardMaterial({ color: 0xB91C1C, roughness: 0.36, metalness: 0.26 });
      const irCoachGrey = new THREE.MeshStandardMaterial({ color: 0xCBD5E1, roughness: 0.34, metalness: 0.45 });
      const irIcfBlue = new THREE.MeshStandardMaterial({ color: 0x1E40AF, roughness: 0.40, metalness: 0.24 });
      const irVbWhite = new THREE.MeshStandardMaterial({ color: 0xF8FAFC, roughness: 0.28, metalness: 0.24 });
      const irCoachGlass = new THREE.MeshLambertMaterial({ color: 0x0F172A });
      const irGirderSteel = new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.46, metalness: 0.58 });
      const irTrussLight = new THREE.MeshStandardMaterial({ color: 0x94A3B8, roughness: 0.36, metalness: 0.60 });

      const addIrBox = (grp, w, h, d, mat, x, y, z, rx = 0, ry = 0) => {
        const mesh = new THREE.Mesh(g.box1, mat);
        mesh.scale.set(w, h, d);
        mesh.position.set(x, y, z);
        if (rx) mesh.rotation.x = rx;
        if (ry) mesh.rotation.y = ry;
        mesh.castShadow = h > 1.2 && w > 1.5;
        mesh.receiveShadow = true;
        grp.add(mesh);
        return mesh;
      };

      const addIrPlatformWithShed = (grp, px, pz, widthM, platLenM, shedLenM, roofMat) => {
        // Granite platform apron plinth + crisp light concrete top deck + dark coping edges + yellow tactile strip
        addIrBox(grp, widthM, 0.72, platLenM, irGraniteEdge, px, 0.36, pz);
        addIrBox(grp, Math.max(1.2, widthM - 0.12), 0.24, platLenM, irPlatDeck, px, 0.84, pz);
        addIrBox(grp, 0.34, 0.08, platLenM, irGraniteEdge, px - widthM * 0.5 + 0.17, 0.96, pz);
        addIrBox(grp, 0.34, 0.08, platLenM, irGraniteEdge, px + widthM * 0.5 - 0.17, 0.96, pz);
        addIrBox(grp, 0.30, 0.07, platLenM, m.tactileYellow, px - widthM * 0.5 + 0.52, 0.97, pz);
        addIrBox(grp, 0.30, 0.07, platLenM, m.tactileYellow, px + widthM * 0.5 - 0.52, 0.97, pz);
        // Pitched corrugated shed canopy
        const wingW = widthM * 0.52 + 0.6;
        const slope = 0.20;
        addIrBox(grp, wingW, 0.16, shedLenM, roofMat, px - wingW * 0.48, 5.15, pz, 0, 0);
        grp.children[grp.children.length - 1].rotation.z = slope;
        addIrBox(grp, wingW, 0.16, shedLenM, roofMat, px + wingW * 0.48, 5.15, pz, 0, 0);
        grp.children[grp.children.length - 1].rotation.z = -slope;
        addIrBox(grp, 1.35, 0.14, shedLenM, m.skylightGlass, px, 5.56, pz);
        for (let cz = -shedLenM * 0.46; cz <= shedLenM * 0.46; cz += 26) {
          addIrBox(grp, 0.32, 4.4, 0.32, irTrussLight, px, 3.05, pz + cz);
        }
        // Furnish exposed platform aprons past shed ends with mast lamps & IR shelters so no bare concrete slabs appear
        const halfP = platLenM * 0.5;
        const halfS = shedLenM * 0.5;
        if (halfP - halfS > 14) {
          [-1, 1].forEach((dir) => {
            for (let lz = halfS + 14; lz < halfP - 10; lz += 28) {
              const pzTip = pz + dir * lz;
              addIrBox(grp, 0.24, 4.2, 0.24, irTrussLight, px, 3.0, pzTip);
              addIrBox(grp, 1.8, 0.14, 0.42, irVbWhite, px, 5.05, pzTip);
              addIrBox(grp, 1.1, 0.55, 3.2, irGirderSteel, px, 1.24, pzTip);
            }
          });
        }
      };

      const addIrFOB = (grp, minX, maxX, fz, fobMat) => {
        const spanW = (maxX - minX) + 14;
        const cx = (minX + maxX) * 0.5;
        addIrBox(grp, spanW, 0.42, 4.4, m.concreteLight, cx, 7.6, fz);
        addIrBox(grp, spanW, 0.16, 4.8, fobMat, cx, 10.1, fz);
        addIrBox(grp, spanW, 0.26, 0.26, irGirderSteel, cx, 8.95, fz - 2.15);
        addIrBox(grp, spanW, 0.26, 0.26, irGirderSteel, cx, 8.95, fz + 2.15);
        for (let sx = minX; sx <= maxX; sx += 28) {
          addIrBox(grp, 0.38, 7.6, 0.38, irGirderSteel, sx, 3.8, fz - 1.9);
          addIrBox(grp, 0.38, 7.6, 0.38, irGirderSteel, sx, 3.8, fz + 1.9);
        }
      };

      const addIrOHEGantry = (grp, minX, maxX, oz) => {
        const spanW = (maxX - minX) + 8;
        const cx = (minX + maxX) * 0.5;
        addIrBox(grp, spanW, 0.32, 0.32, irTrussLight, cx, 6.25, oz);
        for (let mx = minX; mx <= maxX + 1; mx += 22) {
          addIrBox(grp, 0.30, 6.3, 0.30, irTrussLight, mx, 3.15, oz);
        }
      };

      const addIndianExpressRake = (grp, tx, cz, numCoaches, livery, flipped) => {
        const coachLen = 22.0;
        const gap = 0.7;
        const stride = coachLen + gap;
        const total = numCoaches * stride;
        const zStart = -total * 0.5 + coachLen * 0.5;
        const dirSgn = flipped ? -1 : 1;
        const bodyMat = livery === 'rajdhani' ? irLhbRed : (livery === 'vande' ? irVbWhite : irIcfBlue);
        const roofMat = livery === 'vande' ? irIcfBlue : irCoachGrey;

        for (let c = 0; c < numCoaches; c++) {
          const zc = cz + dirSgn * (zStart + c * stride);
          const isLoco = c === 0 && livery !== 'vande';
          const len = isLoco ? 19.6 : coachLen;
          addIrBox(grp, 3.15, 0.55, len, irGirderSteel, tx, 0.48, zc);
          addIrBox(grp, 3.10, 2.55, len, isLoco ? irCoachGrey : bodyMat, tx, 2.02, zc);
          addIrBox(grp, 2.75, 0.32, len - 0.6, roofMat, tx, 3.44, zc);
          if (isLoco) {
            addIrBox(grp, 3.14, 0.65, len - 1.2, irLhbRed, tx, 2.05, zc);
            addIrBox(grp, 2.35, 0.75, 0.25, irCoachGlass, tx, 2.55, zc - dirSgn * (len * 0.49));
            addIrBox(grp, 1.4, 0.65, 1.8, irLhbRed, tx, 3.92, zc - dirSgn * 4.2);
          } else {
            addIrBox(grp, 3.14, 0.75, len - 1.8, irCoachGlass, tx, 2.35, zc);
            if (livery === 'vande') {
              addIrBox(grp, 3.14, 0.36, len - 0.8, irIcfBlue, tx, 1.25, zc);
            } else if (livery === 'rajdhani') {
              addIrBox(grp, 3.14, 0.36, len - 0.8, irCoachGrey, tx, 1.25, zc);
            }
          }
        }
      };

      const makeHubLocalMapper = (anchorCoord, startCoord, endCoord) => {
        const anchor = toLocalMeters(anchorCoord, 0);
        const p0 = toLocalMeters(startCoord, 0);
        const p1 = toLocalMeters(endCoord, 0);
        const tan = p1.clone().sub(p0).normalize();
        tan.y = 0;
        const grp = new THREE.Group();
        grp.position.set(anchor.x, 0, anchor.z);
        grp.rotation.y = Math.atan2(tan.x, tan.z);
        const toLocalXZ = (lngLat) => {
          const dp = toLocalMeters(lngLat, 0).sub(anchor);
          return {
            x: dp.x * tan.z - dp.z * tan.x,
            z: dp.x * tan.x + dp.z * tan.z
          };
        };
        return { anchor, grp, toLocalXZ };
      };

      // A) New Delhi Railway Station (NDLS) — PF 1..16 aligned to exact OSM vector platform & rail coordinates
      const ndls = makeHubLocalMapper([77.22058, 28.6420], [77.21995, 28.6448], [77.22098, 28.6393]);
      const ndlsPlatformSpecs = [
        { lng: 77.219666, lat: 28.6420, w: 5.5, len: 375, shed: 315, zOff: -125 },
        { lng: 77.219904, lat: 28.6420, w: 8.6, len: 390, shed: 335, zOff: -95 },
        { lng: 77.220108, lat: 28.6420, w: 7.4, len: 385, shed: 325, zOff: -70 },
        { lng: 77.220353, lat: 28.6420, w: 8.8, len: 395, shed: 340, zOff: -35 },
        { lng: 77.220627, lat: 28.6420, w: 7.6, len: 385, shed: 325, zOff: -15 },
        { lng: 77.220832, lat: 28.6420, w: 8.6, len: 390, shed: 330, zOff: 5 },
        { lng: 77.221043, lat: 28.6420, w: 8.2, len: 385, shed: 325, zOff: 15 },
        { lng: 77.221323, lat: 28.6420, w: 9.2, len: 380, shed: 320, zOff: 22 },
        { lng: 77.221557, lat: 28.6420, w: 6.4, len: 360, shed: 305, zOff: 10 }
      ];
      let ndlsMinX = Infinity;
      let ndlsMaxX = -Infinity;
      ndlsPlatformSpecs.forEach((ps) => {
        const pt = ndls.toLocalXZ([ps.lng, ps.lat]);
        ndlsMinX = Math.min(ndlsMinX, pt.x);
        ndlsMaxX = Math.max(ndlsMaxX, pt.x);
        addIrPlatformWithShed(ndls.grp, pt.x, ps.zOff, ps.w, ps.len, ps.shed, irBlueRoof);
      });
      // Main Paharganj & Ajmeri Gate concourse buildings + central passenger air-concourse bridge
      const ndlsCx = (ndlsMinX + ndlsMaxX) * 0.5;
      const ndlsFullSpan = (ndlsMaxX - ndlsMinX) + 12;
      addIrBox(ndls.grp, 10.5, 11.2, 130, m.concreteLight, ndlsMinX - 8.5, 5.6, -75);
      addIrBox(ndls.grp, 11.2, 2.4, 132, irBlueRoof, ndlsMinX - 8.5, 11.6, -75);
      addIrBox(ndls.grp, ndlsFullSpan, 3.6, 16.0, m.skylightGlass, ndlsCx, 9.6, -15);
      addIrBox(ndls.grp, ndlsFullSpan, 0.45, 16.8, irBlueRoof, ndlsCx, 11.5, -15);
      [-135, -15, 105].forEach((fz) => addIrFOB(ndls.grp, ndlsMinX, ndlsMaxX, fz, irBlueRoof));
      [-285, -245, 200, 245].forEach((oz) => addIrOHEGantry(ndls.grp, ndlsMinX, ndlsMaxX, oz));
      // Shared Rail-Over-Metro Steel Plate-Girder Bridge Deck (vaults above y=1.38m Yellow Line cutaway coping with ballast + sleepers + twin steel rails)
      const addRailBridgeTrackDeck = (grp, bx, bz, yaw, spanLen = 28.0, deckWidth = 5.4) => {
        const deckY = 1.62;
        const hw = deckWidth * 0.48;
        const sx = Math.sin(yaw);
        const cz = Math.cos(yaw);
        addIrBox(grp, deckWidth, 0.34, spanLen, irGirderSteel, bx, deckY, bz, 0, yaw);
        addIrBox(grp, deckWidth - 0.8, 0.14, spanLen - 0.4, irBallastMat, bx, deckY + 0.22, bz, 0, yaw);
        addIrBox(grp, 0.36, 1.08, spanLen, irTrussLight, bx - cz * hw, deckY + 0.52, bz + sx * hw, 0, yaw);
        addIrBox(grp, 0.36, 1.08, spanLen, irTrussLight, bx + cz * hw, deckY + 0.52, bz - sx * hw, 0, yaw);
        [-0.92, 0.92].forEach((rOff) => {
          addIrBox(grp, 0.16, 0.14, spanLen - 0.6, irGirderSteel, bx + cz * rOff, deckY + 0.36, bz - sx * rOff, 0, yaw);
        });
        for (let t = -spanLen * 0.44; t <= spanLen * 0.44; t += 1.65) {
          addIrBox(grp, 2.7, 0.09, 0.34, irTerracottaRoof, bx + sx * t, deckY + 0.30, bz + cz * t, 0, yaw);
        }
        // End abutment piers outside trench edges
        [-spanLen * 0.44, spanLen * 0.44].forEach((aOff) => {
          addIrBox(grp, deckWidth - 0.4, deckY - 0.1, 1.4, irGirderSteel, bx + sx * aOff, (deckY - 0.1) * 0.5, bz + cz * aOff, 0, yaw);
        });
      };
      const ndlsCrossPts = [
        { ll: [77.22114, 28.63827], relYaw: 0.24, len: 30.0, w: 6.2 },
        { ll: [77.22156, 28.63956], relYaw: -0.18, len: 30.0, w: 6.8 }
      ];
      ndlsCrossPts.forEach((c) => {
        const bp = ndls.toLocalXZ(c.ll);
        addRailBridgeTrackDeck(ndls.grp, bp.x, bp.z, c.relYaw, c.len, c.w);
      });
      [
        { lat: 28.6420, lng: 77.219785, zOff: -115, coaches: 8, livery: 'vande', flip: false },
        { lat: 28.6420, lng: 77.220221, zOff: -65, coaches: 9, livery: 'rajdhani', flip: true },
        { lat: 28.6420, lng: 77.220494, zOff: -15, coaches: 8, livery: 'shatabdi', flip: false },
        { lat: 28.6420, lng: 77.220935, zOff: 12, coaches: 8, livery: 'rajdhani', flip: true },
        { lat: 28.6420, lng: 77.221205, zOff: 22, coaches: 7, livery: 'vande', flip: false }
      ].forEach((tr) => {
        const tp = ndls.toLocalXZ([tr.lng, tr.lat]);
        addIndianExpressRake(ndls.grp, tp.x, tr.zOff, tr.coaches, tr.livery, tr.flip);
      });
      if (window.MetroKit && window.MetroKit.TrainFactory && window.MetroKit.TrainFactory.mergeGroupByMaterial) {
        window.MetroKit.TrainFactory.mergeGroupByMaterial(ndls.grp);
      }
      registerMonument('New Delhi Railway Station (NDLS)', ndls.grp, ndls.anchor, 3200);

      // B) Old Delhi Railway Station (DLI) & Lothian Steel Rail Bridge over Yellow Line Cutaway
      const dli = makeHubLocalMapper([77.2290, 28.66155], [77.2248, 28.66185], [77.2328, 28.66120]);
      const dliPlatLats = [28.66114, 28.66136, 28.66158, 28.66188];
      let dliMinX = Infinity;
      let dliMaxX = -Infinity;
      dliPlatLats.forEach((lat, idx) => {
        const pt = dli.toLocalXZ([77.2279, lat]);
        dliMinX = Math.min(dliMinX, pt.x);
        dliMaxX = Math.max(dliMaxX, pt.x);
        addIrPlatformWithShed(dli.grp, pt.x, pt.z, idx === 0 ? 6.2 : 7.4, 285, 200, idx % 2 === 0 ? irTerracottaRoof : irBlueRoof);
      });
      [-70, 55].forEach((fz) => addIrFOB(dli.grp, dliMinX - 8, dliMaxX + 22, fz, irTerracottaRoof));
      [-150, -90, 20, 75, 165, 220].forEach((oz) => addIrOHEGantry(dli.grp, dliMinX - 8, dliMaxX + 26, oz));
      // Lothian Rail-Over-Metro steel deck girder spans carrying Indian Railways tracks across Yellow Line cutaway!
      const crossSmp = samples.find((s) => {
        const ll = localMetersToLngLat(s.pos);
        return ll[1] >= 28.6613 && ll[1] <= 28.6620 && ll[0] > 77.227 && ll[0] < 77.231;
      });
      if (crossSmp) {
        const crossLL = localMetersToLngLat(crossSmp.pos);
        const bridgeCenter = dli.toLocalXZ([crossLL[0], 28.66168]);
        [28.66126, 28.66150, 28.66176, 28.66202].forEach((bLat) => {
          const bp = dli.toLocalXZ([crossLL[0], bLat]);
          addRailBridgeTrackDeck(dli.grp, bp.x, bridgeCenter.z, 0, 38.0, 9.2);
        });
        addIrOHEGantry(dli.grp, dliMinX - 8, dliMaxX + 26, bridgeCenter.z - 19);
        addIrOHEGantry(dli.grp, dliMinX - 8, dliMaxX + 26, bridgeCenter.z + 19);
      }
      [
        { lat: 28.66125, zOff: -45, coaches: 8, livery: 'rajdhani', flip: false },
        { lat: 28.66147, zOff: -35, coaches: 8, livery: 'shatabdi', flip: true },
        { lat: 28.66173, zOff: -25, coaches: 8, livery: 'vande', flip: false }
      ].forEach((tr) => {
        const tp = dli.toLocalXZ([77.2279, tr.lat]);
        addIndianExpressRake(dli.grp, tp.x, tr.zOff, tr.coaches, tr.livery, tr.flip);
      });
      if (window.MetroKit && window.MetroKit.TrainFactory && window.MetroKit.TrainFactory.mergeGroupByMaterial) {
        window.MetroKit.TrainFactory.mergeGroupByMaterial(dli.grp);
      }
      registerMonument('Old Delhi Junction (DLI)', dli.grp, dli.anchor, 3200);

      // B2) INA / Jor Bagh Ring Railway Steel Rail-Over-Metro Bridge ([77.21124, 28.58008])
      const inaBridge = makeHubLocalMapper([77.21124, 28.58008], [77.2096, 28.58015], [77.2128, 28.58000]);
      [-2.6, 2.6].forEach((bx) => {
        addRailBridgeTrackDeck(inaBridge.grp, bx, 0, 0, 34.0, 4.4);
      });
      addIrOHEGantry(inaBridge.grp, -5.0, 5.0, -17);
      addIrOHEGantry(inaBridge.grp, -5.0, 5.0, 17);
      if (window.MetroKit && window.MetroKit.TrainFactory && window.MetroKit.TrainFactory.mergeGroupByMaterial) {
        window.MetroKit.TrainFactory.mergeGroupByMaterial(inaBridge.grp);
      }
      registerMonument('INA Ring Rail Bridge', inaBridge.grp, inaBridge.anchor, 2200);

      // C) All Delhi Indian Railways Terminals, Junctions, Corridor & Ring Stations (built lazily on approach)
      const irFacadeCream = new THREE.MeshLambertMaterial({ color: 0xF1ECE1 });
      const irFacadeSand = new THREE.MeshLambertMaterial({ color: 0xC86B4B });
      INDIA_RAILWAY_HUBS.forEach((hub) => {
        if (!hub.p0 || !hub.p1 || !hub.pfs) return;
        const anchor = toLocalMeters(hub.coords, 0);
        registerLazyMonument(`${hub.name} (${hub.code})`, anchor, hub.cull || 2000, () => {
          const mHub = makeHubLocalMapper(hub.coords, hub.p0, hub.p1);
          const roofMat = hub.roof === 'terra' ? irTerracottaRoof : irBlueRoof;
          const pLen = hub.pLen || 200;
          const sLen = hub.sLen || 110;
          hub.pfs.forEach(([px, pw]) => {
            addIrPlatformWithShed(mHub.grp, px, 0, pw, pLen, sLen, roofMat);
          });
          // Station concourse / IR heritage portico on PF 1 side
          if (typeof hub.minX === 'number') {
            if (hub.tier === 'terminal' || hub.tier === 'major') {
              const bx = hub.minX - 4.4;
              const bl = Math.min(sLen * 0.56, hub.tier === 'terminal' ? 96 : 56);
              addIrBox(mHub.grp, 7.6, 8.2, bl, irFacadeCream, bx, 4.1, 0);
              addIrBox(mHub.grp, 8.0, 2.0, bl + 1.0, irFacadeSand, bx, 7.2, 0);
              addIrBox(mHub.grp, 8.4, 0.35, bl + 1.6, roofMat, bx, 8.4, 0);
              addIrBox(mHub.grp, 2.8, 4.2, Math.min(28, bl * 0.45), m.skylightGlass, bx + 2.8, 2.3, 0);
            } else if (hub.tier === 'station') {
              const bx = hub.minX - 2.6;
              addIrBox(mHub.grp, 4.4, 5.4, 28, irFacadeCream, bx, 2.7, 0);
              addIrBox(mHub.grp, 4.8, 0.9, 29, irFacadeSand, bx, 5.2, 0);
            } else {
              const pf0 = hub.pfs[0];
              if (pf0) addIrBox(mHub.grp, 2.4, 3.0, 12, irFacadeSand, pf0[0] - 0.6, 2.4, 0);
            }
          }
          // Spanning Steel Foot-Over-Bridges
          const minFx = typeof hub.minX === 'number' ? hub.minX + 2 : -10;
          const maxFx = typeof hub.maxX === 'number' ? hub.maxX - 2 : 10;
          if (hub.pfs.length >= 2) {
            const fobZs = (hub.tier === 'terminal' || hub.tier === 'major')
              ? [-sLen * 0.30, sLen * 0.30]
              : [0];
            fobZs.forEach((fz) => addIrFOB(mHub.grp, minFx, maxFx, fz, roofMat));
          }
          // 25kV OHE overhead electrification gantries
          const oheZs = (hub.tier === 'terminal' || hub.tier === 'major')
            ? [-pLen * 0.48, -pLen * 0.26, pLen * 0.26, pLen * 0.48]
            : [-pLen * 0.44, pLen * 0.44];
          oheZs.forEach((oz) => addIrOHEGantry(mHub.grp, minFx, maxFx, oz));
          // Halting Indian Express / EMU trains aligned to measured OpenFreeMap track lanes
          if (Array.isArray(hub.trains)) {
            hub.trains.forEach(([tx, zOff, coaches, livery, flip]) => {
              addIndianExpressRake(mHub.grp, tx, zOff, coaches, livery, Boolean(flip));
            });
          }
          if (window.MetroKit && window.MetroKit.TrainFactory && window.MetroKit.TrainFactory.mergeGroupByMaterial) {
            window.MetroKit.TrainFactory.mergeGroupByMaterial(mHub.grp);
          }
          return mHub.grp;
        });
      });
    };
    buildIndianRailwaysHubs();

    // 4F. Swaminarayan Akshardham Temple Complex ([77.2773, 28.6127] beside Akshardham Station)
    const buildAkshardhamTemple = () => {
      const akPos = toLocalMeters([77.2773, 28.6127], 0);
      registerLazyMonument('Akshardham Temple', akPos, 6500, () => {
        const akGroup = new THREE.Group();
        akGroup.position.set(akPos.x, 0, akPos.z);

        const pinkStone = m.sandstoneBuff;
        const redStone = m.qutabRedStone;
        const goldMat = m.brassGold;
        const poolWater = new THREE.MeshStandardMaterial({
          color: 0x0284C7,
          roughness: 0.12,
          metalness: 0.88,
          transparent: true,
          opacity: 0.82
        });

        // 1. Sprawling Landscaped Courtyard & Sacred Lake
        addBox(akGroup, 140, 0.35, 120, m.plazaPave, 0, 0.20, 0);
        addBox(akGroup, 134, 0.40, 114, m.sagePark, 0, 0.22, 0);

        // 2. Yagnapurush Kund (Sacred Lotus Stepwell / Reflection Pool)
        addBox(akGroup, 52, 0.45, 42, m.slateDark, -36, 0.24, 0);
        addBox(akGroup, 48, 0.25, 38, poolWater, -36, 0.38, 0);
        for (let st = 1; st <= 3; st++) {
          addBox(akGroup, 52 - st * 2.4, 0.20, 42 - st * 2.4, pinkStone, -36, 0.24 + st * 0.10, 0);
        }

        // 3. Monumental Stepped Plinth (Gajendra Pitha)
        addBox(akGroup, 78, 1.8, 62, pinkStone, 12, 1.0, 0);
        addBox(akGroup, 72, 1.4, 56, redStone, 12, 2.4, 0);
        addBox(akGroup, 66, 0.8, 50, pinkStone, 12, 3.5, 0);

        // 4. Central Mandir Body (Carved Rajasthani Pink Sandstone)
        addBox(akGroup, 48, 11.5, 38, pinkStone, 12, 9.6, 0);
        addBox(akGroup, 42, 12.0, 44, pinkStone, 12, 9.6, 0);
        addBox(akGroup, 50, 1.2, 40, redStone, 12, 15.6, 0);

        [[-22, -18], [-22, 18], [46, -18], [46, 18], [-22, 0], [46, 0]].forEach(([cx, cz]) => {
          for (let pz = -3; pz <= 3; pz += 3) {
            addBox(akGroup, 0.9, 8.5, 0.9, pinkStone, 12 + cx, 8.0, cz + pz);
            addBox(akGroup, 1.3, 0.6, 1.3, redStone, 12 + cx, 12.4, cz + pz);
          }
        });

        // 5. Grand Central Shikhara Spire (Towering 43m Landmark)
        const drum = new THREE.Mesh(new THREE.CylinderGeometry(8.2, 9.4, 6.5, 16), pinkStone);
        drum.position.set(12, 19.2, 0);
        akGroup.add(drum);

        const shikharaTiers = [
          { rB: 7.8, rT: 6.2, h: 7.0, y: 24.5 },
          { rB: 6.0, rT: 4.4, h: 6.0, y: 30.5 },
          { rB: 4.2, rT: 2.6, h: 5.5, y: 35.8 },
          { rB: 2.5, rT: 1.2, h: 4.0, y: 40.0 }
        ];
        shikharaTiers.forEach((tier) => {
          const cone = new THREE.Mesh(new THREE.CylinderGeometry(tier.rT, tier.rB, tier.h, 16), pinkStone);
          cone.position.set(12, tier.y, 0);
          akGroup.add(cone);
          for (let fi = 0; fi < 8; fi++) {
            const ang = (fi / 8) * Math.PI * 2;
            const rM = (tier.rB + tier.rT) * 0.5;
            const facet = addBox(akGroup, 0.5, tier.h - 0.4, 0.5, redStone, 12 + Math.cos(ang) * rM, tier.y, Math.sin(ang) * rM);
            facet.rotation.y = -ang;
          }
        });

        const amalaka = new THREE.Mesh(new THREE.CylinderGeometry(2.4, 2.6, 1.4, 16), redStone);
        amalaka.position.set(12, 42.6, 0);
        const kalash = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 1.1, 4.2, 12), goldMat);
        kalash.position.set(12, 45.0, 0);
        akGroup.add(amalaka, kalash);

        // 6. 8 Subsidiary Flanking Shikharas & Mandapam Domes
        const subSpireOffsets = [
          [-14, -12], [14, -12], [-14, 12], [14, 12],
          [-20, 0], [20, 0], [0, -16], [0, 16]
        ];
        subSpireOffsets.forEach(([sx, sz]) => {
          const subSpire = new THREE.Mesh(new THREE.CylinderGeometry(0.8, 3.4, 11.5, 12), pinkStone);
          subSpire.position.set(12 + sx, 21.5, sz);
          const subGold = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.6, 2.2, 8), goldMat);
          subGold.position.set(12 + sx, 27.8, sz);
          akGroup.add(subSpire, subGold);
        });

        // 7. Colonnaded Parikrama Cloister (Perimeter Arched Gallery)
        const parW = 126;
        const parD = 104;
        [
          { x: 12, z: -parD * 0.5, w: parW, d: 7.2 },
          { x: 12, z: parD * 0.5, w: parW, d: 7.2 },
          { x: 12 - parW * 0.5, z: 0, w: 7.2, d: parD },
          { x: 12 + parW * 0.5, z: 0, w: 7.2, d: parD }
        ].forEach((wall) => {
          addBox(akGroup, wall.w, 5.8, wall.d, pinkStone, wall.x, 3.2, wall.z);
          addBox(akGroup, wall.w + 0.6, 1.2, wall.d + 0.6, redStone, wall.x, 6.4, wall.z);
          if (wall.w > 20) {
            for (let kx = -wall.w * 0.45; kx <= wall.w * 0.45; kx += 16) {
              const ch = new THREE.Mesh(new THREE.SphereGeometry(1.6, 10, 8), redStone);
              ch.scale.set(1.0, 1.3, 1.0);
              ch.position.set(wall.x + kx, 8.2, wall.z);
              akGroup.add(ch);
            }
          }
        });

        // 8. Grand Mayur Dwar (Peacock Gateway Entryway)
        addBox(akGroup, 24, 9.5, 12, redStone, 12, 5.0, -parD * 0.5);
        addBox(akGroup, 8.2, 6.2, 13, m.slateDark, 12, 3.3, -parD * 0.5);
        addBox(akGroup, 26, 1.2, 14, pinkStone, 12, 10.2, -parD * 0.5);
        const gateDome = new THREE.Mesh(new THREE.SphereGeometry(3.6, 12, 10), goldMat);
        gateDome.scale.set(1.0, 1.25, 1.0);
        gateDome.position.set(12, 13.5, -parD * 0.5);
        akGroup.add(gateDome);

        return akGroup;
      });
    };
    buildAkshardhamTemple();
  }

  function pointInRing2D(px, pz, ring) {
    let inside = false;
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      const xi = ring[i].x, zi = ring[i].z;
      const xj = ring[j].x, zj = ring[j].z;
      if (((zi > pz) !== (zj > pz)) && (px < ((xj - xi) * (pz - zi)) / (zj - zi + 1e-9) + xi)) {
        inside = !inside;
      }
    }
    return inside;
  }

  function refreshDynamicParkTrees(force) {
    if (!map || !parkPool || !isReady) return;
    if (map.getZoom() < 13.8) {
      lastParkSig = '';
      parkPool.trunkInst.count = 0;
      parkPool.aoInst.count = 0;
      parkPool.crownInsts.forEach((ci) => { ci.count = 0; });
      return;
    }

    const cNow = map.getCenter();
    const omMgr = map.style && ((map.style.tileManagers && map.style.tileManagers['openmaptiles']) || (map.style.sourceCaches && map.style.sourceCaches['openmaptiles']));
    const omVisCount = omMgr && typeof omMgr.getVisibleCoordinates === 'function' ? omMgr.getVisibleCoordinates().length : 0;
    const parkSig = `${(cNow.lng * 2000) | 0},${(cNow.lat * 2000) | 0},${(map.getZoom() * 10) | 0},${Math.round(map.getBearing() / 8)},${Math.round(map.getPitch() / 5)},${omVisCount}`;
    if (!force && parkSig === lastParkSig) return;
    lastParkSig = parkSig;

    let feats = [];
    let waterRings = [];
    try {
      const queryLayers = ['park', 'landcover_wood', 'landcover_grass'].filter((id) => !!map.getLayer(id));
      if (!queryLayers.length) return;
      feats = map.queryRenderedFeatures({ layers: queryLayers }) || [];
      if (map.getLayer('water')) {
        const wFeats = map.queryRenderedFeatures({ layers: ['water'] }) || [];
        for (let wi = 0; wi < wFeats.length; wi++) {
          const wg = wFeats[wi].geometry;
          if (!wg) continue;
          const wPolys = wg.type === 'Polygon' ? [wg.coordinates] : (wg.type === 'MultiPolygon' ? wg.coordinates : []);
          for (let wp = 0; wp < wPolys.length; wp++) {
            const wOuter = wPolys[wp] && wPolys[wp][0];
            if (!wOuter || wOuter.length < 3) continue;
            let wMinX = Infinity, wMaxX = -Infinity, wMinZ = Infinity, wMaxZ = -Infinity;
            const ring = new Array(wOuter.length);
            for (let k = 0; k < wOuter.length; k++) {
              const p = toLocalMeters(wOuter[k], 0);
              ring[k] = p;
              if (p.x < wMinX) wMinX = p.x;
              if (p.x > wMaxX) wMaxX = p.x;
              if (p.z < wMinZ) wMinZ = p.z;
              if (p.z > wMaxZ) wMaxZ = p.z;
            }
            waterRings.push({ ring, minX: wMinX - 4, maxX: wMaxX + 4, minZ: wMinZ - 4, maxZ: wMaxZ + 4 });
          }
        }
      }
    } catch (_) {
      return;
    }

    const inWaterRing = (tx, tz) => {
      for (let i = 0; i < waterRings.length; i++) {
        const w = waterRings[i];
        if (tx >= w.minX && tx <= w.maxX && tz >= w.minZ && tz <= w.maxZ && pointInRing2D(tx, tz, w.ring)) {
          return true;
        }
      }
      return false;
    };

    const placed = [];
    const perShade = [[], [], [], []];
    const usedCells = new Set();
    const dummy = new THREE.Object3D();
    const stepM = map.getZoom() >= 16 ? 21 : 28;

    for (let fi = 0; fi < feats.length && placed.length < MAX_PARK_TREES; fi++) {
      const geom = feats[fi].geometry;
      if (!geom) continue;
      const polys = geom.type === 'Polygon' ? [geom.coordinates] : (geom.type === 'MultiPolygon' ? geom.coordinates : []);
      for (let pi = 0; pi < polys.length && placed.length < MAX_PARK_TREES; pi++) {
        const outer = polys[pi] && polys[pi][0];
        if (!outer || outer.length < 3) continue;

        let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
        const localRing = new Array(outer.length);
        for (let k = 0; k < outer.length; k++) {
          const p = toLocalMeters(outer[k], 0);
          localRing[k] = p;
          if (p.x < minX) minX = p.x;
          if (p.x > maxX) maxX = p.x;
          if (p.z < minZ) minZ = p.z;
          if (p.z > maxZ) maxZ = p.z;
        }
        const w = maxX - minX;
        const d = maxZ - minZ;
        if (w < 16 || d < 16) continue;

        let addedForPoly = 0;
        const gx0 = Math.ceil((minX + 6) / stepM) * stepM;
        const gz0 = Math.ceil((minZ + 6) / stepM) * stepM;
        for (let gx = gx0; gx <= maxX - 6 && placed.length < MAX_PARK_TREES && addedForPoly < 46; gx += stepM) {
          for (let gz = gz0; gz <= maxZ - 6 && placed.length < MAX_PARK_TREES && addedForPoly < 46; gz += stepM) {
            if (((Math.round(gx / stepM) * 7 + Math.round(gz / stepM) * 13) & 3) === 0) continue;
            const h = Math.abs(Math.sin(gx * 0.137 + gz * 0.293));
            const h2 = Math.abs(Math.cos(gx * 0.211 - gz * 0.173));
            const tx = gx + (h - 0.5) * (stepM * 0.90);
            const tz = gz + (h2 - 0.5) * (stepM * 0.90);
            const cellKey = `${Math.round(tx / 11)},${Math.round(tz / 11)}`;
            if (usedCells.has(cellKey)) continue;
            if (!pointInRing2D(tx, tz, localRing)) continue;
            if (inWaterRing(tx, tz)) continue;
            if (isPointInRailYard(tx, tz)) continue;
            if (parkPool.nearAnyStation(tx, tz, 46)) continue;
            if (parkPool.nearTrackCenterline(tx, tz, 17)) continue;

            usedCells.add(cellKey);
            const scale = 0.80 + h * 0.72;
            const shade = h2 > 0.76 ? 3 : (Math.floor(h2 * 3.9) % 3);
            const sx = 0.86 + ((h * 7) % 1) * 0.30;
            const sy = 0.88 + ((h2 * 5) % 1) * 0.32;
            const sz = 0.86 + ((h * 11) % 1) * 0.30;
            const tr = { x: tx, z: tz, scale, yaw: h * Math.PI * 2, sx, sy, sz };
            placed.push(tr);
            if (perShade[shade].length < parkPool.crownInsts[shade].instanceMatrix.count) {
              perShade[shade].push(tr);
            }
            addedForPoly++;
          }
        }
      }
    }

    parkPool.trunkInst.count = placed.length;
    parkPool.aoInst.count = placed.length;
    for (let i = 0; i < placed.length; i++) {
      const tr = placed[i];
      dummy.position.set(tr.x, 1.85 * tr.scale, tr.z);
      dummy.rotation.set(0, tr.yaw, 0);
      dummy.scale.set(0.34 * tr.scale, 3.7 * tr.scale, 0.34 * tr.scale);
      dummy.updateMatrix();
      parkPool.trunkInst.setMatrixAt(i, dummy.matrix);

      dummy.position.set(tr.x - 1.0 * tr.scale, 0.16, tr.z - 0.7 * tr.scale);
      dummy.rotation.set(0, 0, 0);
      dummy.scale.set(5.0 * tr.scale, 1, 5.0 * tr.scale);
      dummy.updateMatrix();
      parkPool.aoInst.setMatrixAt(i, dummy.matrix);
    }
    parkPool.trunkInst.instanceMatrix.needsUpdate = true;
    parkPool.aoInst.instanceMatrix.needsUpdate = true;

    perShade.forEach((list, sIdx) => {
      const ci = parkPool.crownInsts[sIdx];
      ci.count = list.length;
      const yOff = sIdx === 3 ? 5.6 : 4.9;
      for (let i = 0; i < list.length; i++) {
        const tr = list[i];
        dummy.position.set(tr.x, yOff * tr.scale, tr.z);
        dummy.rotation.set(0, tr.yaw, 0);
        dummy.scale.set(tr.sx * tr.scale, tr.sy * tr.scale, tr.sz * tr.scale);
        dummy.updateMatrix();
        ci.setMatrixAt(i, dummy.matrix);
      }
      ci.instanceMatrix.needsUpdate = true;
    });
  }

  /* ───────────────────────────────────────────────────────────
   * 3. High-Craft MetroKit 3D Stations & Curated Streetscape
   * ─────────────────────────────────────────────────────────── */
  function pickInterchangeHex(st) {
    const raw = (st.interchange || (st.interchanges && st.interchanges.join(' ')) || '').toLowerCase();
    if (raw.includes('magenta')) return 0xD946EF;
    if (raw.includes('blue')) return 0x2563EB;
    if (raw.includes('red')) return 0xDC2626;
    if (raw.includes('violet')) return 0x7C3AED;
    if (raw.includes('pink')) return 0xEC4899;
    if (raw.includes('airport')) return 0xF97316;
    if (raw.includes('rapid')) return 0x10B981;
    return null;
  }

  function addStreetTree(parent, x, y, z, alt = false, s = 1.0, yaw = 0.0) {
    const m = getMaterials();
    const g = getSharedStationGeos();
    const tr = new THREE.Mesh(g.cyl1, m.treeTrunk);
    tr.scale.set(0.34 * s, 3.7 * s, 0.34 * s);
    tr.position.set(x, y + 1.85 * s, z);
    const lf = new THREE.Mesh(g.treeCrown, alt ? m.treeFoliageAlt : m.treeFoliage);
    lf.scale.set(s * 0.94, s * 1.06, s * 0.96);
    lf.rotation.y = yaw;
    lf.position.set(x, y + 4.9 * s, z);
    tr.frustumCulled = lf.frustumCulled = false;
    tr.castShadow = lf.castShadow = true;
    lf.receiveShadow = true;
    parent.add(tr, lf);
  }

  function addCommuters(parent, coordsList) {
    const m = getMaterials();
    const g = getSharedStationGeos();
    coordsList.forEach(([cx, cy, cz, shirtIdx]) => {
      const matS = m.commuterShirts[shirtIdx % m.commuterShirts.length];
      const body = new THREE.Mesh(g.commuterBody, matS);
      body.position.set(cx, cy + 0.78, cz);
      const head = new THREE.Mesh(g.commuterHead, m.commuterSkin);
      head.position.set(cx, cy + 1.72, cz);
      body.frustumCulled = head.frustumCulled = false;
      parent.add(body, head);
    });
  }

  function addAFCTurnstiles(parent, x, y, z, count, rotY = 0) {
    const m = getMaterials();
    const g = new THREE.Group();
    g.position.set(x, y, z);
    g.rotation.y = rotY;
    for (let i = 0; i < count; i++) {
      const gx = (i - (count - 1) * 0.5) * 1.5;
      addBox(g, 0.42, 1.35, 1.9, m.steelChrome, gx, 0.68, 0);
      addBox(g, 0.44, 0.12, 1.95, m.pidsHousing, gx, 1.38, 0);
      addBox(g, 0.22, 0.09, 0.28, m.ledGreen, gx, 1.46, 0.6);
      if (i < count - 1) {
        addBox(g, 0.80, 0.92, 0.08, m.afcFlap, gx + 0.75, 0.72, 0);
      }
    }
    parent.add(g);
  }

  function addMultiRingTBMCollars(parent, xPos, yBase) {
    const m = getMaterials();
    const g = getSharedStationGeos();
    // 4 stepped concentric white concrete TBM portal tunnel rings at chamber end (exact Image 2 detail!)
    [-TRACK_HALF_SEP, TRACK_HALF_SEP].forEach((tz) => {
      const dir = Math.sign(xPos);
      [0, 1.35, 2.7, 4.0].forEach((dx) => {
        const ring = new THREE.Mesh(g.tbmRib, m.concreteLight);
        ring.rotation.y = Math.PI / 2;
        ring.position.set(xPos - dir * dx, yBase + 0.6, tz);
        ring.frustumCulled = false;
        parent.add(ring);
      });
      const arch = new THREE.Mesh(g.tbmArch, m.concreteLight);
      arch.rotation.z = Math.PI / 2;
      arch.position.set(xPos, yBase + 0.6, tz);
      const bore = new THREE.Mesh(g.tbmBore, m.slateDark);
      bore.rotation.z = Math.PI / 2;
      bore.position.set(xPos, yBase + 0.6, tz);
      arch.frustumCulled = bore.frustumCulled = false;
      parent.add(arch, bore);
    });
  }

  function ensureStationSignage(st) {
    if (!st || st._signageReady || !st._signSpec) return;
    st._signageReady = true;
    const { subtitle, secCss } = st._signSpec;
    const lineHex = (st.lineId === 'blue') ? '#2563EB' : '#EAB308';
    const signTex = makeBilingualSignTex(st.hindi, st.name, subtitle, lineHex, secCss);
    const pidsTex = makeMapPIDSTex(st.name);
    const signMat = new THREE.MeshBasicMaterial({ map: signTex });
    const pidsMat = new THREE.MeshBasicMaterial({ map: pidsTex });
    if (st._signMeshes) {
      st._signMeshes.forEach((mesh) => {
        if (mesh) mesh.material = signMat;
      });
    }
    if (st._pidsMesh) {
      st._pidsMesh.material = pidsMat;
    }
  }

  const UNDERGROUND_SIDE_STATIONS = new Set([
    'GTB Nagar',
    'Vishwavidyalaya',
    'Vidhan Sabha',
    'Civil Lines',
    'Central Secretariat'
  ]);

  const HERITAGE_RIDGE_ELEVATED = new Set([
    'Qutab Minar',
    'Chhatarpur',
    'Sultanpur',
    'Ghitorni',
    'Arjan Garh'
  ]);

  const CYBER_GURUGRAM_ELEVATED = new Set([
    'Guru Dronacharya',
    'Sikanderpur',
    'MG Road',
    'IFFCO Chowk',
    'Millennium City Centre'
  ]);

  function addTerminusBufferAndCrossover(root, detail, xEnd, xCross, yRail) {
    const m = getMaterials();
    const isNorth = xEnd < 0;
    // Hydraulic red/yellow buffer stops on both terminating tracks (±4.6m)
    [-TRACK_HALF_SEP, TRACK_HALF_SEP].forEach((tz) => {
      addBox(detail, 2.2, 1.35, 2.6, m.steelDark, xEnd, yRail + 0.68, tz);
      addBox(detail, 0.45, 0.95, 2.8, m.bufferRed, xEnd - Math.sign(xEnd) * 1.15, yRail + 0.72, tz);
      addBox(detail, 0.50, 0.24, 2.85, m.tactileYellow, xEnd - Math.sign(xEnd) * 1.22, yRail + 0.98, tz);
    });
    // Overhead terminal stop gantry sign
    addBox(detail, 0.45, 5.2, 13.4, m.steelDark, xEnd, yRail + 2.6, 0);
    addBox(detail, 0.55, 0.95, 11.2, m.tactileYellow, xEnd, yRail + 4.9, 0);

    // Scissors crossover diamond sleeper & rail X-tie across center gap between tracks
    const crossA = addBox(detail, 12.6, 0.20, 0.55, m.steelDark, xCross, yRail + 0.28, 0);
    crossA.rotation.y = isNorth ? 0.58 : -0.58;
    const crossB = addBox(detail, 12.6, 0.20, 0.55, m.steelDark, xCross, yRail + 0.28, 0);
    crossB.rotation.y = isNorth ? -0.58 : 0.58;
  }

  /* ───────────────────────────────────────────────────────────
   * 3C. Noida Electronic City Turnaround Viaduct & Scissor Crossover Overrun
   * ─────────────────────────────────────────────────────────── */
  function buildNoidaElectronicCityTurnaround(root, detail, m, g, yV) {
    const extLen = 280;
    const extStart = 43; // Platform ends at +43
    const extEnd = extStart + extLen; // +323
    const extMidX = extStart + extLen * 0.5;

    // 1. Extended Viaduct Deck Slab & Box Spine spanning toward NH-9 / Delhi-Meerut Expressway
    addBox(root, extLen, 1.0, 14.2, m.concreteLight, extMidX, yV - 0.50, 0);
    addBox(root, extLen, 2.0, 9.6, m.concreteWeb, extMidX, yV - 1.95, 0);
    // Continuous Parapets
    addBox(root, extLen, 1.1, 0.45, m.concreteWeb, extMidX, yV + 0.55, -6.8);
    addBox(root, extLen, 1.1, 0.45, m.concreteWeb, extMidX, yV + 0.55, 6.8);
    // Blue tactical line spine
    addBox(root, extLen, 0.45, 0.55, m.tactileBlue, extMidX, yV + 0.22, 0);

    // 2. Viaduct Support Piers Spaced along Extension
    const pierSpacing = 38;
    for (let px = extStart + 30; px <= extEnd - 20; px += pierSpacing) {
      addBox(root, 5.2, 0.9, 5.6, m.concreteWeb, px, 0.45, 0);
      const shaft = new THREE.Mesh(g.pierShaft, m.pierCream);
      shaft.scale.set(1.25, yV - 3.6, 1.25);
      shaft.position.set(px, (yV - 3.6) * 0.5 + 0.75, 0);
      shaft.frustumCulled = false;
      root.add(shaft);
      addBox(root, 3.8, 2.5, 16.5, m.concreteLight, px, yV - 2.9, 0);
    }

    // 3. Twin Turnaround Siding Tracks & Sleepers
    const trackEnd = extStart + 225; // 268m from station center
    const trackMid = extStart + (trackEnd - extStart) * 0.5;
    const trackLen = trackEnd - extStart;
    [-TRACK_HALF_SEP, TRACK_HALF_SEP].forEach((tz) => {
      // Ballast bed
      addBox(root, trackLen, 0.22, 3.4, m.slateCut, trackMid, yV + 0.11, tz);
      // Twin running rails
      addBox(root, trackLen, 0.18, 0.08, m.railCrown, trackMid, yV + 0.32, tz - 0.71);
      addBox(root, trackLen, 0.18, 0.08, m.railCrown, trackMid, yV + 0.32, tz + 0.71);
    });

    // Cross Sleepers along turnaround siding
    for (let sx = extStart + 2; sx <= trackEnd; sx += 1.8) {
      [-TRACK_HALF_SEP, TRACK_HALF_SEP].forEach((tz) => {
        addBox(detail, 0.24, 0.12, 2.4, m.concreteWeb, sx, yV + 0.22, tz);
      });
    }

    // 4. Diamond Scissor Crossover (X-Crossover) with Switch Machines
    const xMid = extStart + 60; // x = 103
    const xSpan = 42;
    const diagLen = Math.hypot(xSpan, TRACK_HALF_SEP * 2);
    const diagAngle = Math.atan2(TRACK_HALF_SEP * 2, xSpan);

    const crossA = addBox(detail, diagLen, 0.18, 0.08, m.railCrown, xMid, yV + 0.32, 0);
    crossA.rotation.y = -diagAngle;
    const crossB = addBox(detail, diagLen, 0.18, 0.08, m.railCrown, xMid, yV + 0.32, 0);
    crossB.rotation.y = diagAngle;

    // Switch Machines (Yellow electro-pneumatic point actuator boxes)
    [xMid - xSpan * 0.45, xMid + xSpan * 0.45].forEach((swX) => {
      [-TRACK_HALF_SEP - 1.8, TRACK_HALF_SEP + 1.8].forEach((swZ) => {
        addBox(detail, 1.4, 0.55, 0.9, m.yellowAccent, swX, yV + 0.30, swZ);
      });
    });

    // 5. Dual Heavy-Duty Hydraulic Friction Buffer Stops
    [-TRACK_HALF_SEP, TRACK_HALF_SEP].forEach((tz) => {
      const bx = trackEnd + 1.5;
      // Triangular steel A-frame buffer stop
      addBox(detail, 3.8, 1.9, 2.6, m.steelDark, bx, yV + 1.05, tz);
      // Red hydraulic buffer pistons with circular strike pads facing incoming trains
      addBox(detail, 0.8, 0.4, 0.4, m.bufferRed, bx - 2.1, yV + 1.05, tz - 0.71);
      addBox(detail, 0.8, 0.4, 0.4, m.bufferRed, bx - 2.1, yV + 1.05, tz + 0.71);
      // Yellow hazard warning impact plate
      addBox(detail, 0.22, 1.4, 2.2, m.yellowAccent, bx - 1.8, yV + 1.15, tz);
      // Top red LED stop signal
      addBox(detail, 0.3, 0.4, 0.3, m.bufferRed, bx, yV + 2.2, tz);
    });

    // Heavy reinforced concrete terminal overrun parapet wall
    addBox(root, 1.6, 2.4, 14.2, m.concreteLight, trackEnd + 6.0, yV + 1.2, 0);

    // 6. Standalone Future-Extension Viaduct Piers toward Sahibabad/Ghaziabad
    const futureStartX = extEnd + 25;
    [futureStartX, futureStartX + 42, futureStartX + 84, futureStartX + 126].forEach((fpx) => {
      addBox(root, 5.2, 0.9, 5.6, m.concreteWeb, fpx, 0.45, 0);
      const fShaft = new THREE.Mesh(g.pierShaft, m.pierCream);
      fShaft.scale.set(1.25, yV - 3.6, 1.25);
      fShaft.position.set(fpx, (yV - 3.6) * 0.5 + 0.75, 0);
      fShaft.frustumCulled = false;
      root.add(fShaft);
      // Cantilevered hammerhead pier cap prepared for future precast U-girders
      addBox(root, 3.8, 2.5, 15.5, m.concreteLight, fpx, yV - 2.9, 0);
      // Exposed starter rebar corbels on top of pier cap
      addBox(detail, 1.8, 0.8, 11.2, m.steelDark, fpx, yV - 1.25, 0);
    });
  }

  /* ───────────────────────────────────────────────────────────
   * 3D. Yamuna Bank 4-Platform At-Grade Junction Station & Depot Throat
   * Authentic DMRC Architecture:
   * - At-grade (ground level on Yamuna river plain ballast, not elevated piers)
   * - 4 through tracks with 2 wide island platforms for same-direction cross-platform interchange
   *   * Island 1: Platform 1 (Noida) & Platform 3 (Vaishali)
   *   * Island 2: Platform 2 & 4 (Dwarka Sector 21)
   * - Individual industrial steel platform canopies with dark maroon portal trusses & central skylights
   * - Overhead Passenger Footbridge (FOB) with stairs & glass elevators connecting both islands
   * - Ground-level single-storey sand-ochre concourse building with DMRC roundel entrance
   * - Branching elevated flyover ramp for Vaishali branch (Line 4)
   * - Adjacent Yamuna Bank Train Maintenance Depot stabling tracks & shed
   * ─────────────────────────────────────────────────────────── */
  /* ───────────────────────────────────────────────────────────
   * YAMUNA BANK AT-GRADE JUNCTION & TRANSIT DEPOT FACILITY
   * ───────────────────────────────────────────────────────────
   * Authentic DMRC surface junction engineered strictly to Apple/Google Maps & DMRC Specs:
   * - At-grade (ground level on Yamuna river plain ballast y = 1.2m)
   * - 4 through tracks with 2 wide DMRC island platforms for cross-platform interchange:
   *   * Island 1 (North, z = -9.8m): Platform 1 (Noida) & Platform 3 (Vaishali)
   *   * Island 2 (South, z = +9.8m): Platform 4 & Platform 2 (Dwarka Sector 21)
   *   * Track 1 (North Outer, z = -15.0m)
   *   * Track 3 (North Inner, z = -4.6m, Mainline Corridor)
   *   * Track 4 (South Inner, z = +4.6m, Mainline Corridor)
   *   * Track 2 (South Outer, z = +15.0m)
   *   * Precision clearance: Exactly 2.40m track center to platform edge across all 4 faces
   * - Signature curved DMRC sky-blue vaulted canopies with red portal frames & central skylights
   * - Central elevated glazed Foot Over Bridge (FOB) concourse with stairs & transparent lifts
   * - South entrance concourse building with ticketing hall, DMRC roundel & landscaped plaza
   * - Western River Flank Depot Yard (x = -380 to -100m, z = -20 to -65m):
   *   * 8 parallel stabling sidings with buffer stops facing west towards Yamuna riverbank
   *   * 3 parked 8-coach DMRC train rakes with stainless steel livery & blue stripes
   *   * Dual rolling stock inspection & overhaul sheds on northern perimeter (z = -78m, -94m)
   *   * Smooth throat lead turnouts connecting depot into Track 1 & Track 3
   * ─────────────────────────────────────────────────────────── */
  function buildYamunaYardInfrastructure(parent, yardData) {
    if (!yardData || !yardData.tracks) return null;
    const m = getMaterials();
    const g = getSharedStationGeos();
    const grp = new THREE.Group();
    const tr = yardData.tracks;
    const anc = yardData.anchors || {};

    const toYardSpan = (poly) => {
      if (!poly || poly.length < 2) return null;
      const pts3 = poly.map((c) => toLocalMeters([c[0], c[1]], Number.isFinite(c[2]) ? c[2] : 1.2));
      let acc = 0;
      const out = [];
      for (let i = 0; i < pts3.length; i++) {
        if (i > 0) acc += Math.hypot(pts3[i].x - pts3[i - 1].x, pts3[i].z - pts3[i - 1].z);
        const prev = pts3[Math.max(0, i - 1)];
        const next = pts3[Math.min(pts3.length - 1, i + 1)];
        const tan = new THREE.Vector3(next.x - prev.x, 0, next.z - prev.z);
        if (tan.lengthSq() < 1e-6) tan.set(1, 0, 0);
        tan.normalize();
        out.push({ pos: pts3[i], tan, dist: acc, elev: Number.isFinite(poly[i][2]) ? poly[i][2] : 1.2 });
      }
      return out.length >= 2 ? out : null;
    };

    const yardMainSpans = [];
    ['at_grade_yard', 'noida_underpass', 'yard_underpass', 'vaishali_spur_viaduct', 'noida_pocket_viaduct'].forEach((k) => {
      (tr[k] || []).forEach((poly) => {
        const sp = toYardSpan(poly);
        if (sp) yardMainSpans.push(sp);
      });
    });
    const crossoverSpans = (tr.crossovers || []).map(toYardSpan).filter(Boolean);

    // 1. Batched single-track sleepers, ballast & steel rails (no bright blue strip slashing across switch frogs!)
    const ballastProf = [[-1.58, 0.0], [1.58, 0.0], [1.38, 0.24], [-1.38, 0.24]];
    const ballastMesh = buildRibbonFromSpans(yardMainSpans, ballastProf, m.ballastSleeper, 1.15, false);
    if (ballastMesh) grp.add(ballastMesh);

    [-0.95, 0.95].forEach((gOff) => {
      const webProf = [[gOff - 0.14, 0.24], [gOff + 0.14, 0.24], [gOff + 0.12, 0.42], [gOff - 0.12, 0.42]];
      const crownProf = [[gOff - 0.10, 0.42], [gOff + 0.10, 0.42], [gOff + 0.10, 0.50], [gOff - 0.10, 0.50]];
      const wM = buildRibbonFromSpans(yardMainSpans, webProf, m.railWeb, 1.15, false);
      const cM = buildRibbonFromSpans(yardMainSpans, crownProf, m.railCrown, 1.15, false);
      if (wM) grp.add(wM);
      if (cM) grp.add(cM);
    });

    // Smooth Hermite S-curve Crossovers: sink ballast 1.5cm (zero Z-fighting) while raising rail crowns to match mainline (1.44..1.70m) + inner guard check-rails!
    if (crossoverSpans.length) {
      const coBallastProf = [[-1.42, 0.0], [1.42, 0.0], [1.22, 0.22], [-1.22, 0.22]];
      const coBallastM = buildRibbonFromSpans(crossoverSpans, coBallastProf, m.ballastSleeper, 1.15, false);
      if (coBallastM) grp.add(coBallastM);
      [-0.95, 0.95].forEach((gOff) => {
        const wProf = [[gOff - 0.14, 0.255], [gOff + 0.14, 0.255], [gOff + 0.12, 0.435], [gOff - 0.12, 0.435]];
        const cProf = [[gOff - 0.10, 0.435], [gOff + 0.10, 0.435], [gOff + 0.10, 0.515], [gOff - 0.10, 0.515]];
        const wM = buildRibbonFromSpans(crossoverSpans, wProf, m.railWeb, 1.15, false);
        const cM = buildRibbonFromSpans(crossoverSpans, cProf, m.railCrown, 1.15, false);
        if (wM) grp.add(wM);
        if (cM) grp.add(cM);
      });
      // Guard / check rails inside crossing frogs
      [-0.72, 0.72].forEach((chkOff) => {
        const chkProf = [[chkOff - 0.06, 0.36], [chkOff + 0.06, 0.36], [chkOff + 0.06, 0.49], [chkOff - 0.06, 0.49]];
        const chkM = buildRibbonFromSpans(crossoverSpans, chkProf, m.steelDark, 1.15, false);
        if (chkM) grp.add(chkM);
      });
    }

    const groundBallastMat = m.slateCut.clone();
    groundBallastMat.color.setHex(0x363D47);

    // Shared crushed-granite formation pads uniting station & depot switch throats (zero sand gaps between diverging switches)
    (anc.throatBallastPads || []).forEach((pad) => {
      const pPos = toLocalMeters(pad.centerLL, pad.elevM || 1.16);
      const padBox = addBox(grp, pad.lengthM, 0.22, pad.widthM, groundBallastMat, pPos.x, (pad.elevM || 1.16) - 0.08, pPos.z);
      padBox.rotation.y = -((pad.angleDeg || -21.0) * Math.PI) / 180;
    });

    // Switch point machines & shunting lanterns at turnout noses
    (anc.switchHardware || []).forEach((sw) => {
      const sPos = toLocalMeters(sw.ll, sw.elevM || 1.2);
      const swGrp = new THREE.Group();
      swGrp.position.set(sPos.x, sw.elevM || 1.2, sPos.z);
      swGrp.rotation.y = sw.yawRad || 0;
      addBox(swGrp, 1.3, 0.52, 0.85, m.steelDark, 0, 0.26, 2.05);
      addBox(swGrp, 0.32, 0.32, 0.32, m.yellowAccent, 0, 0.62, 2.05);
      addBox(swGrp, 0.35, 0.14, 3.6, m.concreteWeb, 0, 0.16, 0);
      grp.add(swGrp);
    });

    // 2. Concrete U-girder decks & piers on elevated depot/pocket spurs (elev >= 2.2m)
    const extractSubSpans = (polyList, pred) => {
      const sub = [];
      (polyList || []).forEach((poly) => {
        const sp = toYardSpan(poly);
        if (!sp) return;
        let cur = [];
        for (let i = 0; i < sp.length; i++) {
          if (pred(sp[i])) {
            if (!cur.length && i > 0) cur.push(sp[i - 1]);
            cur.push(sp[i]);
          } else if (cur.length) {
            cur.push(sp[i]);
            if (cur.length >= 2) sub.push(cur);
            cur = [];
          }
        }
        if (cur.length >= 2) sub.push(cur);
      });
      return sub;
    };

    const elevSpurSpans = extractSubSpans(
      []
        .concat(tr.vaishali_spur_viaduct || [])
        .concat(tr.noida_pocket_viaduct || [])
        .concat(tr.noida_underpass || []),
      (s) => s.elev >= 2.2
    );
    if (elevSpurSpans.length) {
      const spurGirderProf = [[-2.5, 0.0], [-2.5, -0.6], [-1.45, -1.65], [1.45, -1.65], [2.5, -0.6], [2.5, 0.0]];
      const spurParL = [[-2.5, 0.0], [-2.05, 0.0], [-2.05, 0.85], [-2.5, 0.85]];
      const spurParR = [[2.05, 0.0], [2.5, 0.0], [2.5, 0.85], [2.05, 0.85]];
      [
        buildRibbonFromSpans(elevSpurSpans, spurGirderProf, m.concreteLight, 1.15, false),
        buildRibbonFromSpans(elevSpurSpans, spurParL, m.concreteWeb, 1.15, false),
        buildRibbonFromSpans(elevSpurSpans, spurParR, m.concreteWeb, 1.15, false)
      ].forEach((mesh) => mesh && grp.add(mesh));

      elevSpurSpans.forEach((sp) => {
        let lastPierD = -999;
        for (let i = 0; i < sp.length; i++) {
          const smp = sp[i];
          if (smp.elev < 4.5 || smp.dist - lastPierD < 40) continue;
          lastPierD = smp.dist;
          const capBotY = smp.elev - 1.65;
          const capH = 1.1;
          const shaftH = Math.max(0.5, capBotY - capH);
          const yaw = Math.atan2(-smp.tan.z, smp.tan.x);
          const pCol = addBox(grp, 1.8, shaftH, 1.8, m.pierCream, smp.pos.x, shaftH * 0.5, smp.pos.z);
          pCol.rotation.y = yaw;
          const pCap = addBox(grp, 2.2, capH, 5.2, m.concreteLight, smp.pos.x, capBotY - capH * 0.5, smp.pos.z);
          pCap.rotation.y = yaw;
        }
      });
    }

    // 3. Concrete U-Trough Retaining Cut (top flush with ground level y=1.32m along entire -3.8m dive!)
    const underpassSpans = extractSubSpans(
      [].concat(tr.noida_underpass || []).concat(tr.yard_underpass || []),
      (s) => s.elev <= 1.05
    );
    if (underpassSpans.length) {
      const troughBed = [[-2.35, -0.20], [2.35, -0.20], [2.35, 0.02], [-2.35, 0.02]];
      const bedM = buildRibbonFromSpans(underpassSpans, troughBed, m.trenchFloor, 1.15, false);
      if (bedM) grp.add(bedM);

      // Variable-height retaining walls whose top stays flat at ground coping (y = 1.32m) as rails plunge to -3.8m
      const wallTopY = 1.32;
      const wallPos = [];
      const wallIdx = [];
      let wv = 0;
      underpassSpans.forEach((sp) => {
        [-2.38, 2.38].forEach((latC) => {
          for (let i = 0; i < sp.length - 1; i++) {
            const s0 = sp[i];
            const s1 = sp[i + 1];
            const r0 = new THREE.Vector3(-s0.tan.z, 0, s0.tan.x).normalize();
            const r1 = new THREE.Vector3(-s1.tan.z, 0, s1.tan.x).normalize();
            const sign = Math.sign(latC);
            const inLat = latC - sign * 0.22;
            const outLat = latC + sign * 0.22;
            const y0b = s0.pos.y - 0.1;
            const y1b = s1.pos.y - 0.1;
            // Quad strips for inner face, outer face, and top coping
            const p0ib = [s0.pos.x + r0.x * inLat, y0b, s0.pos.z + r0.z * inLat];
            const p0it = [p0ib[0], wallTopY, p0ib[2]];
            const p1ib = [s1.pos.x + r1.x * inLat, y1b, s1.pos.z + r1.z * inLat];
            const p1it = [p1ib[0], wallTopY, p1ib[2]];
            const p0ob = [s0.pos.x + r0.x * outLat, y0b, s0.pos.z + r0.z * outLat];
            const p0ot = [p0ob[0], wallTopY, p0ob[2]];
            const p1ob = [s1.pos.x + r1.x * outLat, y1b, s1.pos.z + r1.z * outLat];
            const p1ot = [p1ob[0], wallTopY, p1ob[2]];
            const pushQuad = (a, b, c, d) => {
              wallPos.push(...a, ...b, ...c, ...d);
              wallIdx.push(wv, wv + 1, wv + 2, wv, wv + 2, wv + 3);
              wv += 4;
            };
            pushQuad(p0ib, p1ib, p1it, p0it);
            pushQuad(p1ob, p0ob, p0ot, p1ot);
            pushQuad(p0it, p1it, p1ot, p0ot);
          }
        });
      });
      if (wallPos.length) {
        const wGeo = new THREE.BufferGeometry();
        wGeo.setAttribute('position', new THREE.Float32BufferAttribute(wallPos, 3));
        wGeo.setIndex(wallIdx);
        wGeo.computeVertexNormals();
        const wallMat = m.concreteLight.clone();
        wallMat.side = THREE.DoubleSide;
        const wMesh = new THREE.Mesh(wGeo, wallMat);
        wMesh.frustumCulled = false;
        wMesh.receiveShadow = true;
        grp.add(wMesh);
      }
    }
    if (anc.underpassBridge && anc.underpassBridge.centerLL) {
      const ubPos = toLocalMeters(anc.underpassBridge.centerLL, 0);
      // Use crossing Vaishali vector ~(0.77, -0.63) so portal headwalls sit cleanly under the bridge deck
      const ubYaw = Math.atan2(0.63, 0.77);
      const portalGrp = new THREE.Group();
      portalGrp.position.set(ubPos.x, 0, ubPos.z);
      portalGrp.rotation.y = ubYaw;
      // Box culvert abutment walls flush beneath Vaishali girder soffit (floor y=0.35m -> soffit y=3.65m)
      [-8.8, 8.8].forEach((ax) => {
        addBox(portalGrp, 1.4, 3.3, 20.0, m.concreteLight, ax, 2.0, -2.5);
      });
      grp.add(portalGrp);
    }

    // 4. Stabled 8-Coach DMRC Train Rakes aligned on real yard tracks (OSM depot sheds already extruded cleanly by Overture 3D buildings)
    const depotFloorY = 1.2;

    // 5. Stabled 8-Coach DMRC Train Rakes aligned on real yard tracks
    (anc.stabledRakes || []).forEach((rk) => {
      const rPos = toLocalMeters(rk.centerLL, rk.elevM || depotFloorY);
      const rGrp = new THREE.Group();
      rGrp.position.set(rPos.x, rk.elevM || depotFloorY, rPos.z);
      rGrp.rotation.y = rk.yawRad || 0;
      const coaches = rk.coaches || 8;
      const rakeLen = coaches * 17.5;
      for (let ci = 0; ci < coaches; ci++) {
        const cx = -rakeLen * 0.5 + ci * 17.5 + 8.75;
        addBox(rGrp, 16.8, 3.4, 3.0, m.steelChrome, cx, 2.1, 0);
        addBox(rGrp, 17.0, 0.45, 2.8, m.concreteLight, cx, 3.9, 0);
        addBox(rGrp, 16.8, 0.42, 3.06, m.tactileBlue, cx, 2.0, 0);
        [-4.5, 0, 4.5].forEach((wx) => {
          [-1.54, 1.54].forEach((wz) => {
            addBox(rGrp, 2.6, 1.05, 0.05, m.concourseGlass, cx + wx, 2.45, wz);
          });
        });
        if (ci === 0 || ci === coaches - 1) {
          const capX = ci === 0 ? cx - 8.4 : cx + 8.4;
          addBox(rGrp, 0.5, 2.6, 2.8, m.roundelRed, capX, 2.1, 0);
          addBox(rGrp, 0.6, 0.8, 2.4, m.concourseGlass, capX, 2.7, 0);
        }
        if (ci === 2 || ci === 5) {
          addBox(rGrp, 2.2, 0.6, 1.8, m.steelDark, cx, 4.3, 0);
        }
      }
      grp.add(rGrp);
    });

    // 6. South Parking Plaza Forecourt ("Yamuna Bank Metro Parking")
    if (anc.southParkingPlaza && anc.southParkingPlaza.centerLL) {
      const pkPos = toLocalMeters(anc.southParkingPlaza.centerLL, depotFloorY);
      const tVec = anc.stationTangent || [0.93, -0.367];
      const pkGrp = new THREE.Group();
      pkGrp.position.set(pkPos.x, depotFloorY, pkPos.z);
      pkGrp.rotation.y = Math.atan2(-tVec[1], tVec[0]);
      addBox(pkGrp, anc.southParkingPlaza.lengthM || 150, 0.16, anc.southParkingPlaza.widthM || 42, m.plazaPave, 0, -0.05, 0);
      addBox(pkGrp, (anc.southParkingPlaza.lengthM || 150) - 6, 0.20, 3.0, m.sagePark, 0, 0.02, (anc.southParkingPlaza.widthM || 42) * 0.5 - 2.0);
      grp.add(pkGrp);
    }

    parent.add(grp);
    return grp;
  }

  function buildYamunaBankJunctionStation(st, secColor) {
    const m = getMaterials();
    const g = getSharedStationGeos();
    const root = new THREE.Group();
    const detail = new THREE.Group();
    const gY = 1.2; // At-grade ground elevation matching Blue Line floodplain

    // 1. Station Ballast Apron & Dual Island Platforms Fitted Between Real Corridors
    // In station-local coords (+X = ENE along track, -Z = NW):
    //   - blueCorridor tracks sit at z = +4.6m (South Noida/Dwarka) and z = -4.6m (Center Noida/Dwarka)
    //   - vaishaliCorridor tracks sit at z = -11.4m and z = -20.6m (centered on VA[0] at z = -16.0m)
    //   - northern depot bypass tracks (2.1, 3.47, 3.61..) run openly at z <= -33.9m outside the hall roof!
    addBox(root, 138, 0.24, 34, m.slateCut, 0, gY - 0.12, -8.0);
    addBox(root, 134, 0.12, 31, m.plazaPave, 0, gY - 0.04, -8.0);

    const platLen = 118;
    const platW = 4.6; // 2.30m clear track-center to platform edge on ±4.6m pairs
    const platH = 1.25;
    const islandConfigs = [
      { pz: 0.0, pIdx: 0 },    // South Island between z = -4.6m and +4.6m (Noida / Dwarka)
      { pz: -16.0, pIdx: 1 }   // North Island between z = -20.6m and -11.4m (Vaishali branch)
    ];

    islandConfigs.forEach((isl) => {
      const pz = isl.pz;
      addBox(root, platLen, platH, platW, m.terrazzoDeck, 0, gY + platH * 0.5, pz);

      const edgeOffset = platW * 0.5 - 0.28;
      addBox(detail, platLen, 0.08, 0.40, m.tactileYellow, 0, gY + platH + 0.04, pz - edgeOffset);
      addBox(detail, platLen, 0.08, 0.40, m.tactileYellow, 0, gY + platH + 0.04, pz + edgeOffset);

      [-edgeOffset - 0.05, edgeOffset + 0.05].forEach((bz) => {
        addBox(detail, 104, 1.30, 0.07, m.glassBarrier, 0, gY + platH + 0.65, pz + bz);
        addBox(detail, 104, 0.10, 0.12, m.yellowAccent, 0, gY + platH + 1.32, pz + bz);
        for (let bx = -48; bx <= 48; bx += 9.6) {
          addBox(detail, 0.11, 1.40, 0.11, m.steelDark, bx, gY + platH + 0.70, pz + bz);
        }
      });

      [-28, 0, 28].forEach((sx) => {
        addBox(detail, 4.2, 1.3, 0.24, m.roundelRed, sx, gY + platH + 3.6, pz);
        addBox(detail, 3.8, 0.8, 0.28, m.concreteLight, sx, gY + platH + 3.6, pz);
        addBox(detail, 3.8, 0.12, 0.30, m.tactileBlue, sx, gY + platH + 3.55, pz);
      });

      addBox(detail, 6.2, 1.5, 0.35, m.pidsHousing, -14, gY + platH + 3.4, pz);
      addBox(detail, 6.2, 1.5, 0.35, m.pidsHousing, 14, gY + platH + 3.4, pz);
      addBox(detail, 4.8, 0.58, 1.0, m.steelChrome, -24, gY + platH + 0.30, pz);
      addBox(detail, 4.8, 0.58, 1.0, m.steelChrome, 24, gY + platH + 0.30, pz);
      addCommuters(detail, [
        [-32, gY + platH, pz - 1.0, isl.pIdx * 2],
        [-10, gY + platH, pz + 1.0, isl.pIdx * 2 + 1],
        [8, gY + platH, pz - 0.9, isl.pIdx + 2],
        [26, gY + platH, pz + 0.9, isl.pIdx + 3]
      ]);
    });

    // 2. Single Wide Vaulted Station Hall Roof (Satellite Screenshot 5: spans BOTH islands z=-24.75..+8.75, leaving northern bypasses open)
    const hallZ = -8.0;
    const hallLen = 126;
    const hallW = 33.5; // covers z = -24.75m (North edge) to z = +8.75m (South edge)
    const eaveY = gY + 6.4;
    const ridgeY = gY + 8.6;
    // Steel Portal Columns safely outside all 4 passenger tracks (z = -24.2m North, z = -8.0m center median, z = +8.2m South)
    for (let px = -56; px <= 56; px += 14) {
      [-24.2, -8.0, 8.2].forEach((cz) => {
        addBox(detail, 0.42, 6.4, 0.42, m.steelDark, px, gY + 3.2, cz);
      });
      addBox(detail, 0.34, 0.40, hallW - 0.8, m.roundelRed, px, eaveY + 0.2, hallZ);
      addBox(detail, 0.28, 0.28, hallW * 0.52, m.steelDark, px, ridgeY - 0.7, hallZ);
    }
    // Curved/Multi-Slope Vaulted Metallic Roof Shell with DMRC Blue Fascias & Twin Daylight Skylights
    const rNOuter = addBox(root, hallLen, 0.22, 9.0, m.steelChrome, 0, eaveY + 0.75, -20.5);
    rNOuter.rotation.x = -0.18;
    const rNInner = addBox(root, hallLen, 0.22, 8.6, m.concreteLight, 0, eaveY + 1.75, -12.2);
    rNInner.rotation.x = -0.08;
    const rSInner = addBox(root, hallLen, 0.22, 8.6, m.concreteLight, 0, eaveY + 1.75, -3.8);
    rSInner.rotation.x = 0.08;
    const rSOuter = addBox(root, hallLen, 0.22, 9.0, m.steelChrome, 0, eaveY + 0.75, 4.5);
    rSOuter.rotation.x = 0.18;
    addBox(detail, hallLen - 4, 0.18, 2.4, m.skylightGlass, 0, ridgeY + 0.05, hallZ);
    addBox(root, hallLen + 0.6, 0.65, 0.55, m.dmrcBlueRoof, 0, eaveY + 0.1, -24.9);
    addBox(root, hallLen + 0.6, 0.65, 0.55, m.dmrcBlueRoof, 0, eaveY + 0.1, 8.9);

    // 3. Central Panoramic Glazed Foot Over Bridge (FOB) connecting South Concourse to Both Islands
    const fobY = gY + 9.4; // Clears station hall ridge cleanly
    const fobSpanZ = 38.0; // z = -18.5m to z = +19.5m
    const fobCenterZ = 0.5;
    addBox(root, 6.8, 3.0, fobSpanZ, m.concourseGlass, 0, fobY + 1.5, fobCenterZ);
    addBox(root, 7.2, 0.45, fobSpanZ + 0.4, m.concreteLight, 0, fobY, fobCenterZ);
    addBox(root, 7.6, 0.48, fobSpanZ + 0.8, m.dmrcBlueRoof, 0, fobY + 3.1, fobCenterZ);

    [0.0, -16.0].forEach((pz) => {
      addBox(detail, 3.0, fobY - gY - platH, 3.0, m.concourseGlass, -4.0, gY + platH + (fobY - gY - platH) * 0.5, pz);
      addBox(detail, 3.2, 0.35, 3.2, m.steelDark, -4.0, fobY, pz);
    });

    // 4. South Entrance Passenger Concourse Building
    const concZ = 21.0;
    addBox(root, 44, 6.4, 13, m.pierCream, 0, gY + 3.2, concZ);
    addBox(root, 46, 0.7, 15, m.concreteLight, 0, gY + 6.5, concZ);
    addBox(root, 24, 0.5, 5.2, m.concreteLight, 0, gY + 4.8, concZ + 7.6);
    addBox(detail, 18.0, 1.2, 0.25, m.tactileBlue, 0, gY + 5.6, concZ + 6.8);
    addBox(detail, 2.4, 2.4, 0.35, m.roundelRed, -10.5, gY + 5.6, concZ + 6.8);

    const signMeshes = [];
    const pidsMesh = null;
    return { root, detail, signMeshes, pidsMesh };
  }

  function buildElevatedStation(st, secColor) {
    const m = getMaterials();
    const g = getSharedStationGeos();
    const root = new THREE.Group();
    const detail = new THREE.Group();
    const yV = VIADUCT_Y;
    // Out of all 17 elevated Yellow Line stations, ONLY Haiderpur Badli Mor has an Island platform.
    const isIsland = st.name === 'Haiderpur Badli Mor';
    const isHaiderpur = st.name === 'Haiderpur Badli Mor';
    const isAzadpur = st.name === 'Azadpur';
    const isSikanderpur = st.name === 'Sikanderpur';
    const isSamaypur = st.name === 'Samaypur Badli';
    const isMillennium = st.name === 'Millennium City Centre';
    const isModelTown = st.name === 'Model Town';
    const isHeritageRidge = HERITAGE_RIDGE_ELEVATED.has(st.name);
    const isCyberCorridor = CYBER_GURUGRAM_ELEVATED.has(st.name);
    const hubSpec = interchangeHubsData && interchangeHubsData.hubs && interchangeHubsData.hubs[st.name];
    const isFlatOverStacked = Boolean(hubSpec && hubSpec.flattenLowerCanopy);
    const wingSide = (!isAzadpur && !isHaiderpur && !isSikanderpur && (st.seqIndex % 2 === 1)) ? -1 : 1;

    // Compact architectural station forecourt plinth cleanly aligned inside right-of-way
    addBox(root, 94, 0.20, 32, m.plazaPave, 0, 0.24, 0);
    addBox(root, 92, 0.24, 4.6, m.sagePark, 0, 0.27, -13.4);
    addBox(root, 92, 0.24, 4.6, m.sagePark, 0, 0.27, 13.4);

    // 1. Concrete Box-Girder Deck + Under-Spine + Transverse Cross-Girders + 3 Flared Piers
    addBox(root, 86, 1.0, 14.2, m.concreteLight, 0, yV - 0.50, 0);
    addBox(root, 86, 2.0, 9.6, m.concreteWeb, 0, yV - 1.95, 0);
    [-34, -17, 0, 17, 34].forEach((cx) => {
      addBox(root, 1.3, 1.0, isIsland ? 16.4 : 28.6, m.concreteWeb, cx, yV - 0.52, 0);
    });

    [-32, 0, 32].forEach((px) => {
      addBox(root, 5.2, 0.9, 5.6, m.concreteWeb, px, 0.45, 0);
      const shaft = new THREE.Mesh(g.pierShaft, isHeritageRidge ? m.sandstoneBuff : m.pierCream);
      shaft.scale.set(1.25, yV - 3.6, 1.25);
      shaft.position.set(px, (yV - 3.6) * 0.5 + 0.75, 0);
      shaft.frustumCulled = false;
      root.add(shaft);
      addBox(root, 3.8, 2.5, 16.5, isHeritageRidge ? m.sandstoneBuff : m.concreteLight, px, yV - 2.9, 0);
    });

    // 2. Glazed Under-Viaduct Concourse Hall + Internal AFC Gates & Escalators + Sidewalk Glass Lift Wing
    const concFloorY = yV - 8.2;
    addBox(root, 58, 0.9, 18.6, m.concreteLight, 0, concFloorY, 0);
    addBox(root, 58, 0.6, 18.6, m.concreteWeb, 0, concFloorY + 5.6, 0);
    [-9.1, 9.1].forEach((cz) => {
      addBox(root, 57, 4.9, 0.22, isCyberCorridor ? m.cyberTeal : m.concourseGlass, 0, concFloorY + 2.8, cz);
      for (let mx = -26; mx <= 26; mx += 6.5) {
        addBox(detail, 0.34, 5.2, 0.34, m.steelDark, mx, concFloorY + 2.8, cz);
      }
    });
    addAFCTurnstiles(detail, -6, concFloorY + 0.45, 4.2, 5);
    [-8.5, 8.5].forEach((ez) => {
      const esc = addBox(detail, 2.2, 0.9, 14.0, m.escStep, -18, concFloorY + 4.8, ez);
      esc.rotation.z = 0.65;
    });

    // External Glass Lift + Sidewalk Escalator Wing (alternated side along corridor)
    const wingZ = wingSide * 13.6;
    const escZ = wingSide * 14.0;
    addBox(detail, 6.4, 0.5, 6.4, m.plazaPave, 22.0, 0.25, wingZ);
    addBox(detail, 5.4, yV + 2.6, 5.4, isCyberCorridor ? m.cyberTeal : m.glassBarrier, 22.0, (yV + 2.6) * 0.5, wingZ);
    addBox(detail, 5.8, 0.5, 5.8, isHeritageRidge ? m.qutabRedStone : m.dmrcBlueRoof, 22.0, yV + 2.9, wingZ);
    addBox(detail, 3.0, 2.4, 3.0, m.concreteWeb, 22.0, 6.2, wingZ);
    const wingEsc = addBox(detail, 2.8, 1.0, 14.2, m.escStep, 29.5, 5.2, escZ);
    wingEsc.rotation.z = -0.58;
    const wingGlass = addBox(detail, 3.0, 1.4, 14.2, m.escGlass, 29.5, 5.9, escZ);
    wingGlass.rotation.z = -0.58;

    // 3. Terrazzo Platforms + Tactile Strips + Glass PSDs + Live Digital PIDS + Benches + Commuters
    if (isIsland) {
      // Elevated Island kept at 4.4m width so trains on ±4.6m tracks (inner edge ±2.86m) pass cleanly
      addBox(root, 82, 2.0, 4.4, m.terrazzoDeck, 0, yV + 1.0, 0);
      [-1.96, 1.96].forEach((tz) => {
        addBox(detail, 82, 0.12, 0.44, m.tactileYellow, 0, yV + 2.05, tz);
        addBox(detail, 66, 1.55, 0.14, m.glassBarrier, 0, yV + 2.82, tz);
        addBox(detail, 66, 0.20, 0.18, m.yellowAccent, 0, yV + 3.68, tz);
      });
      addBox(detail, 4.4, 0.60, 1.1, m.steelChrome, -16, yV + 2.30, 0);
      addBox(detail, 4.4, 0.60, 1.1, m.steelChrome, 16, yV + 2.30, 0);
      addCommuters(detail, [
        [-22, yV + 2.0, -0.95, 0], [-8, yV + 2.0, 1.0, 1], [6, yV + 2.0, -0.95, 2], [22, yV + 2.0, 0.95, 3]
      ]);
    } else {
      [-10.4, 10.4].forEach((pz, sIdx) => {
        const sgn = Math.sign(pz);
        addBox(root, 82, 2.0, 6.8, m.terrazzoDeck, 0, yV + 1.0, pz);
        addBox(detail, 82, 0.12, 0.50, m.tactileYellow, 0, yV + 2.05, pz - sgn * 2.95);
        addBox(detail, 70, 1.55, 0.14, m.glassBarrier, 0, yV + 2.82, pz - sgn * 3.15);
        addBox(detail, 70, 0.20, 0.18, m.yellowAccent, 0, yV + 3.68, pz - sgn * 3.15);
        addBox(detail, 82, 1.65, 0.16, m.glassBarrier, 0, yV + 2.95, pz + sgn * 3.15);
        addBox(root, 82, 0.62, 0.34, isHeritageRidge ? m.qutabRedStone : (isCyberCorridor ? m.cyberTeal : m.yellowAccent), 0, yV + 1.25, pz + sgn * 3.35);
        addBox(detail, 4.4, 0.65, 1.2, m.steelChrome, -16, yV + 2.30, pz + sgn * 1.3);
        addBox(detail, 4.4, 0.65, 1.2, m.steelChrome, 16, yV + 2.30, pz + sgn * 1.3);
        addCommuters(detail, [
          [-26, yV + 2.0, pz - sgn * 1.6, sIdx * 2],
          [-4, yV + 2.0, pz - sgn * 1.6, sIdx * 2 + 1],
          [18, yV + 2.0, pz - sgn * 1.6, sIdx + 3]
        ]);
      });
    }

    // Digital Live PIDS Board (material bound lazily via ensureStationSignage)
    const pidsY = isFlatOverStacked ? yV + 6.4 : yV + 9.4;
    addBox(detail, 10.4, 2.4, 0.42, m.pidsHousing, 0, pidsY, 0);
    const pFront = addBox(detail, 9.8, 2.0, 0.48, m.placeholderSign, 0, pidsY, 0);
    pFront.frustumCulled = false;

    // 4. Vaulted DMRC Sky-Blue Barrel Canopy + Skylights + Steel Arch Ribs
    //    (Lower stations directly beneath a +27.8m stacked flyover use a sleek flat pergola so no roof clips the upper deck)
    const archCenterY = yV + 1.8;
    const isNoidaTerminus = (st.name === 'Noida Electronic City');
    const roofMat = isNoidaTerminus ? m.concreteLight : m.dmrcBlueRoof;

    if (isFlatOverStacked) {
      const pergW = isIsland ? 14.8 : 26.8;
      const pergY = yV + 7.25;
      addBox(root, 82, 0.36, pergW, m.skylightGlass, 0, pergY, 0);
      [-32, -16, 0, 16, 32].forEach((rx) => {
        addBox(detail, 0.55, 0.52, pergW + 0.6, m.steelDark, rx, pergY + 0.25, 0);
        [-(pergW * 0.46), pergW * 0.46].forEach((cz) => {
          addBox(detail, 0.42, 5.25, 0.42, m.steelDark, rx, yV + 4.6, cz);
        });
      });
      [-(pergW * 0.46), pergW * 0.46].forEach((cz) => addBox(detail, 82, 0.40, 0.45, m.steelDark, 0, pergY + 0.15, cz));
      [-22, 0, 22].forEach((lx) => addBox(detail, 9.5, 0.22, 0.65, m.luminaireGlow, lx, pergY - 0.32, 0));
    } else {
      const sky = new THREE.Mesh(g.canopySkylight, m.skylightGlass);
      sky.position.set(0, archCenterY, 0);
      sky.rotation.z = Math.PI / 2;
      sky.frustumCulled = false;
      root.add(sky);

      [-32.0, 0, 32.0].forEach((bx) => {
        const bay = new THREE.Mesh(g.canopyBay, roofMat);
        bay.position.set(bx, archCenterY, 0);
        bay.rotation.z = Math.PI / 2;
        bay.frustumCulled = false;
        root.add(bay);
      });

      if (isNoidaTerminus) {
        // Pedestrian overbridges connecting Noida Electronic City concourse over the 8-lane expressway
        [-24, 24].forEach((fobZ) => {
          const sgn = Math.sign(fobZ);
          addBox(root, 6.4, 3.8, 16, m.concourseGlass, 0, concFloorY + 2.4, fobZ);
          addBox(root, 6.8, 0.45, 16.4, m.concreteLight, 0, concFloorY + 0.5, fobZ);
          addBox(root, 6.8, 0.45, 16.4, m.concreteLight, 0, concFloorY + 4.3, fobZ);
          addBox(root, 4.8, concFloorY + 0.5, 4.8, m.concreteLight, 0, (concFloorY + 0.5) * 0.5, fobZ + sgn * 6.5);
        });
      }

      const haunchZ = g.archR * Math.cos(g.arcStart);
      const haunchY = archCenterY + g.archR * Math.sin(g.arcStart);
      const hCol = Math.max(2.0, haunchY - (yV + 2.0));
      for (let rx = -39; rx <= 39.1; rx += 9.75) {
        const rib = new THREE.Mesh(g.canopyRib, m.steelDark);
        rib.position.set(rx, archCenterY, 0);
        rib.rotation.y = Math.PI / 2;
        rib.rotation.z = g.arcStart;
        rib.frustumCulled = false;
        detail.add(rib);
        [-haunchZ, haunchZ].forEach((cz) => {
          addBox(detail, 0.48, hCol, 0.48, m.steelDark, rx, yV + 2.0 + hCol * 0.5, cz);
        });
      }
      addBox(detail, 83, 0.45, 0.45, m.steelDark, 0, haunchY, -haunchZ);
      addBox(detail, 83, 0.45, 0.45, m.steelDark, 0, haunchY, haunchZ);
      [-22, 0, 22].forEach((lx) => addBox(detail, 9.5, 0.24, 0.65, m.luminaireGlow, lx, archCenterY + g.archR - 0.7, 0));
    }

    // 5. Bilingual Navy & Yellow DMRC Fascia Signboards (material bound lazily via ensureStationSignage)
    const fZ = isIsland ? 10.6 : 14.3;
    const signMeshes = [];
    [-fZ, fZ].forEach((sz) => {
      const sb = new THREE.Mesh(g.box1, m.placeholderSign);
      sb.scale.set(24.0, 3.8, 0.35);
      sb.position.set(0, yV + 0.85, sz);
      if (sz < 0) sb.rotation.y = Math.PI;
      sb.frustumCulled = false;
      root.add(sb);
      signMeshes.push(sb);
    });

    // 6. Corridor & Station-Specific Architecture
    if (isSamaypur) {
      addTerminusBufferAndCrossover(root, detail, -41.5, -33.5, yV + 0.2);
      // Badli Depot northern sawtooth maintenance pavilion trim
      [-24, -8, 8].forEach((sx) => {
        addBox(root, 14.0, 2.2, 5.2, m.concreteWeb, sx, concFloorY + 4.4, -12.6);
        addBox(root, 13.6, 1.4, 5.4, m.cyberTeal, sx, concFloorY + 6.0, -12.6);
      });
    } else if (isMillennium) {
      addTerminusBufferAndCrossover(root, detail, 41.5, 33.5, yV + 0.2);
      // Gurugram Cyber Hub cantilevered teal-glass gateway atrium & dual glass totems
      addBox(root, 16.0, yV + 5.8, 4.6, m.cyberTeal, -18.0, (yV + 5.8) * 0.5, -13.6);
      addBox(root, 18.4, 0.8, 7.6, m.steelDark, -18.0, yV + 6.1, -13.6);
      [-26, -10].forEach((tx) => {
        addBox(detail, 1.1, yV + 6.4, 1.1, m.steelChrome, tx, (yV + 6.4) * 0.5, -15.6);
      });
    } else if (hubSpec) {
      // Genuine OSM/GTFS interchange geometry attached via attachGenuineInterchangeGeometry()
    } else if (isHaiderpur) {
      // Unique Elevated Island + Orthogonal Elevated Magenta Line (Phase IV) Overpass Bridge!
      const magY = yV + 6.8;
      const magMat = new THREE.MeshBasicMaterial({ color: 0xD946EF });
      addBox(root, 14.5, 1.8, 66, m.concreteLight, 0, magY, 0);
      addBox(root, 10.2, 1.4, 66, m.concreteWeb, 0, magY - 1.4, 0);
      [-24, 24].forEach((pz) => {
        const magPier = new THREE.Mesh(g.pierShaft, m.pierCream);
        magPier.scale.set(1.15, magY - 1.8, 1.15);
        magPier.position.set(10.5, (magY - 1.8) * 0.5, pz);
        magPier.frustumCulled = false;
        root.add(magPier);
        addBox(root, 13.5, 1.6, 3.8, m.concreteLight, 2.5, magY - 2.2, pz);
      });
      addBox(root, 2.4, 0.45, 66.4, magMat, 0, magY + 1.12, 0);
      [-5.8, 5.8].forEach((px) => addBox(detail, 0.55, 1.1, 66, m.concreteWeb, px, magY + 1.35, 0));
      // Framed Transfer Elevator Tower connecting Yellow concourse -> Magenta deck
      addBox(root, 5.4, magY + 2.4, 5.4, m.glassBarrier, 17.0, (magY + 2.4) * 0.5, -13.8);
      addBox(root, 6.0, 0.55, 6.0, magMat, 17.0, magY + 2.6, -13.8);
    } else if (isAzadpur) {
      // Elevated Side Yellow + Subterranean Pink Line cross concourse trench skylight
      const pinkMat = new THREE.MeshBasicMaterial({ color: 0xEC4899 });
      addBox(root, 16.0, 1.8, 30.0, m.slateCut, 0, 1.1, 0);
      addBox(root, 11.0, 0.35, 29.0, m.skylightGlass, 0, 2.15, 0);
      addBox(root, 2.8, 0.45, 30.6, pinkMat, 0, 2.28, 0);
      addBox(detail, 8.6, 4.2, 6.2, m.concourseGlass, -18.0, 2.3, -13.4);
      addBox(detail, 9.4, 0.45, 6.8, pinkMat, -18.0, 4.5, -13.4);
    } else if (isSikanderpur) {
      // Orthogonal Rapid Metro Gurugram elevated spur + enclosed skywalk bridge
      const rapidMat = new THREE.MeshBasicMaterial({ color: 0x10B981 });
      const rapY = yV + 2.4;
      addBox(root, 13.2, 1.9, 54, m.concreteLight, 16.0, rapY, 12.0);
      addBox(root, 2.2, 0.45, 54.4, rapidMat, 16.0, rapY + 1.15, 12.0);
      // Glazed overhead skywalk linking Yellow concourse directly to Rapid Metro terminal
      addBox(root, 18.0, 3.6, 5.6, m.cyberTeal, 7.0, yV - 2.6, 13.2);
      addBox(root, 18.2, 0.45, 6.0, rapidMat, 7.0, yV - 0.65, 13.2);
    } else if (secColor) {
      addBox(root, 10.5, 2.0, 44, m.concreteLight, 0, yV - 5.4, 0);
      addBox(root, 3.4, 0.55, 44.6, new THREE.MeshBasicMaterial({ color: secColor }), 0, yV - 4.2, 0);
    }

    if (isHeritageRidge) {
      // Dholpur red & buff sandstone cornice fascia + heritage gatehouse pavilion (Qutab..Arjan Garh)
      addBox(root, 84, 0.55, 0.48, m.sandstoneBuff, 0, yV + 0.35, -14.0);
      addBox(root, 84, 0.55, 0.48, m.sandstoneBuff, 0, yV + 0.35, 14.0);
      addBox(detail, 11.4, 3.8, 5.8, m.qutabRedStone, -18.0, 2.1, -13.4);
      addBox(detail, 12.2, 0.55, 6.4, m.sandstoneBuff, -18.0, 4.25, -13.4);
      if (st.name === 'Qutab Minar') {
        const stCrossA = addBox(detail, 11.2, 0.18, 0.45, m.steelDark, 35.0, yV + 0.38, 0);
        stCrossA.rotation.y = 0.52;
      }
    } else if (isCyberCorridor && !isMillennium && !isSikanderpur) {
      // Corporate Gurugram glass wing fin accents
      addBox(detail, 12.4, yV - 1.2, 3.2, m.cyberTeal, -18.0, (yV - 1.2) * 0.5, -13.2);
      addBox(detail, 13.0, 0.42, 3.6, m.steelChrome, -18.0, yV - 0.9, -13.2);
    } else if (isModelTown) {
      // Portal approach warning gantry on southern departure throat
      addBox(detail, 0.45, 5.4, 13.8, m.steelDark, 38.0, yV + 2.7, 0);
      addBox(detail, 0.55, 0.85, 10.6, m.tactileYellow, 38.0, yV + 5.1, 0);
    } else if (st.name === 'Noida Electronic City') {
      buildNoidaElectronicCityTurnaround(root, detail, m, g, yV);
    }

    [-34, -12, 11, 35].forEach((tx, idx) => {
      addStreetTree(detail, tx + (idx % 2 ? 1.5 : -1.2), 0, 14.2, idx % 2 === 1, 0.84 + (idx % 3) * 0.14, idx * 1.7);
      addStreetTree(detail, tx - (idx % 2 ? 1.0 : -1.4), 0, -14.2, idx % 2 === 0, 0.88 + ((idx + 1) % 3) * 0.13, idx * 2.3);
    });
    // Crisp white pedestrian crosswalk stripes at station sidewalk forecourt
    [-34, 34].forEach((cx) => {
      for (let zi = -4.0; zi <= 4.0; zi += 2.0) {
        addBox(detail, 2.6, 0.06, 0.9, m.crosswalkWhite, cx, 0.27, 11.4 + zi * 0.24);
      }
    });

    root.add(detail);
    return { root, detail, signMeshes, pidsMesh: pFront };
  }

  function buildUndergroundCutawayStation(st, secColor) {
    const m = getMaterials();
    const g = getSharedStationGeos();
    const root = new THREE.Group();
    const detail = new THREE.Group();
    const isMegaHub = st.name === 'Kashmere Gate';
    const isSide = UNDERGROUND_SIDE_STATIONS.has(st.name);
    const depthM = Math.abs(st.elevM || 18);
    const isDeepCofferdam = depthM >= 25;
    const secMat = secColor ? new THREE.MeshBasicMaterial({ color: secColor }) : null;

    // Chamber lateral spans expand cleanly for Side-Platform stations (tracks run down center!)
    const apronD = isSide ? 32.0 : 27.6;
    const parkZ = isSide ? 14.8 : 12.6;
    const floorD = isSide ? 26.6 : 23.6;
    const rearWallZ = isSide ? -13.0 : -11.0;
    const tileWallZ = isSide ? -11.75 : -9.75;
    const friezeZ = isSide ? -11.68 : -9.68;
    const frontCopingZ = isSide ? 12.4 : 10.8;
    const roofZ = isSide ? -14.0 : -12.0;
    const rafterD = isSide ? 25.8 : 22.0;

    // Trimmed station promenade apron + narrow median planting (respects adjacent real streets!)
    addBox(root, 88, 0.20, apronD, m.plazaPave, 0, 0.24, 0);
    addBox(root, 86, 0.24, 2.4, m.sagePark, 0, 0.27, -parkZ);
    addBox(root, 86, 0.24, 2.2, m.sagePark, 0, 0.27, parkZ);

    // 1. Deep Architectural Cutaway Trench Floor + Stepped Slate Walls + Subway Tile Back Wall
    addBox(root, 88, 0.32, floorD, m.trenchFloor, 0, 0.36, 0);
    addBox(root, 88, isDeepCofferdam ? 9.6 : 7.6, 2.4, m.slateCut, 0, isDeepCofferdam ? 4.9 : 3.9, rearWallZ);
    addBox(root, 82, isDeepCofferdam ? 8.0 : 6.4, 0.45, m.tileWall, 0, isDeepCofferdam ? 4.5 : 3.7, tileWallZ);
    addBox(root, 82, 0.72, 0.50, m.tactileYellow, 0, 4.4, friezeZ);
    if (secMat) addBox(root, 82, 0.42, 0.50, secMat, 0, 3.65, friezeZ);

    if (isDeepCofferdam) {
      // Deep tube stepped concrete diaphragm ribs & rock-anchor cofferdam beam (Chawri Bazar -30m, Hauz Khas -28m)
      addBox(root, 88, 1.1, 1.8, m.concreteWeb, 0, 9.8, rearWallZ);
      [-30, -15, 0, 15, 30].forEach((bx) => {
        addBox(detail, 1.4, 9.2, 0.9, m.concreteWeb, bx, 4.8, rearWallZ + 1.05);
      });
    }

    // Front Viewing Curb Coping (clean low architectural lip peering onto tracks & platform!)
    addBox(root, 88, 1.35, 1.6, m.slateCut, 0, 0.85, frontCopingZ);
    addBox(root, 88, 0.36, 1.9, m.concreteLight, 0, 1.62, frontCopingZ);

    // Top Street Overhang Deck & Transverse Skylight Ceiling Rafters
    addBox(root, 88, 0.85, 8.8, m.concreteLight, 0, 7.8, roofZ);
    [-32, -19.2, -6.4, 6.4, 19.2, 32].forEach((rx) => {
      addBox(detail, 0.75, 0.75, rafterD, m.steelDark, rx, 7.6, isSide ? -0.4 : 0);
    });
    addBox(detail, 80, 0.24, 7.2, m.skylightGlass, 0, 8.05, isSide ? -6.2 : -5.0);

    // Upper Mezzanine Concourse Balcony inside chamber + AFC Turnstiles + Twin Escalators
    const mezzZ = isSide ? -9.5 : -7.5;
    addBox(detail, 32, 0.6, 5.0, m.concreteLight, -2.0, 4.6, mezzZ);
    addAFCTurnstiles(detail, -2.0, 4.9, mezzZ + 0.5, 5);
    addBox(detail, 32, 0.85, 0.12, m.glassBarrier, -2.0, 5.3, mezzZ + 2.5);
    if (!isSide) {
      [-8.0, -3.5].forEach((ex) => {
        const esc = addBox(detail, 2.1, 0.65, 10.2, m.escStep, ex, 2.9, -2.4);
        esc.rotation.x = 0.48;
        const eGlass = addBox(detail, 2.25, 1.1, 10.2, m.escGlass, ex, 3.35, -2.4);
        eGlass.rotation.x = 0.48;
      });
    }

    // 2. Platforms (Side Decks at ±9.3m OR Central Island 4.8m) + Tactile Strips + PSDs + Live PIDS + Commuters
    let pidsPanel;
    if (isSide) {
      // Open dual tracks down the middle separated by low yellow-topped track divider
      addBox(root, 72, 0.50, 0.36, m.slateCut, 0, SUBWAY_Y + 0.25, 0);
      addBox(root, 72, 0.12, 0.40, m.tactileYellow, 0, SUBWAY_Y + 0.52, 0);

      // Two outer side terrazzo platforms at ±9.3m (width 4.6m -> inner face ±7.0m, 0.66m clear of trains!)
      [-9.3, 9.3].forEach((pz, sIdx) => {
        const sgn = Math.sign(pz);
        addBox(root, 74, 1.65, 4.6, m.terrazzoDeck, 0, SUBWAY_Y + 0.82, pz);
        addBox(detail, 74, 0.12, 0.44, m.tactileYellow, 0, SUBWAY_Y + 1.68, pz - sgn * 1.98);
        addBox(detail, 60, 1.65, 0.14, m.glassBarrier, 0, SUBWAY_Y + 2.50, pz - sgn * 2.15);
        addBox(detail, 60, 0.22, 0.18, m.yellowAccent, 0, SUBWAY_Y + 3.40, pz - sgn * 2.15);
        for (let px = -26; px <= 26; px += 5.2) {
          addBox(detail, 0.20, 1.75, 0.20, m.steelDark, px, SUBWAY_Y + 2.55, pz - sgn * 2.15);
          addBox(detail, 0.48, 0.14, 0.22, m.ledGreen, px + 2.6, SUBWAY_Y + 3.55, pz - sgn * 2.15);
        }
        addBox(detail, 4.2, 0.55, 1.1, m.steelChrome, -16, SUBWAY_Y + 1.92, pz + sgn * 0.95);
        addBox(detail, 4.2, 0.55, 1.1, m.steelChrome, 17, SUBWAY_Y + 1.92, pz + sgn * 0.95);
        addCommuters(detail, [
          [-21, SUBWAY_Y + 1.65, pz - sgn * 0.85, sIdx * 2],
          [-3, SUBWAY_Y + 1.65, pz - sgn * 0.90, sIdx * 2 + 1],
          [14, SUBWAY_Y + 1.65, pz - sgn * 0.80, sIdx + 3]
        ]);
      });

      // Paid Overhead Transfer Skybridge spanning ABOVE both center tracks between Platform 1 & Platform 2!
      addBox(root, 10.6, 0.55, 18.2, m.concreteLight, -4.0, 5.2, 0);
      [-9.2, 1.2].forEach((bx) => addBox(detail, 0.16, 1.05, 18.0, m.glassBarrier, bx, 6.0, 0));
      [-8.5, 8.5].forEach((tz, i) => {
        const sEsc = addBox(detail, 2.0, 0.55, 9.0, m.escStep, 3.0, 3.3, tz * 0.65);
        sEsc.rotation.z = i === 0 ? -0.46 : 0.46;
      });
      // Suspended PIDS under the skybridge facing platforms
      addBox(detail, 9.6, 2.2, 0.42, m.pidsHousing, 10, SUBWAY_Y + 5.6, -7.8);
      pidsPanel = addBox(detail, 9.0, 1.85, 0.48, m.placeholderSign, 10, SUBWAY_Y + 5.6, -7.8);
      pidsPanel.frustumCulled = false;

      // End chamber wing walls flanking TBM collars behind ±9.3m side platforms
      [-41.5, 41.5].forEach((xEnd) => {
        [-9.4, 9.4].forEach((wz) => addBox(root, 2.8, 5.8, 5.8, m.slateCut, xEnd, 3.0, wz));
      });
    } else {
      // Central Island Deck (4.8m width -> ±2.4m, zero overlap with ±4.6m trains)
      addBox(root, 72, 1.65, 4.8, m.terrazzoDeck, 0, SUBWAY_Y + 0.82, 0);
      [-2.18, 2.18].forEach((tz) => {
        addBox(detail, 72, 0.12, 0.44, m.tactileYellow, 0, SUBWAY_Y + 1.68, tz);
        addBox(detail, 60, 1.65, 0.14, m.glassBarrier, 0, SUBWAY_Y + 2.50, tz);
        addBox(detail, 60, 0.22, 0.18, m.yellowAccent, 0, SUBWAY_Y + 3.40, tz);
        for (let px = -28; px <= 28; px += 4.6) {
          addBox(detail, 0.20, 1.75, 0.20, m.steelDark, px, SUBWAY_Y + 2.55, tz);
          addBox(detail, 0.48, 0.14, 0.22, m.ledGreen, px + 2.3, SUBWAY_Y + 3.55, tz);
        }
      });
      [-22, -7, 8, 23].forEach((cx) => {
        addBox(detail, 0.72, 7.2, 0.72, m.steelChrome, cx, SUBWAY_Y + 4.4, 0);
        addBox(detail, 0.80, 0.75, 0.80, m.yellowAccent, cx, SUBWAY_Y + 2.8, 0);
        if (secMat) addBox(detail, 0.80, 0.42, 0.80, secMat, cx, SUBWAY_Y + 2.15, 0);
      });

      // Digital PIDS Display (material bound lazily via ensureStationSignage)
      addBox(detail, 9.6, 2.2, 0.42, m.pidsHousing, 10, SUBWAY_Y + 5.2, 0);
      pidsPanel = addBox(detail, 9.0, 1.85, 0.48, m.placeholderSign, 10, SUBWAY_Y + 5.2, 0);
      pidsPanel.frustumCulled = false;

      // Steel Benches & Commuters
      addBox(detail, 4.2, 0.55, 1.1, m.steelChrome, -16, SUBWAY_Y + 1.92, 0);
      addBox(detail, 4.2, 0.55, 1.1, m.steelChrome, 17, SUBWAY_Y + 1.92, 0);
      addCommuters(detail, [
        [-23, SUBWAY_Y + 1.65, 1.0, 0], [-11, SUBWAY_Y + 1.65, -0.95, 1],
        [2, SUBWAY_Y + 1.65, 0.95, 2], [20, SUBWAY_Y + 1.65, -0.95, 4]
      ]);
    }

    // 3. Open cutaway chamber ends (no protruding TBM tube rings blocking either end; trench connects seamlessly)
    // End retaining pilasters frame the transition into the open-cut corridor cleanly
    [-43.2, 43.2].forEach((xEnd) => {
      addBox(root, 1.4, isDeepCofferdam ? 9.6 : 7.6, 2.2, m.slateCut, xEnd, isDeepCofferdam ? 4.9 : 3.9, rearWallZ);
    });

    // 4. Station Street Entrance Pavilion (custom architectural vocabulary per iconic hub!)
    const kioskZ = isSide ? -14.0 : -12.0;
    const isRedBrickCampus = st.name === 'Vishwavidyalaya';
    const isAssemblyPortico = st.name === 'Vidhan Sabha';
    const isOldDelhiMughal = st.name === 'Chandni Chowk';
    const isChawriDeep = st.name === 'Chawri Bazar';
    const isNewDelhiRail = st.name === 'New Delhi';
    const isRajivRotunda = st.name === 'Rajiv Chowk';
    const isCentralSec = st.name === 'Central Secretariat';
    const isLutyens = st.name === 'Udyog Bhawan' || st.name === 'Lok Kalyan Marg' || st.name === 'Jor Bagh';
    const isDilliHaat = st.name === 'Dilli Haat - INA';
    const isAiims = st.name === 'AIIMS';
    const isHauzKhas = st.name === 'Hauz Khas';

    if (isOldDelhiMughal || isCentralSec) {
      // Mughal / Lutyens Dholpur Red & Buff Sandstone Arched Gatehouse + White Marble Chhatri Cupolas
      addBox(root, 13.4, 4.2, 7.2, m.qutabRedStone, -18.0, 10.1, kioskZ);
      addBox(root, 14.4, 0.65, 8.2, m.sandstoneBuff, -18.0, 12.4, kioskZ);
      [-21.2, -14.8].forEach((cx) => {
        addBox(root, 2.4, 2.4, 2.4, m.sandstoneBuff, cx, 13.8, kioskZ);
        const dome = new THREE.Mesh(g.commuterHead, m.whiteMarble);
        dome.scale.set(5.4, 5.4, 5.4);
        dome.position.set(cx, 15.6, kioskZ);
        const finial = new THREE.Mesh(g.cyl1, m.brassGold);
        finial.scale.set(0.14, 1.4, 0.14);
        finial.position.set(cx, 17.6, kioskZ);
        dome.frustumCulled = finial.frustumCulled = false;
        root.add(dome, finial);
      });
    } else if (isRedBrickCampus) {
      // Delhi University North Campus Red Brick Gatehouse + Sandstone Quoin Trim
      addBox(root, 13.2, 4.0, 6.8, m.brickRed, -18.0, 10.0, kioskZ);
      addBox(root, 14.0, 0.58, 7.6, m.sandstoneBuff, -18.0, 12.2, kioskZ);
      addBox(detail, 10.4, 0.18, 0.45, m.steelDark, 32.0, SUBWAY_Y + 0.38, 0);
    } else if (isAssemblyPortico) {
      // Georgian White/Cream Fluted Colonnade Portico echoing Old Delhi Secretariat
      addBox(root, 13.4, 4.0, 6.8, m.lutyensCream, -18.0, 10.0, kioskZ);
      addBox(root, 14.4, 0.62, 7.8, m.sandstoneBuff, -18.0, 12.2, kioskZ);
      [-23.2, -19.8, -16.2, -12.8].forEach((cx) => {
        const col = new THREE.Mesh(g.cyl1, m.whiteMarble);
        col.scale.set(0.45, 4.2, 0.45);
        col.position.set(cx, 10.0, kioskZ + 3.6);
        col.frustumCulled = false;
        root.add(col);
      });
    } else if (isRajivRotunda) {
      // Twin Iconic Connaught Place Radial Georgian Rotundas flanking the block
      [-18.0, 16.0].forEach((rx) => {
        const rot = new THREE.Mesh(g.cyl1, m.lutyensCream);
        rot.scale.set(5.4, 4.2, 5.4);
        rot.position.set(rx, 10.0, kioskZ);
        const cap = new THREE.Mesh(g.cyl1, m.whiteMarble);
        cap.scale.set(5.8, 0.55, 5.8);
        cap.position.set(rx, 12.3, kioskZ);
        rot.frustumCulled = cap.frustumCulled = false;
        root.add(rot, cap);
      });
    } else if (isChawriDeep) {
      // Chawri Bazar -30m Deepest Station: Twin Tall Glazed Express Elevator Drum Towers
      [-21.5, -14.5].forEach((ex) => {
        const cyl = new THREE.Mesh(g.cyl1, m.concourseGlass);
        cyl.scale.set(2.4, 14.0, 2.4);
        cyl.position.set(ex, 7.2, kioskZ);
        const ringCap = new THREE.Mesh(g.cyl1, m.dmrcBlueRoof);
        ringCap.scale.set(2.8, 0.55, 2.8);
        ringCap.position.set(ex, 14.3, kioskZ);
        cyl.frustumCulled = ringCap.frustumCulled = false;
        root.add(cyl, ringCap);
      });
    } else if (isNewDelhiRail) {
      // Standard kiosk + Iconic Glazed NDLS Foot-Over-Bridge Steel Skywalk Truss across plaza
      addBox(root, 12.2, 3.8, 6.6, m.concourseGlass, -18.0, 9.9, kioskZ);
      addBox(root, 13.6, 0.54, 8.0, m.dmrcBlueRoof, -18.0, 12.1, kioskZ);
      addBox(root, 7.2, 3.8, 22.0, m.cyberTeal, 18.0, 11.4, -2.0);
      addBox(root, 7.8, 0.55, 22.6, m.steelChrome, 18.0, 13.4, -2.0);
    } else if (isHauzKhas) {
      // Hauz Khas Sculptural Glazed Skylight Pyramid Atrium + Deep -28m shaft
      addBox(root, 12.2, 3.8, 6.6, m.concourseGlass, -18.0, 9.9, kioskZ);
      addBox(root, 13.6, 0.54, 8.0, m.dmrcBlueRoof, -18.0, 12.1, kioskZ);
      const pyr = new THREE.Mesh(g.cyl1, m.skylightGlass);
      pyr.scale.set(5.4, 4.6, 5.4);
      pyr.rotation.y = Math.PI / 4;
      pyr.position.set(6.0, 10.2, kioskZ + 2.0);
      pyr.frustumCulled = false;
      root.add(pyr);
    } else if (isDilliHaat) {
      // Dilli Haat Warm Terracotta Craft Bazaar Louver Canopy Pavilion
      addBox(root, 13.2, 3.8, 6.8, m.concourseGlass, -18.0, 9.9, kioskZ);
      addBox(root, 15.2, 0.65, 8.6, m.terracotta, -18.0, 12.1, kioskZ);
      [-23, -18, -13].forEach((lx) => addBox(detail, 1.1, 0.4, 8.8, m.sandstoneBuff, lx, 12.55, kioskZ));
    } else {
      addBox(root, 12.2, 3.8, 6.6, isAiims ? m.cyberTeal : m.concourseGlass, -18.0, 9.9, kioskZ);
      addBox(root, 13.6, 0.54, 8.0, isLutyens ? m.sandstoneBuff : m.dmrcBlueRoof, -18.0, 12.1, kioskZ);
    }

    const roundel = new THREE.Mesh(g.roundelCyl, m.roundelRed);
    roundel.rotation.x = Math.PI / 2;
    roundel.scale.set(1.65, 1.0, 1.65);
    roundel.position.set(-18.0, 13.5, kioskZ + 3.4);
    roundel.frustumCulled = false;
    root.add(roundel);

    // 5. Bilingual Navy & Yellow DMRC Nameplates (material bound lazily via ensureStationSignage)
    const sbWall = new THREE.Mesh(g.box1, m.placeholderSign);
    sbWall.scale.set(22.0, 3.4, 0.35);
    sbWall.position.set(12.0, 5.2, tileWallZ + 0.40);
    const sbTop = new THREE.Mesh(g.box1, m.placeholderSign);
    sbTop.scale.set(24.0, 3.8, 0.38);
    sbTop.position.set(12.0, 9.4, isSide ? -10.5 : -8.5);
    sbWall.frustumCulled = sbTop.frustumCulled = false;
    root.add(sbWall, sbTop);

    // 6. Interchange Cross-Features & Kashmere Gate Monument Arch
    const hasGenuineHub = Boolean(interchangeHubsData && interchangeHubsData.hubs && interchangeHubsData.hubs[st.name]);
    if (isMegaHub) {
      // Historic Red Sandstone Kashmiri Gate Arched Gatehouse Accent on NW Promenade
      [-14.5, -9.5].forEach((gx) => addBox(root, 1.8, 5.2, 2.2, m.qutabRedStone, gx, 2.8, rearWallZ - 2.6));
      addBox(root, 7.6, 1.5, 2.5, m.qutabRedStone, -12.0, 5.8, rearWallZ - 2.6);
      addBox(detail, 8.2, 0.45, 2.9, m.sandstoneBuff, -12.0, 6.75, rearWallZ - 2.6);
    }
    if (hasGenuineHub) {
      // Genuine OSM/GTFS interchange geometry attached via attachGenuineInterchangeGeometry()
    } else if (isMegaHub) {
      // Sculpted Red Line elevated girder bridge + parapets + ballast + steel rails + Venetian crimson vaulted canopy!
      addBox(root, 17.5, 2.2, 70, m.concreteLight, 0, VIADUCT_Y - 0.8, 0);
      addBox(root, 11.5, 1.8, 70, m.concreteWeb, 0, VIADUCT_Y - 2.3, 0);
      [-8.45, 8.45].forEach((px) => addBox(root, 0.55, 1.05, 70, m.concreteWeb, px, VIADUCT_Y + 0.72, 0));
      [-3.8, 3.8].forEach((tx) => {
        addBox(root, 3.0, 0.22, 68, m.slateCut, tx, VIADUCT_Y + 0.38, 0);
        [-0.95, 0.95].forEach((rx) => addBox(root, 0.16, 0.18, 68, m.railCrown, tx + rx, VIADUCT_Y + 0.56, 0));
      });
      [-26, 26].forEach((cz) => {
        const pS = new THREE.Mesh(g.pierShaft, m.pierCream);
        pS.scale.set(1.15, VIADUCT_Y - 3.5, 1.15);
        pS.position.set(10.5, (VIADUCT_Y - 3.5) * 0.5, cz);
        pS.frustumCulled = false;
        root.add(pS);
        addBox(root, 15.0, 1.5, 3.6, m.concreteLight, 2.5, VIADUCT_Y - 2.8, cz);
      });
      // Red Line vaulted barrel roof + steel ribs spanning perpendicularly along local Z
      const redRoofCyl = new THREE.Mesh(
        new THREE.CylinderGeometry(11.0, 11.0, 56, 20, 1, true, g.arcStart, g.arcSpan),
        m.redRoof
      );
      redRoofCyl.rotation.order = 'YXZ';
      redRoofCyl.rotation.z = Math.PI / 2;
      redRoofCyl.rotation.y = Math.PI / 2;
      redRoofCyl.position.set(0, VIADUCT_Y + 0.8, 0);
      redRoofCyl.frustumCulled = false;
      root.add(redRoofCyl);
      [-24, -12, 0, 12, 24].forEach((rz) => {
        const rArch = new THREE.Mesh(new THREE.TorusGeometry(11.0, 0.25, 6, 16, g.arcSpan), m.steelDark);
        rArch.position.set(0, VIADUCT_Y + 0.8, rz);
        rArch.rotation.z = g.arcStart;
        rArch.frustumCulled = false;
        detail.add(rArch);
      });
      // Framed glass transfer elevator tower at Kashmere Gate plaza corner + Violet Line sub-bay accent
      addBox(root, 5.2, VIADUCT_Y + 2.0, 5.2, m.glassBarrier, 21.0, (VIADUCT_Y + 2.0) * 0.5, 14.2);
      addBox(root, 5.8, 0.55, 5.8, m.redRoof, 21.0, VIADUCT_Y + 2.25, 14.2);
      [[-2.5, -2.5], [2.5, -2.5], [-2.5, 2.5], [2.5, 2.5]].forEach(([mx, mz]) => {
        addBox(detail, 0.30, VIADUCT_Y + 2.1, 0.30, m.steelDark, 21.0 + mx, (VIADUCT_Y + 2.0) * 0.5, 14.2 + mz);
      });
      addBox(root, 1.4, 0.35, 70.2, new THREE.MeshBasicMaterial({ color: 0xB9382E }), 0, VIADUCT_Y + 0.42, 0);
      // Subterranean Violet Line cross apron below Yellow platform
      addBox(root, 11.2, 1.8, 25.4, m.slateCut, -14.0, 1.0, 0);
      addBox(root, 2.0, 0.34, 25.8, new THREE.MeshBasicMaterial({ color: 0x7C3AED }), -14.0, 2.05, 0);
    } else if (secColor) {
      // Dock compact transverse interchange bay strictly inside the station promenade apron
      addBox(root, 13.2, 2.1, isSide ? 28.0 : 24.4, m.slateCut, 0, 1.15, 0);
      addBox(root, 2.2, 0.34, isSide ? 28.4 : 24.8, secMat, 0, 2.28, 0);
    }

    const treeZ = isSide ? 15.2 : 13.1;
    [-34, -8, 16, 35].forEach((tx, idx) => {
      addStreetTree(detail, tx + (idx % 2 ? 1.4 : -1.2), 0, -treeZ, idx % 2 === 0, 0.86 + (idx % 3) * 0.14, idx * 1.9);
      addStreetTree(detail, tx - (idx % 2 ? 1.0 : -1.5), 0, treeZ - 0.1, idx % 2 === 1, 0.84 + ((idx + 1) % 3) * 0.15, idx * 2.5);
    });

    root.add(detail);
    return { root, detail, signMeshes: [sbWall, sbTop], pidsMesh: pidsPanel };
  }

  /**
   * Rajiv Chowk Cruciform Two-Level Interchange Hub (Connaught Place)
   * - Unified architectural monument preventing duplicate 88m station overlap & track collision:
   *   1) Lower Sunken Cutaway (Yellow Line, SUBWAY_Y = 0.28m): 4.8m terrazzo island, PSDs, twin 6.4m arched TBM portals
   *   2) Upper Cross-Bridge Deck (Blue Line, BLUE_RC_Y = 7.6m): open 112m x 19.6m deck, cobalt-blue fascia, outer side platforms
   *   3) Vertical Core: 4 island-to-bridge diagonal escalators + 2 framed glazed lift towers
   *   4) Connaught Place Inner Circle Podium (PLAZA_Y = 4.0m): perforated radial sandstone/park plaza + 4 Georgian colonnade arcs
   */
  function buildRajivChowkCruciformHub(yellowSt, blueSt, secColor) {
    const m = getMaterials();
    const g = getSharedStationGeos();
    const root = new THREE.Group();
    const detail = new THREE.Group();

    const PLAZA_Y = 4.0;
    const BLUE_RC_Y = 7.6;

    const addShapeMesh = (target, shape, depth, mats, yBase) => {
      const geo = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: false, curveSegments: 48 });
      const mesh = new THREE.Mesh(geo, mats);
      mesh.rotation.x = -Math.PI / 2;
      mesh.position.y = yBase;
      mesh.frustumCulled = false;
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      target.add(mesh);
      return mesh;
    };

    // Exact relative projection of Blue Line center & crossing angle into Yellow station local frame
    const yTan = yellowSt.tan;
    const dxW = blueSt.pos.x - yellowSt.pos.x;
    const dzW = blueSt.pos.z - yellowSt.pos.z;
    const bx = dxW * yTan.x + dzW * yTan.z;
    const bz = dxW * (-yTan.z) + dzW * yTan.x;
    const tbx = blueSt.tan.x * yTan.x + blueSt.tan.z * yTan.z;
    const tbz = blueSt.tan.x * (-yTan.z) + blueSt.tan.z * yTan.x;
    const relYaw = Math.atan2(-tbz, tbx);

    // 1. Cruciform Sunken Cutaway Floor (0.25m..0.34m) under Yellow & central Blue bay
    addBox(root, 108, 0.24, 23.0, m.trenchFloor, 0, 0.16, 0);
    addBox(root, 33, 0.24, 45.0, m.trenchFloor, 0, 0.16, 0);

    // 2. Perforated Connaught Place Podium Deck (y = 0.25m -> 4.0m) with crisp cruciform open pit hole
    const cpOuterR = 61.5;
    const plazaShape = new THREE.Shape();
    for (let i = 0; i < 48; i++) {
      const a = (i / 48) * Math.PI * 2;
      const px = Math.cos(a) * cpOuterR;
      const py = Math.sin(a) * cpOuterR;
      if (i === 0) plazaShape.moveTo(px, py);
      else plazaShape.lineTo(px, py);
    }
    plazaShape.closePath();

    // Clockwise hole in Shape XY plane leaving open cruciform sunken canyon down to 0.28m
    const pitHole = new THREE.Path();
    const holePts = [
      [-52.0, -11.3], [-52.0, 11.3], [-16.2, 11.3], [-16.2, 22.2],
      [16.2, 22.2], [16.2, 11.3], [52.0, 11.3], [52.0, -11.3],
      [16.2, -11.3], [16.2, -22.2], [-16.2, -22.2], [-16.2, -11.3]
    ];
    pitHole.moveTo(holePts[0][0], holePts[0][1]);
    for (let i = 1; i < holePts.length; i++) pitHole.lineTo(holePts[i][0], holePts[i][1]);
    pitHole.closePath();
    plazaShape.holes.push(pitHole);

    addShapeMesh(root, plazaShape, PLAZA_Y - 0.25, [m.plazaPave, m.slateCut], 0.25);

    // Outer chamfered sage-green park collar tapering CP Podium (r=61.4..72.2m) down to street grade (0.22m)
    const skirtProfile = [
      new THREE.Vector2(61.4, 0.22),
      new THREE.Vector2(72.2, 0.22),
      new THREE.Vector2(65.5, 2.20),
      new THREE.Vector2(61.4, PLAZA_Y)
    ];
    const skirtMat = m.sagePark.clone();
    skirtMat.side = THREE.DoubleSide;
    const skirtMesh = new THREE.Mesh(new THREE.LatheGeometry(skirtProfile, 48), skirtMat);
    skirtMesh.frustumCulled = false;
    skirtMesh.receiveShadow = true;
    root.add(skirtMesh);

    // Radial park quadrants + Georgian White Colonnades in the 4 inter-rail sectors
    // In Shape XY (mesh rot.x = -PI/2 -> x_3d=x_s, z_3d=-y_s), sector angle phi satisfies x=r cos(phi), z=-r sin(phi)
    const phiB = Math.atan2(-tbz, tbx);
    const exitAngles = [0, phiB, Math.PI, phiB + Math.PI]
      .map((a) => ((a % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2))
      .sort((a, b) => a - b);

    const buildRadialSector = (r0, r1, a0, a1, height, mat, yBase, targetGroup) => {
      const segs = 16;
      const sh = new THREE.Shape();
      for (let i = 0; i <= segs; i++) {
        const a = a0 + (a1 - a0) * (i / segs);
        const px = Math.cos(a) * r1;
        const py = Math.sin(a) * r1;
        if (i === 0) sh.moveTo(px, py);
        else sh.lineTo(px, py);
      }
      for (let i = segs; i >= 0; i--) {
        const a = a0 + (a1 - a0) * (i / segs);
        sh.lineTo(Math.cos(a) * r0, Math.sin(a) * r0);
      }
      sh.closePath();
      addShapeMesh(targetGroup, sh, height, mat, yBase);
    };

    const cobaltMat = new THREE.MeshStandardMaterial({
      color: 0x2563EB,
      emissive: 0x1D4ED8,
      emissiveIntensity: 0.22,
      roughness: 0.34,
      metalness: 0.16
    });
    const porticoWindowMat = new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.55, metalness: 0.2 });

    for (let q = 0; q < 4; q++) {
      const aStart = exitAngles[q];
      const aEnd = q < 3 ? exitAngles[q + 1] : exitAngles[0] + Math.PI * 2;
      const span = aEnd - aStart;
      if (span < 0.65) continue;

      // Inner Central Park sage grass wedges separated by radial ivory pathways
      const wedgePad = 0.25;
      const midA = (aStart + aEnd) * 0.5;
      if (span > 2 * wedgePad + 0.16) {
        buildRadialSector(25.0, 34.0, aStart + wedgePad, midA - 0.04, 0.06, m.sagePark, PLAZA_Y + 0.01, detail);
        buildRadialSector(25.0, 34.0, midA + 0.04, aEnd - wedgePad, 0.06, m.sagePark, PLAZA_Y + 0.01, detail);
        buildRadialSector(35.5, 44.0, aStart + wedgePad, midA - 0.04, 0.06, m.sagePark, PLAZA_Y + 0.01, detail);
        buildRadialSector(35.5, 44.0, midA + 0.04, aEnd - wedgePad, 0.06, m.sagePark, PLAZA_Y + 0.01, detail);
      }

      // 4 Curved White Georgian Connaught Place Colonnade Quadrant Arcs (clear of rail corridors!)
      const colPad = 0.24;
      const cA0 = aStart + colPad;
      const cA1 = aEnd - colPad;
      if (cA1 - cA0 > 0.35) {
        // Main curved Georgian building core + upper white marble cornice + stepped roof parapet
        buildRadialSector(48.3, 53.5, cA0, cA1, 6.2, m.lutyensCream, PLAZA_Y, root);
        buildRadialSector(46.9, 54.9, cA0 - 0.012, cA1 + 0.012, 0.55, m.whiteMarble, PLAZA_Y + 6.2, root);
        buildRadialSector(47.4, 54.4, cA0, cA1, 0.72, m.lutyensCream, PLAZA_Y + 6.75, detail);
        // Dark window arcade bands behind both inner & outer colonnade galleries
        buildRadialSector(48.1, 48.35, cA0 + 0.02, cA1 - 0.02, 5.1, porticoWindowMat, PLAZA_Y + 0.5, detail);
        buildRadialSector(53.45, 53.7, cA0 + 0.02, cA1 - 0.02, 5.1, porticoWindowMat, PLAZA_Y + 0.5, detail);

        // Two-sided classical white colonnade pillars along both inner (47.3m) and outer (54.5m) arcades
        const nCols = Math.max(7, Math.round((cA1 - cA0) * 14));
        for (let ci = 0; ci <= nCols; ci++) {
          const ca = cA0 + (cA1 - cA0) * (ci / nCols);
          [47.3, 54.5].forEach((rCol) => {
            const colX = Math.cos(ca) * rCol;
            const colZ = -Math.sin(ca) * rCol;
            const col = new THREE.Mesh(g.cyl1, m.whiteMarble);
            col.scale.set(0.36, 5.9, 0.36);
            col.position.set(colX, PLAZA_Y + 2.95, colZ);
            col.frustumCulled = false;
            root.add(col);
          });
        }
      }
    }

    // 3. Lower Level (Yellow Line, SUBWAY_Y = 0.28m): Terrazzo Island Platform, PSDs & Arched TBM Portals
    addBox(root, 94, 1.65, 4.8, m.terrazzoDeck, 0, SUBWAY_Y + 0.82, 0);
    [-2.02, 2.02].forEach((tz) => {
      addBox(detail, 94, 0.12, 0.44, m.tactileYellow, 0, SUBWAY_Y + 1.68, tz);
      addBox(detail, 76, 1.55, 0.14, m.glassBarrier, 0, SUBWAY_Y + 2.50, tz - Math.sign(tz) * 0.12);
      addBox(detail, 76, 0.20, 0.18, m.yellowAccent, 0, SUBWAY_Y + 3.38, tz - Math.sign(tz) * 0.12);
      for (let px = -34; px <= 34; px += 6.2) {
        addBox(detail, 0.18, 1.65, 0.18, m.steelDark, px, SUBWAY_Y + 2.55, tz - Math.sign(tz) * 0.12);
      }
    });
    addBox(detail, 4.4, 0.60, 1.1, m.steelChrome, -30, SUBWAY_Y + 1.95, 0);
    addBox(detail, 4.4, 0.60, 1.1, m.steelChrome, 30, SUBWAY_Y + 1.95, 0);
    addCommuters(detail, [
      [-36, SUBWAY_Y + 1.65, -0.9, 0], [-28, SUBWAY_Y + 1.65, 1.0, 2],
      [28, SUBWAY_Y + 1.65, -0.9, 1], [37, SUBWAY_Y + 1.65, 0.9, 3]
    ]);

    // Twin Monumental Arched Concrete TBM Tunnel Portals flush inside North/South trench ends (x = ±52m)
    [-52.0, 52.0].forEach((xP) => {
      const sgn = Math.sign(xP);
      // Concrete headwall spanning 23m trench width inside CP podium perimeter (zero outward protrusion)
      addBox(root, 4.2, 6.0, 22.8, m.concreteLight, xP + sgn * 1.9, 3.20, 0);
      addBox(root, 4.8, 0.50, 23.4, m.sandstoneBuff, xP + sgn * 1.9, 6.35, 0);
      // Sub-plaza deck seal kept strictly inside r <= 61.4m radius
      addBox(root, 7.6, 0.55, 22.2, m.concreteWeb, xP + sgn * 5.2, PLAZA_Y - 0.18, 0);
      [-TRACK_HALF_SEP, TRACK_HALF_SEP].forEach((tz) => {
        const arch = new THREE.Mesh(g.tbmArch, m.concreteLight);
        arch.rotation.z = Math.PI / 2;
        arch.position.set(xP - sgn * 0.2, SUBWAY_Y + 2.0, tz);
        arch.scale.set(1.22, 2.35, 1.0);
        arch.frustumCulled = false;
        root.add(arch);

        const bore = new THREE.Mesh(g.tbmBore, m.slateDark);
        bore.rotation.z = Math.PI / 2;
        bore.position.set(xP - sgn * 0.1, SUBWAY_Y + 2.0, tz);
        bore.scale.set(1.16, 2.38, 0.95);
        bore.frustumCulled = false;
        root.add(bore);
      });
    });

    // 4. Upper Level (Blue Line Bridge Deck, BLUE_RC_Y = 7.6m) oriented strictly along Blue corridor
    const blueDeckGrp = new THREE.Group();
    blueDeckGrp.position.set(bx, 0, bz);
    blueDeckGrp.rotation.y = relYaw;
    root.add(blueDeckGrp);

    // Sleek architectural bridge slab (top 7.56m flush under ballast, soffit 6.50m cleanly clearing 5.45m Yellow trains)
    addBox(blueDeckGrp, 114, 1.06, 19.8, m.concreteLight, 0, BLUE_RC_Y - 0.55, 0);
    // Twin longitudinal structural concrete ribs under slab outer bays
    [-8.2, 8.2].forEach((rz) => addBox(blueDeckGrp, 114, 0.45, 2.2, m.concreteWeb, 0, BLUE_RC_Y - 1.22, rz));
    // Cobalt Blue outer deck edge fascia & upper deck border stripes (boldly legible from aerial oblique view)
    [-9.95, 9.95].forEach((fz) => {
      addBox(blueDeckGrp, 114, 1.35, 0.48, cobaltMat, 0, BLUE_RC_Y + 0.35, fz);
      addBox(blueDeckGrp, 114, 0.22, 0.54, m.concreteLight, 0, BLUE_RC_Y + 1.08, fz);
    });

    // Blue Side Platforms (±6.55m..±9.55m, 100m long, deck top at BLUE_RC_Y + 1.05m = 8.65m)
    [-8.05, 8.05].forEach((pz, sIdx) => {
      const sgn = Math.sign(pz);
      addBox(blueDeckGrp, 100, 1.05, 3.0, m.terrazzoDeck, 0, BLUE_RC_Y + 0.52, pz);
      addBox(blueDeckGrp, 100, 0.10, 0.36, m.tactileYellow, 0, BLUE_RC_Y + 1.08, pz - sgn * 1.24);
      addBox(blueDeckGrp, 100, 0.10, 0.58, cobaltMat, 0, BLUE_RC_Y + 1.08, pz + sgn * 1.18);
      // Outer glass balustrade & cobalt handrail
      addBox(blueDeckGrp, 100, 1.15, 0.12, m.glassBarrier, 0, BLUE_RC_Y + 1.62, pz + sgn * 1.42);
      addBox(blueDeckGrp, 100, 0.14, 0.18, cobaltMat, 0, BLUE_RC_Y + 2.22, pz + sgn * 1.42);
      for (let px = -45; px <= 45; px += 9.0) {
        addBox(blueDeckGrp, 0.18, 1.22, 0.18, m.steelDark, px, BLUE_RC_Y + 1.65, pz + sgn * 1.42);
      }
      addCommuters(blueDeckGrp, [
        [-22, BLUE_RC_Y + 1.05, pz + sgn * 0.25, sIdx],
        [4, BLUE_RC_Y + 1.05, pz - sgn * 0.2, sIdx + 1],
        [24, BLUE_RC_Y + 1.05, pz + sgn * 0.2, sIdx + 2]
      ]);
    });

    // 4 Cylindrical Bridge Columns outside Yellow trench rails (planted at ±26m along Blue, ±8.2m edge)
    [-26.0, 26.0].forEach((cx) => {
      [-8.2, 8.2].forEach((cz) => {
        const pH = BLUE_RC_Y - 1.35;
        const pCol = new THREE.Mesh(g.pierShaft, m.pierCream);
        pCol.scale.set(0.95, pH, 0.95);
        pCol.position.set(cx, pH * 0.5 + 0.15, cz);
        pCol.frustumCulled = false;
        blueDeckGrp.add(pCol);
      });
    });

    // 5. Vertical Transfer Core: 2 Corner Glazed Lift Towers + 4 Diagonal Island-to-Bridge Escalators
    // Two framed glass elevator shafts outside both Yellow & Blue rails in opposite quadrant corners
    [[14.2, -12.6], [-14.2, 12.6]].forEach(([ex, ez]) => {
      const liftH = BLUE_RC_Y + 3.2;
      addBox(blueDeckGrp, 4.4, liftH, 4.4, m.glassBarrier, ex, liftH * 0.5 + 0.15, ez);
      addBox(blueDeckGrp, 4.9, 0.45, 4.9, m.dmrcBlueRoof, ex, liftH + 0.32, ez);
      addBox(blueDeckGrp, 4.9, 0.22, 4.9, cobaltMat, ex, BLUE_RC_Y + 1.10, ez);
      [[-2.1, -2.1], [2.1, -2.1], [-2.1, 2.1], [2.1, 2.1]].forEach(([mx, mz]) => {
        addBox(blueDeckGrp, 0.24, liftH + 0.2, 0.24, m.steelDark, ex + mx, liftH * 0.5 + 0.15, ez + mz);
      });
      // Glazed sky-bridge landing tying elevator shaft cleanly to Blue outer side platform
      const linkZ = Math.sign(ez) * 10.6;
      addBox(blueDeckGrp, 3.6, 0.55, 3.2, m.concreteLight, ex, BLUE_RC_Y + 0.78, linkZ);
      addBox(blueDeckGrp, 3.6, 1.15, 0.12, m.glassBarrier, ex, BLUE_RC_Y + 1.62, linkZ);
    });

    // 4 Diagonal Escalator Flights descending strictly over Yellow central island (z_Y = ±1.15m)
    [
      [-1.05, -1], [-1.05, 1], [1.05, -1], [1.05, 1]
    ].forEach(([ez, dirSign]) => {
      // Slope up from Yellow island (x = dirSign * 24.5, y = 1.93) toward Blue bridge deck (x = dirSign * 11.2, y = 8.45)
      const esc = addBox(detail, 14.8, 0.68, 1.55, m.escStep, dirSign * 17.8, 5.15, ez);
      esc.rotation.z = -dirSign * 0.46;
      const eGlass = addBox(detail, 14.8, 1.15, 1.72, m.escGlass, dirSign * 17.8, 5.65, ez);
      eGlass.rotation.z = -dirSign * 0.46;
    });
    // Intermediate cantilevered transfer balconies linking escalators cleanly to Blue bridge edges
    [-10.2, 10.2].forEach((tx) => {
      addBox(detail, 3.8, 0.55, 5.4, m.concreteLight, tx, BLUE_RC_Y + 0.52, 0);
      addBox(detail, 3.8, 0.14, 5.5, cobaltMat, tx, BLUE_RC_Y + 0.84, 0);
    });

    // 6. Bilingual DMRC Interchange Nameplates & Live PIDS Display
    const sbLower = new THREE.Mesh(g.box1, m.placeholderSign);
    sbLower.scale.set(22.0, 3.2, 0.35);
    sbLower.position.set(16.0, SUBWAY_Y + 4.4, -10.9);
    const sbBridge = new THREE.Mesh(g.box1, m.placeholderSign);
    sbBridge.scale.set(24.0, 3.4, 0.36);
    sbBridge.position.set(0, BLUE_RC_Y + 3.0, -9.55);
    sbLower.frustumCulled = sbBridge.frustumCulled = false;
    root.add(sbLower);
    blueDeckGrp.add(sbBridge);

    addBox(detail, 9.6, 2.2, 0.42, m.pidsHousing, -18, SUBWAY_Y + 4.8, 0);
    const pidsPanel = addBox(detail, 9.0, 1.85, 0.48, m.placeholderSign, -18, SUBWAY_Y + 4.8, 0);

    root.add(detail);
    return { root, detail, signMeshes: [sbLower, sbBridge], pidsMesh: pidsPanel };
  }

  const _hubAccentMatCache = new Map();
  function getHubAccentMats(hexStr) {
    const key = hexStr || '#EC4899';
    if (_hubAccentMatCache.has(key)) return _hubAccentMatCache.get(key);
    const col = new THREE.Color(key);
    const mats = {
      band: new THREE.MeshBasicMaterial({ color: col }),
      trim: new THREE.MeshStandardMaterial({ color: col, roughness: 0.36, metalness: 0.24, side: THREE.DoubleSide }),
      glass: new THREE.MeshStandardMaterial({
        color: col,
        transparent: true,
        opacity: 0.34,
        roughness: 0.16,
        metalness: 0.18,
        side: THREE.DoubleSide
      })
    };
    _hubAccentMatCache.set(key, mats);
    return mats;
  }

  /**
   * Attaches authentic, OSM/GTFS-grounded secondary lines, viaducts/cutaways,
   * stabled trains, transfer skywalks, inclined escalator tubes & glass lift towers
   * for any dual/tri-interchange station in dmrc_interchange_hubs.json.
   */
  function attachGenuineInterchangeGeometry(built, st, hubSpec, m, g) {
    if (!built || !built.root || !hubSpec || !window.maplibregl) return;
    const root = built.root;
    const detail = built.detail || built.root;

    const toLocal = (wx, wy, wz) => {
      const dx = wx - st.pos.x;
      const dz = wz - st.pos.z;
      return new THREE.Vector3(
        dx * st.tan.x + dz * st.tan.z,
        wy,
        -dx * st.tan.z + dz * st.tan.x
      );
    };

    const llToLocal = (ll, y = 0) => {
      const w = toLocalMeters(ll, 0);
      return toLocal(w.x, y, w.z);
    };

    const tanWorldToLocalYaw = (txE, tyN) => {
      // Python tangent = [east, north]; Three.js world vector = (east, -north)
      const wx = txE;
      const wz = -tyN;
      const lx = wx * st.tan.x + wz * st.tan.z;
      const lz = -wx * st.tan.z + wz * st.tan.x;
      return Math.atan2(-lz, lx);
    };

    (hubSpec.arms || []).forEach((arm) => {
      const acc = getHubAccentMats(arm.color);
      const isUg = arm.tier === 'underground';
      const isStacked = arm.tier === 'underground_stacked';
      const deckY = Number(arm.deckY || (isUg ? SUBWAY_Y : VIADUCT_Y));
      const armCenterL = llToLocal(arm.center, deckY);
      const armYaw = tanWorldToLocalYaw(arm.tangent[0], arm.tangent[1]);

      // 1. Resample real clipped OSM/GTFS secondary corridor polyline in primary-local coords
      const rawPts = (arm.trackPolyline || []).map((ll) => llToLocal(ll, 0));
      if (rawPts.length >= 2) {
        const densePts = [];
        let totalArc = 0;
        const arcAtRaw = [0];
        for (let i = 1; i < rawPts.length; i++) {
          totalArc += rawPts[i - 1].distanceTo(rawPts[i]);
          arcAtRaw.push(totalArc);
        }
        // Find distance along polyline closest to armCenterL
        let centerArc = totalArc * 0.5;
        let bestCenterD2 = Infinity;
        for (let i = 0; i < rawPts.length; i++) {
          const d2 = rawPts[i].distanceToSquared(new THREE.Vector3(armCenterL.x, 0, armCenterL.z));
          if (d2 < bestCenterD2) {
            bestCenterD2 = d2;
            centerArc = arcAtRaw[i];
          }
        }

        const stepM = 8.0;
        const nSteps = Math.max(8, Math.ceil(totalArc / stepM));
        const spanSamples = [];
        const flatSpanLen = (arm.stationLen || 84) * 0.56;
        for (let k = 0; k <= nSteps; k++) {
          const targetD = (k / nSteps) * totalArc;
          let segIdx = 0;
          while (segIdx < arcAtRaw.length - 2 && arcAtRaw[segIdx + 1] < targetD) segIdx++;
          const segStart = arcAtRaw[segIdx];
          const segLen = Math.max(0.01, arcAtRaw[segIdx + 1] - segStart);
          const frac = Math.max(0, Math.min(1, (targetD - segStart) / segLen));
          const px = rawPts[segIdx].x + frac * (rawPts[segIdx + 1].x - rawPts[segIdx].x);
          const pz = rawPts[segIdx].z + frac * (rawPts[segIdx + 1].z - rawPts[segIdx].z);
          let yPt = deckY;
          if (isStacked) {
            const dFromHub = Math.abs(targetD - centerArc);
            if (dFromHub > flatSpanLen) {
              const rampFrac = Math.min(1, (dFromHub - flatSpanLen) / 68.0);
              const herm = rampFrac * rampFrac * (3 - 2 * rampFrac);
              yPt = deckY + (SUBWAY_Y + 0.32 - deckY) * herm;
            }
          }
          densePts.push({ pos: new THREE.Vector3(px, yPt, pz), dist: targetD });
        }
        for (let k = 0; k < densePts.length; k++) {
          const prev = densePts[Math.max(0, k - 1)].pos;
          const next = densePts[Math.min(densePts.length - 1, k + 1)].pos;
          const tan = new THREE.Vector3(next.x - prev.x, 0, next.z - prev.z);
          if (tan.lengthSq() < 1e-6) tan.set(1, 0, 0);
          else tan.normalize();
          spanSamples.push({ pos: densePts[k].pos, tan, elev: densePts[k].pos.y, dist: densePts[k].dist });
        }

        const spans = [spanSamples];
        if (isUg) {
          // Open-cut concrete retaining trench + floor + ballast + steel rails
          const trenchProf = [[-8.6, -0.22], [8.6, -0.22], [8.6, 0.08], [-8.6, 0.08]];
          const wallL = [[-8.6, 0.0], [-7.75, 0.0], [-7.75, 3.65], [-8.6, 3.65]];
          const wallR = [[7.75, 0.0], [8.6, 0.0], [8.6, 3.65], [7.75, 3.65]];
          const trimL = [[-7.72, 2.75], [-7.58, 2.75], [-7.58, 3.30], [-7.72, 3.30]];
          const trimR = [[7.58, 2.75], [7.72, 2.75], [7.72, 3.30], [7.58, 3.30]];
          [
            buildRibbonFromSpans(spans, trenchProf, m.trenchFloor, 1.2, false),
            buildRibbonFromSpans(spans, wallL, m.slateCut, 1.2, true),
            buildRibbonFromSpans(spans, wallR, m.slateCut, 1.2, true),
            buildRibbonFromSpans(spans, trimL, acc.band, 2.0, false),
            buildRibbonFromSpans(spans, trimR, acc.band, 2.0, false)
          ].forEach((mesh) => mesh && root.add(mesh));

          // Cutaway end-cap tunnel portals (or clean sealed concrete headwall at dead-end terminus)
          [0, spanSamples.length - 1].forEach((endIdx, ei) => {
            const smp = spanSamples[endIdx];
            const isDeadEnd = arm.isTerminus && ((arm.terminusEnd === 'end' && ei === 1) || (arm.terminusEnd !== 'end' && ei === 0));
            const pGrp = new THREE.Group();
            pGrp.position.copy(smp.pos);
            pGrp.rotation.y = Math.atan2(-smp.tan.z, smp.tan.x);
            if (isDeadEnd) {
              addBox(pGrp, 1.8, 3.85, 17.4, m.slateCut, 0, 1.92, 0);
              addBox(pGrp, 2.1, 0.38, 17.8, acc.band, 0, 3.92, 0);
            } else {
              addBox(pGrp, 2.6, 5.2, 18.0, m.slateCut, 0, 2.5, 0);
              [-3.4, 3.4].forEach((tz) => addBox(pGrp, 2.9, 3.6, 4.8, m.slateDark, 0, 1.85, tz));
              addBox(pGrp, 2.8, 0.48, 18.2, acc.band, 0, 5.15, 0);
            }
            root.add(pGrp);
          });
        } else {
          // Elevated / super-elevated / stacked bridge box-girder viaduct + parapets + colored fascia!
          const deckProf = [[-5.6, 0.0], [-5.6, -0.52], [-3.0, -1.60], [3.0, -1.60], [5.6, -0.52], [5.6, 0.0]];
          const parL = [[-5.6, 0.0], [-5.1, 0.0], [-5.1, 0.96], [-5.6, 0.96]];
          const parR = [[5.1, 0.0], [5.6, 0.0], [5.6, 0.96], [5.1, 0.96]];
          const bandL = [[-5.68, 0.16], [-5.58, 0.16], [-5.58, 0.72], [-5.68, 0.72]];
          const bandR = [[5.58, 0.16], [5.68, 0.16], [5.68, 0.72], [5.58, 0.72]];
          [
            buildRibbonFromSpans(spans, deckProf, m.concreteLight, 1.2, true),
            buildRibbonFromSpans(spans, parL, m.concreteWeb, 1.2, true),
            buildRibbonFromSpans(spans, parR, m.concreteWeb, 1.2, true),
            buildRibbonFromSpans(spans, bandL, acc.band, 2.0, false),
            buildRibbonFromSpans(spans, bandR, acc.band, 2.0, false)
          ].forEach((mesh) => mesh && root.add(mesh));

          // Approach piers (skipping lower primary station core |x|<46 && |z|<16.5; use portal piers outside!)
          let lastPierD = -999;
          for (let i = 0; i < spanSamples.length; i++) {
            const smp = spanSamples[i];
            if (smp.pos.y < 3.4 || smp.dist - lastPierD < 40) continue;
            if (Math.abs(smp.pos.x) < 46 && Math.abs(smp.pos.z) < 16.5) continue;
            lastPierD = smp.dist;
            const capBotY = smp.pos.y - 1.60;
            const capH = 1.05;
            const shaftH = Math.max(0.5, capBotY - capH);
            const pyaw = Math.atan2(-smp.tan.z, smp.tan.x);
            const pCol = addBox(root, 1.9, shaftH, 1.9, m.pierCream, smp.pos.x, shaftH * 0.5, smp.pos.z);
            pCol.rotation.y = pyaw;
            const pCap = addBox(root, 2.3, capH, 6.2, m.concreteLight, smp.pos.x, capBotY - capH * 0.5, smp.pos.z);
            pCap.rotation.y = pyaw;
          }
        }

        // Twin tracks (ballast + four steel rails at ±3.1m) common to both underground cutaway & elevated!
        [-3.1, 3.1].forEach((tc) => {
          const bProf = [[tc - 1.32, 0.02], [tc + 1.32, 0.02], [tc + 1.08, 0.24], [tc - 1.08, 0.24]];
          const bMesh = buildRibbonFromSpans(spans, bProf, m.ballastSleeper, 0.65, false);
          if (bMesh) root.add(bMesh);
          [-0.84, 0.84].forEach((rc) => {
            const rProf = [[tc + rc - 0.07, 0.22], [tc + rc + 0.07, 0.22], [tc + rc + 0.05, 0.37], [tc + rc - 0.05, 0.37]];
            const rMesh = buildRibbonFromSpans(spans, rProf, m.railCrown, 2.0, false);
            if (rMesh) root.add(rMesh);
          });
        });
      }

      // 2. Secondary Station Box (Platform, Fascia, Canopy, Buffer Stops & Livery-Matched Parked Train)
      const armGrp = new THREE.Group();
      armGrp.position.set(armCenterL.x, deckY, armCenterL.z);
      armGrp.rotation.y = armYaw;
      root.add(armGrp);

      const stLen = arm.stationLen || 84;
      const isSide = arm.platformType === 'side';
      if (isSide) {
        // Side platforms + wider concrete slab
        addBox(armGrp, stLen, 1.0, 19.6, m.concreteLight, 0, -0.52, 0);
        [-9.95, 9.95].forEach((fz) => addBox(armGrp, stLen + 0.4, 0.85, 0.35, acc.band, 0, 0.55, fz));
        [-7.55, 7.55].forEach((pz, sIdx) => {
          const sgn = Math.sign(pz);
          addBox(armGrp, stLen - 2, 1.32, 4.1, m.terrazzoDeck, 0, 0.66, pz);
          addBox(detail, 0, 0, 0, m.concreteLight, 0, 0, 0); // ensure detail ref active
          const tStrip = addBox(armGrp, stLen - 2, 0.09, 0.38, m.tactileYellow, 0, 1.36, pz - sgn * 1.72);
          tStrip.castShadow = false;
          addBox(armGrp, stLen - 12, 1.38, 0.12, m.glassBarrier, 0, 2.05, pz - sgn * 1.88);
          addBox(armGrp, stLen - 12, 0.16, 0.16, acc.band, 0, 2.78, pz - sgn * 1.88);
          addCommuters(armGrp, [[-20, 1.32, pz - sgn * 0.7, sIdx], [0, 1.32, pz - sgn * 0.7, sIdx + 1], [20, 1.32, pz - sgn * 0.7, sIdx + 2]]);
        });
        if (isStacked) {
          // Open glazed butterfly side-wing canopies so lower cutaway tracks remain visible
          [-7.6, 7.6].forEach((cz) => {
            addBox(armGrp, stLen - 8, 0.24, 5.2, acc.glass, 0, 6.2, cz);
            addBox(armGrp, stLen - 8, 0.30, 0.48, acc.band, 0, 6.35, cz + Math.sign(cz) * 2.4);
          });
        } else {
          // Full elevated station arched glazed + line-accented roof
          addBox(armGrp, stLen - 8, 0.28, 19.2, acc.glass, 0, 7.6, 0);
          [-9.6, 9.6].forEach((cz) => addBox(armGrp, stLen - 8, 0.45, 0.55, acc.band, 0, 7.7, cz));
          for (let rx = -stLen * 0.42; rx <= stLen * 0.42 + 0.1; rx += 12) {
            addBox(armGrp, 0.42, 0.42, 19.6, m.steelDark, rx, 7.82, 0);
            [-9.2, 9.2].forEach((cz) => addBox(armGrp, 0.38, 6.2, 0.38, m.steelDark, rx, 4.5, cz));
          }
        }
      } else {
        // Island platform cleanly between ±3.1m twin tracks (width 3.6m)
        addBox(armGrp, stLen, 1.32, 3.6, m.terrazzoDeck, 0, 0.66, 0);
        [-1.58, 1.58].forEach((tz) => {
          addBox(armGrp, stLen - 2, 0.09, 0.32, m.tactileYellow, 0, 1.36, tz);
          addBox(armGrp, stLen - 12, 1.35, 0.12, m.glassBarrier, 0, 2.02, tz * 1.04);
          addBox(armGrp, stLen - 12, 0.16, 0.15, acc.band, 0, 2.75, tz * 1.04);
        });
        addCommuters(armGrp, [[-22, 1.32, -0.7, 0], [-6, 1.32, 0.7, 1], [10, 1.32, -0.7, 2], [24, 1.32, 0.7, 3]]);
        if (!isUg) {
          addBox(armGrp, stLen - 8, 0.28, 15.8, acc.glass, 0, 7.6, 0);
          [-7.9, 7.9].forEach((cz) => addBox(armGrp, stLen - 8, 0.45, 0.52, acc.band, 0, 7.7, cz));
          for (let rx = -stLen * 0.42; rx <= stLen * 0.42 + 0.1; rx += 12) {
            addBox(armGrp, 0.42, 0.42, 16.2, m.steelDark, rx, 7.82, 0);
            [-7.6, 7.6].forEach((cz) => addBox(armGrp, 0.36, 6.2, 0.36, m.steelDark, rx, 4.5, cz));
          }
        } else {
          // Underground cutaway translucent glass canopy spine over island platform
          addBox(armGrp, stLen - 12, 0.24, 7.6, m.skylightGlass, 0, 5.8, 0);
          addBox(armGrp, stLen - 12, 0.32, 0.48, acc.band, 0, 5.95, 0);
          [-32, -16, 0, 16, 32].forEach((rx) => addBox(armGrp, 0.34, 4.4, 0.34, m.steelDark, rx, 3.6, 0));
        }
      }

      if (arm.isTerminus) {
        addTerminusBufferAndCrossover(armGrp, armGrp, -(stLen * 0.48), -(stLen * 0.34), 0.28);
      }

      // Docked 4-coach Metro Train in genuine secondary line livery on track z = -3.1m
      const carTrackZ = -3.1;
      const nCoaches = 4;
      const coachStep = 16.4;
      const startCarX = -((nCoaches - 1) * coachStep) * 0.5;
      for (let ci = 0; ci < nCoaches; ci++) {
        const cx = startCarX + ci * coachStep;
        addBox(armGrp, 15.8, 3.35, 2.95, m.steelChrome, cx, 2.08, carTrackZ);
        addBox(armGrp, 16.0, 0.40, 2.68, m.concreteLight, cx, 3.88, carTrackZ);
        addBox(armGrp, 15.85, 0.48, 3.02, acc.band, cx, 1.98, carTrackZ);
        [-4.2, 0, 4.2].forEach((wx) => {
          [-1.50, 1.50].forEach((wz) => addBox(armGrp, 2.5, 1.02, 0.05, m.concourseGlass, cx + wx, 2.48, carTrackZ + wz));
        });
        if (ci === 0 || ci === nCoaches - 1) {
          const capX = ci === 0 ? cx - 7.95 : cx + 7.95;
          addBox(armGrp, 0.55, 2.6, 2.76, acc.band, capX, 2.08, carTrackZ);
          addBox(armGrp, 0.62, 0.85, 2.32, m.concourseGlass, capX, 2.75, carTrackZ);
        }
      }
    });

    // 3. Inter-Station Transfer Links (Skywalks, Diagonal Escalator Tubes, Subsurface Galleries, Lift Towers)
    (hubSpec.links || []).forEach((lnk) => {
      const acc = getHubAccentMats(lnk.color);
      if (lnk.kind === 'lift_tower') {
        const pos = llToLocal(lnk.posLngLat, 0);
        const hTot = Math.max(4.0, (lnk.toY || 19.5) - (lnk.fromY || 0));
        const yMid = (lnk.fromY || 0) + hTot * 0.5;
        addBox(root, 5.2, hTot, 5.2, m.glassBarrier, pos.x, yMid, pos.z);
        addBox(root, 5.8, 0.52, 5.8, acc.trim, pos.x, (lnk.fromY || 0) + hTot + 0.22, pos.z);
        [[-2.5, -2.5], [2.5, -2.5], [-2.5, 2.5], [2.5, 2.5]].forEach(([mx, mz]) => {
          addBox(root, 0.30, hTot + 0.2, 0.30, m.steelDark, pos.x + mx, yMid, pos.z + mz);
        });
        return;
      }

      let pA = llToLocal(lnk.fromLngLat, lnk.fromY !== undefined ? lnk.fromY : (lnk.y || 4.2));
      const pB = llToLocal(lnk.toLngLat, lnk.toY !== undefined ? lnk.toY : (lnk.y || 4.2));
      if (Math.hypot(pA.x, pA.z) < 6.0) pA.set(0, pA.y, 0);

      const dx = pB.x - pA.x;
      const dy = pB.y - pA.y;
      const dz = pB.z - pA.z;
      const horizLen = Math.hypot(dx, dz);
      if (horizLen < 1.5) return;

      const spanLen = Math.hypot(horizLen, dy);
      const mid = new THREE.Vector3((pA.x + pB.x) * 0.5, (pA.y + pB.y) * 0.5, (pA.z + pB.z) * 0.5);
      const yaw = Math.atan2(-dz, dx);
      const pitchZ = Math.atan2(dy, horizLen);
      const w = lnk.width || 6.4;

      const lnkGrp = new THREE.Group();
      lnkGrp.position.copy(mid);
      lnkGrp.rotation.order = 'YXZ';
      lnkGrp.rotation.y = yaw;
      lnkGrp.rotation.z = pitchZ;
      root.add(lnkGrp);

      if (lnk.kind === 'skywalk' || lnk.kind === 'escalator_bridge') {
        const tubeLen = Math.max(8, spanLen - 6);
        addBox(lnkGrp, tubeLen, 0.55, w, m.concreteLight, 0, -1.75, 0);
        addBox(lnkGrp, tubeLen, 0.38, w + 0.3, acc.band, 0, -1.28, 0);
        addBox(lnkGrp, tubeLen, 3.2, w - 0.5, lnk.kind === 'escalator_bridge' ? m.escGlass : m.concourseGlass, 0, 0.15, 0);
        addBox(lnkGrp, tubeLen, 0.42, w + 0.4, m.steelDark, 0, 1.85, 0);
        addBox(lnkGrp, tubeLen, 0.25, w + 0.45, acc.trim, 0, 2.15, 0);
        if (lnk.kind === 'escalator_bridge') {
          [-1.3, 1.3].forEach((ez) => addBox(lnkGrp, tubeLen - 2, 0.72, 1.45, m.escStep, 0, -0.65, ez));
        }
        for (let rx = -tubeLen * 0.45; rx <= tubeLen * 0.45 + 0.1; rx += 10) {
          [-w * 0.46, w * 0.46].forEach((cz) => addBox(lnkGrp, 0.30, 3.6, 0.30, m.steelDark, rx, 0.15, cz));
        }
        // Vertical ground support piers along elevated skywalks (every 42m, outside both station footprints)
        const nPiers = Math.max(1, Math.floor(horizLen / 42));
        for (let pi = 1; pi <= nPiers; pi++) {
          const t = pi / (nPiers + 1);
          const wx = pA.x + dx * t;
          const wz = pA.z + dz * t;
          const wy = pA.y + dy * t;
          if (wy < 6.0 || (Math.abs(wx) < 42 && Math.abs(wz) < 16)) continue;
          const pH = wy - 1.9;
          const col = addBox(root, 1.5, pH, 1.5, m.pierCream, wx, pH * 0.5, wz);
          col.rotation.y = yaw;
          const cap = addBox(root, 2.0, 0.9, w + 0.6, m.concreteLight, wx, pH + 0.15, wz);
          cap.rotation.y = yaw;
        }
      } else {
        // Subsurface glazed skylight plaza transfer gallery
        const galLen = Math.max(10, horizLen - 8);
        addBox(lnkGrp, galLen, 0.22, w + 2.4, m.plazaPave, 0, -pA.y + 0.32, 0);
        addBox(lnkGrp, galLen, 2.6, w, m.skylightGlass, 0, 0.0, 0);
        addBox(lnkGrp, galLen, 0.36, w + 0.6, acc.band, 0, 1.4, 0);
        for (let rx = -galLen * 0.45; rx <= galLen * 0.45 + 0.1; rx += 10) {
          [-w * 0.48, w * 0.48].forEach((cz) => addBox(lnkGrp, 0.28, 3.0, 0.28, m.steelDark, rx, 0.0, cz));
        }
      }
    });
  }

  function buildAllStations(parent, corridor = null) {
    const g = getSharedStationGeos();
    const m = getMaterials();
    const c = corridor || yellowCorridor;
    const stList = c ? c.stationsData : stationsData;
    const isBlue = Boolean(c && (c.isBlue || c.lineId === 'blue' || c.lineKey === 'blue'));

    stList.forEach((st) => {
      st.corridor = c;
      if (!st.lineId) st.lineId = isBlue ? 'blue' : 'yellow';
      const secColor = pickInterchangeHex(st);
      const secCss = secColor ? ('#' + secColor.toString(16).padStart(6, '0')) : null;
      const isUgSide = st.structure !== 'elevated' && UNDERGROUND_SIDE_STATIONS.has(st.name);
      const isElIsland = st.structure === 'elevated' && st.name === 'Haiderpur Badli Mor';
      let subtitle;
      if (isBlue) {
        if (st.name === 'Rajiv Chowk') subtitle = 'BLUE × YELLOW CP INTERCHANGE · UPPER BRIDGE +7.6M';
        else if (st.name === 'Akshardham') subtitle = 'YAMUNA BANK BYPASS · +16M ELEVATED';
        else if (st.name === 'Yamuna Bank') subtitle = 'BLUE LINE FORK · NOIDA × VAISHALI JUNCTION';
        else if (st.name === 'Dwarka Sector 21') subtitle = 'BLUE LINE × AIRPORT EXPRESS TERMINUS';
        else if (st.name === 'Noida Electronic City') subtitle = 'EASTERN TERMINUS · UTTAR PRADESH';
        else if (st.name === 'Botanical Garden') subtitle = 'BLUE × MAGENTA INTERCHANGE';
        else if (st.name === 'Mandi House') subtitle = 'BLUE × VIOLET CULTURAL HUB';
        else if (st.name === 'Kirti Nagar') subtitle = 'BLUE × GREEN INTERCHANGE';
        else if (st.name === 'Janakpuri West') subtitle = 'BLUE × MAGENTA INTERCHANGE';
        else if (st.name === 'Mayur Vihar-I') subtitle = 'BLUE × PINK INTERCHANGE';
        else if (st.name === 'Anand Vihar') subtitle = 'BLUE × PINK × RAILWAY INTERCHANGE';
        else if (st.terminus) subtitle = `${st.name.includes('Dwarka') ? 'WESTERN' : 'EASTERN'} TERMINUS · ${st.structure.toUpperCase()}`;
        else if (st.interchange) subtitle = `${st.structure.toUpperCase()} · ${st.interchange.toUpperCase()}`;
        else subtitle = `BLUE LINE · ${st.structure === 'elevated' ? '+15M ELEVATED' : `${st.elevM || -18}M UNDERGROUND`}`;
      } else {
        if (st.name === 'Kashmere Gate') subtitle = 'YELLOW · RED · VIOLET MEGA HUB';
        else if (st.name === 'Chawri Bazar') subtitle = 'DEEPEST TUBE · -30M COFFERDAM';
        else if (st.name === 'Hauz Khas') subtitle = 'DEEP TUBE · -28M YELLOW × MAGENTA';
        else if (st.name === 'New Delhi') subtitle = 'YELLOW × AIRPORT EXPRESS × NDLS RAIL';
        else if (st.name === 'Haiderpur Badli Mor') subtitle = 'ELEVATED ISLAND · YELLOW × MAGENTA';
        else if (st.name === 'Central Secretariat') subtitle = 'SIDE PLATFORMS · YELLOW × VIOLET';
        else if (st.terminus) subtitle = `${st.name === 'Samaypur Badli' ? 'NORTHERN' : 'SOUTHERN'} TERMINUS · SIDE PLATFORMS`;
        else if (st.interchange) subtitle = `${isElIsland ? 'ISLAND' : (isUgSide ? 'SIDE PLATFORMS' : st.structure.toUpperCase())} · ${st.interchange.toUpperCase()}`;
        else subtitle = `YELLOW LINE · ${st.structure === 'elevated' ? '+15M ELEVATED SIDE' : `${st.elevM || -16}M UNDERGROUND ${isUgSide ? 'SIDE' : 'ISLAND'}`}`;
      }

      if (st.name === 'Yamuna Bank' && (c && (c.lineId === 'blue-vaishali' || c.lineKey === 'blue-vaishali'))) {
        return; // Skip duplicate Yamuna Bank model; it is already anchored by the mainline corridor!
      }

      const blueRajivSt = (blueCorridor && blueCorridor.stationsData)
        ? blueCorridor.stationsData.find((s) => s.name === 'Rajiv Chowk')
        : null;
      if (st.name === 'Rajiv Chowk' && isBlue && yellowCorridor) {
        return; // Skip duplicate Rajiv Chowk model; unified cruciform hub is built with Yellow + Blue!
      }
      const isSharedRajiv = st.name === 'Rajiv Chowk' && !isBlue && Boolean(blueRajivSt);
      if (isSharedRajiv) {
        st._isSharedDualHub = true;
        subtitle = 'YELLOW × BLUE CP INTERCHANGE · CRUCIFORM HUB';
      }

      const hubSpec = interchangeHubsData && interchangeHubsData.hubs && interchangeHubsData.hubs[st.name];
      if (hubSpec && st.name === 'Dwarka') {
        subtitle = 'BLUE × GREY INTERCHANGE · NAJAFGARH BRANCH';
      }

      const built = (st.name === 'Yamuna Bank')
        ? buildYamunaBankJunctionStation(st, secColor)
        : (isSharedRajiv
            ? buildRajivChowkCruciformHub(st, blueRajivSt, secColor)
            : (st.structure === 'elevated'
                ? buildElevatedStation(st, secColor)
                : buildUndergroundCutawayStation(st, secColor)));

      if (hubSpec && !isSharedRajiv && st.name !== 'Yamuna Bank') {
        attachGenuineInterchangeGeometry(built, st, hubSpec, m, g);
      }

      const yaw = Math.atan2(-st.tan.z, st.tan.x);
      built.root.position.set(st.pos.x, 0, st.pos.z);
      built.root.rotation.y = yaw;
      built.root.visible = false; // spatially culled around active camera on first frame
      built.root.userData = { station: st, detail: built.detail };

      const shadowMeshes = [];
      built.root.traverse((obj) => {
        if (obj.isMesh) {
          const mat = obj.material;
          const isTrans = mat && (mat.transparent || mat === m.shadowDisc || mat === m.viaductShadow);
          if (!isTrans) {
            obj.castShadow = true;
            shadowMeshes.push(obj);
          }
          obj.receiveShadow = true;
        }
      });

      if (st.major || secColor || st.terminus) {
        const ringMat = new THREE.MeshBasicMaterial({
          color: secColor || (isBlue ? 0x2563EB : 0xEAB308),
          transparent: true,
          opacity: 0.26,
          side: THREE.DoubleSide
        });
        const ring = new THREE.Mesh(g.haloRing, ringMat);
        ring.rotation.x = -Math.PI / 2;
        ring.position.y = st.structure === 'elevated' ? VIADUCT_Y + 0.18 : 0.45;
        ring.frustumCulled = false;
        ring.visible = false; // keep clean streetscape unless station is selected!
        built.root.add(ring);
        st._ring = ring;
      }

      parent.add(built.root);
      st._group = built.root;
      st._detail = built.detail;
      st._signMeshes = built.signMeshes;
      st._pidsMesh = built.pidsMesh;
      st._signSpec = { subtitle, secCss };
      st._signageReady = false;
      st._shadowMeshes = shadowMeshes;
      st._inShadow = true;
    });
  }

  /* ───────────────────────────────────────────────────────────
   * 4. Articulated MetroKit Yellow Line Fleet
   * ─────────────────────────────────────────────────────────── */
  function buildFleet(parent, corridor = null) {
    if (!window.MetroKit || !window.MetroKit.TrainFactory) return;
    const TF = window.MetroKit.TrainFactory;
    const g = getSharedStationGeos();
    const c = corridor || yellowCorridor;
    const cLen = c ? c.totalLen : totalLen;
    const cStations = c ? c.stationsData : stationsData;
    const cProxy = c ? c.fastCurveProxy : fastCurveProxy;
    const isVaishali = Boolean(c && (c.lineId === 'blue-vaishali' || c.lineKey === 'blue-vaishali'));
    const isBlue = Boolean(c && (c.isBlue || c.lineId === 'blue' || c.lineKey === 'blue' || isVaishali));
    const lineColor = isBlue ? 0x2563EB : 0xEAB308;
    const idPrefix = isVaishali ? 'BV' : (isBlue ? 'BL' : 'YL');
    const trainsCount = isVaishali ? 3 : FLEET_TRAINS_PER_DIR;

    const heroNames = isVaishali
      ? ['Anand Vihar ISBT', 'Karkarduma', 'Preet Vihar', 'Vaishali']
      : (isBlue
        ? ['Dwarka Sector 21', 'Rajiv Chowk', 'Akshardham', 'Botanical Garden', 'Noida City Centre']
        : ['Qutab Minar', 'Green Park', 'Lok Kalyan Marg', 'Rajiv Chowk', 'Kashmere Gate']);
    const heroDists = heroNames
      .map((n) => cStations.find((s) => s.name === n))
      .filter(Boolean)
      .map((s) => s.dist);

    for (let i = 0; i < trainsCount; i++) {
      [1, -1].forEach((dir) => {
        const trainGroup = TF.createArticulatedTrain({
          lineColor,
          carScale: TRAIN_CAR_SCALE,
          directionSign: dir > 0 ? 1 : -1,
          withPointLight: false
        });
        const shadowMeshes = [];
        trainGroup.traverse((obj) => {
          obj.frustumCulled = false;
          if (obj.isMesh) {
            const canShadow = !obj.userData || !obj.userData.noShadow;
            obj.castShadow = canShadow;
            obj.receiveShadow = true;
            if (canShadow) shadowMeshes.push(obj);
          }
        });

        // Ground-hugging additive headlight beam cone on lead cab nose (wakes up at dusk/night)
        let beamMesh = null;
        if (trainBeamMat && g.beamQuad && trainGroup.userData.cars && trainGroup.userData.cars.length) {
          const leadCar = dir > 0
            ? trainGroup.userData.cars[trainGroup.userData.cars.length - 1]
            : trainGroup.userData.cars[0];
          beamMesh = new THREE.Mesh(g.beamQuad, trainBeamMat);
          beamMesh.position.set(dir > 0 ? 17.2 : -17.2, -0.14, 0);
          if (dir > 0) beamMesh.rotation.y = Math.PI;
          beamMesh.castShadow = false;
          beamMesh.receiveShadow = false;
          beamMesh.frustumCulled = false;
          beamMesh.renderOrder = 2;
          leadCar.add(beamMesh);
        }

        trainGroup.visible = false;
        parent.add(trainGroup);

        let dist;
        if (i < heroDists.length) {
          dist = Math.max(90, Math.min(cLen - 90, heroDists[i] + (dir > 0 ? -92 : 108)));
        } else {
          const stagger = dir > 0 ? i / trainsCount : (i + 0.48) / trainsCount;
          dist = (0.04 + stagger * 0.92) * cLen;
        }

        const trObj = {
          id: `${idPrefix}_${dir > 0 ? 'DN' : 'UP'}_${i + 1}`,
          corridor: c,
          dir,
          initDir: dir,
          dist,
          laneOffset: dir > 0 ? TRACK_HALF_SEP : -TRACK_HALF_SEP,
          speedMps: 68, // Crisp dignified architectural transit pace
          dwellTimer: 0,
          lastStationIdx: -1,
          group: trainGroup,
          beamMesh,
          shadowMeshes,
          _inShadow: true
        };
        TF.updateTrainOnCurve(trainGroup, cProxy, dist, cLen, trObj.laneOffset, 0.50);
        fleetTrains.push(trObj);
      });
    }
  }

  function updateFleet(dtSec, focusX, focusZ, visR2, shadowR2) {
    if (!window.MetroKit || !window.MetroKit.TrainFactory) return;
    const TF = window.MetroKit.TrainFactory;

    for (let t = 0; t < fleetTrains.length; t++) {
      const tr = fleetTrains[t];
      const c = tr.corridor || yellowCorridor;
      if (!c || !c.fastCurveProxy) continue;
      const cLen = c.totalLen;
      const cStations = c.stationsData;
      const cProxy = c.fastCurveProxy;
      const cSamples = c.samples;
      const minD = 90;
      const maxD = cLen - 90;
      const nLast = Math.max(1, cSamples.length - 1);

      if (activeLineId !== 'all') {
        const isB = Boolean(c && (c.isBlue || c.lineId === 'blue' || c.lineKey === 'blue'));
        if (activeLineId === 'blue' && !isB) {
          if (tr.group.visible) tr.group.visible = false;
          continue;
        }
        if (activeLineId === 'yellow' && isB) {
          if (tr.group.visible) tr.group.visible = false;
          continue;
        }
      }

      if (tr.dwellTimer > 0) {
        tr.dwellTimer -= dtSec;
      } else {
        tr.dist += tr.dir * tr.speedMps * dtSec;
        if (tr.dist >= maxD) {
          tr.dist = maxD;
          tr.dir = -1;
          tr.laneOffset = -TRACK_HALF_SEP;
          tr.dwellTimer = 1.6;
          tr.lastStationIdx = -1;
          if (tr.beamMesh && tr.group.userData && tr.group.userData.cars && tr.group.userData.cars.length) {
            tr.group.userData.cars[0].add(tr.beamMesh);
            tr.beamMesh.position.set(-17.2, -0.14, 0);
            tr.beamMesh.rotation.y = 0;
          }
        } else if (tr.dist <= minD) {
          tr.dist = minD;
          tr.dir = 1;
          tr.laneOffset = TRACK_HALF_SEP;
          tr.dwellTimer = 1.6;
          tr.lastStationIdx = -1;
          if (tr.beamMesh && tr.group.userData && tr.group.userData.cars && tr.group.userData.cars.length) {
            const cars = tr.group.userData.cars;
            cars[cars.length - 1].add(tr.beamMesh);
            tr.beamMesh.position.set(17.2, -0.14, 0);
            tr.beamMesh.rotation.y = Math.PI;
          }
        }

        for (let s = 0; s < cStations.length; s++) {
          if (s === tr.lastStationIdx) continue;
          if (Math.abs(tr.dist - cStations[s].dist) < 55) {
            tr.lastStationIdx = s;
            tr.dwellTimer = 1.4;
            break;
          }
        }
      }

      const sIdx = Math.max(0, Math.min(nLast, Math.round((tr.dist / cLen) * nLast)));
      const smp = cSamples[sIdx];
      const sp = smp.pos;
      const dx = sp.x - focusX;
      const dz = sp.z - focusZ;
      const d2 = dx * dx + dz * dz;
      const onVisibleTrack = undergroundXRay || subwayRailsVisible || isOpenCutOrSurfaceDist(tr.dist, smp.elev, 42.0, c);
      const inVis = d2 <= visR2 && onVisibleTrack;

      if (tr.group.visible !== inVis) {
        tr.group.visible = inVis;
      }
      if (inVis) {
        const inShadow = d2 <= shadowR2;
        if (inShadow !== tr._inShadow) {
          tr._inShadow = inShadow;
          for (let mIdx = 0; mIdx < tr.shadowMeshes.length; mIdx++) {
            tr.shadowMeshes[mIdx].castShadow = inShadow;
          }
        }
        // Kiss the exact rail head (0.50m above deck datum) cleanly
        TF.updateTrainOnCurve(tr.group, cProxy, tr.dist, cLen, tr.laneOffset, 0.50);
      }
    }
  }

  /* ───────────────────────────────────────────────────────────
   * 5. MapLibre v5 + OpenFreeMap Liberty Visual Harmony & Clearance
   * ─────────────────────────────────────────────────────────── */
  function orientedBoxRing(cx, cz, tx, tz, halfLenM, halfWidthM) {
    const len = Math.hypot(tx, tz) || 1;
    const fx = tx / len;
    const fz = tz / len;
    const rx = -fz;
    const rz = fx;
    const pts = [
      localMetersToLngLat({ x: cx - fx * halfLenM - rx * halfWidthM, z: cz - fz * halfLenM - rz * halfWidthM }),
      localMetersToLngLat({ x: cx + fx * halfLenM - rx * halfWidthM, z: cz + fz * halfLenM - rz * halfWidthM }),
      localMetersToLngLat({ x: cx + fx * halfLenM + rx * halfWidthM, z: cz + fz * halfLenM + rz * halfWidthM }),
      localMetersToLngLat({ x: cx - fx * halfLenM + rx * halfWidthM, z: cz - fz * halfLenM + rz * halfWidthM })
    ];
    let signedArea = 0;
    for (let i = 0; i < 4; i++) {
      const [x1, y1] = pts[i];
      const [x2, y2] = pts[(i + 1) % 4];
      signedArea += (x1 * y2 - x2 * y1);
    }
    if (signedArea < 0) pts.reverse();
    pts.push(pts[0]);
    return pts;
  }

  function dpSimplifyLngLat(pts, epsMeters) {
    if (!pts || pts.length <= 2) return pts ? pts.slice() : [];
    const kx = 97700;
    const ky = 111000;
    function ptSegDistM(p, a, b) {
      const px = (p[0] - a[0]) * kx;
      const py = (p[1] - a[1]) * ky;
      const bx = (b[0] - a[0]) * kx;
      const by = (b[1] - a[1]) * ky;
      const l2 = bx * bx + by * by;
      const t = l2 > 0 ? Math.max(0, Math.min(1, (px * bx + py * by) / l2)) : 0;
      return Math.hypot(px - t * bx, py - t * by);
    }
    const keep = new Uint8Array(pts.length);
    keep[0] = 1;
    keep[pts.length - 1] = 1;
    const stack = [[0, pts.length - 1]];
    while (stack.length) {
      const [s, e] = stack.pop();
      let maxD = 0;
      let idx = -1;
      for (let i = s + 1; i < e; i++) {
        const d = ptSegDistM(pts[i], pts[s], pts[e]);
        if (d > maxD) {
          maxD = d;
          idx = i;
        }
      }
      if (maxD > epsMeters && idx > s && idx < e) {
        keep[idx] = 1;
        stack.push([s, idx], [idx, e]);
      }
    }
    const out = [];
    for (let i = 0; i < pts.length; i++) {
      if (keep[i]) out.push(pts[i]);
    }
    return out;
  }

  function buildCorridorDistanceFilter(clearance, minDistM) {
    if (!clearance || !clearance.corridorDistanceGeo) return true;
    const exactCheck = ['>', ['distance', clearance.corridorDistanceGeo], minDistM];
    return !clearance.corridorGuardGeo
      ? exactCheck
      : ['any', ['>', ['distance', clearance.corridorGuardGeo], 260.0], exactCheck];
  }

  function buildCorridorClearanceGeoJSON() {
    const corridors = (allCorridors && allCorridors.length)
      ? allCorridors
      : [yellowCorridor, blueCorridor].filter(Boolean);
    const buildingFeatures = [];
    const guardFeatures = [];
    const metroFeatures = [];
    const allStationRings = [];

    corridors.forEach((c) => {
      if (!c || !c.samples || !c.samples.length || c.totalLen <= 0) return;
      const cTrackCoords = [];
      const stepM = 180;
      for (let d = 0; d <= c.totalLen; d += stepM) {
        const smp = sampleAtDist(Math.min(c.totalLen, d), c);
        if (smp) cTrackCoords.push(localMetersToLngLat(smp.pos));
      }
      const lastSmp = c.samples[c.samples.length - 1];
      if (lastSmp) cTrackCoords.push(localMetersToLngLat(lastSmp.pos));

      if (cTrackCoords.length >= 2) {
        buildingFeatures.push({ type: 'Feature', geometry: { type: 'LineString', coordinates: cTrackCoords } });
        metroFeatures.push({ type: 'Feature', geometry: { type: 'LineString', coordinates: cTrackCoords } });
        const dpTrack = dpSimplifyLngLat(cTrackCoords, 140.0);
        if (dpTrack.length >= 2) {
          guardFeatures.push({ type: 'Feature', geometry: { type: 'LineString', coordinates: dpTrack } });
        }
      }

      const stList = Array.isArray(c.stationsData) ? c.stationsData : [];
      stList.forEach((st) => {
        if (st.name === 'Rajiv Chowk') {
          allStationRings.push([orientedBoxRing(st.pos.x, st.pos.z, st.tan.x, st.tan.z, 76, 76)]);
        } else {
          allStationRings.push([orientedBoxRing(st.pos.x, st.pos.z, st.tan.x, st.tan.z, 62, 12)]);
        }
      });
    });

    if (interchangeHubsData && interchangeHubsData.hubs) {
      Object.values(interchangeHubsData.hubs).forEach((hubSpec) => {
        (hubSpec.arms || []).forEach((arm) => {
          if (arm.trackPolyline && arm.trackPolyline.length >= 2) {
            metroFeatures.push({ type: 'Feature', geometry: { type: 'LineString', coordinates: arm.trackPolyline } });
          }
        });
        (hubSpec.clearanceBoxes || []).forEach((box) => {
          const wp = toLocalMeters(box.center, 0);
          allStationRings.push([
            orientedBoxRing(
              wp.x,
              wp.z,
              box.tangent[0],
              -box.tangent[1],
              (box.length || 110) * 0.58,
              (box.width || 28) * 0.72
            )
          ]);
        });
        (hubSpec.links || []).forEach((lnk) => {
          if (lnk.kind === 'skywalk' || lnk.kind === 'escalator_bridge' || lnk.kind === 'subsurface_passage') {
            const pA = toLocalMeters(lnk.fromLngLat, 0);
            const pB = toLocalMeters(lnk.toLngLat, 0);
            const dx = pB.x - pA.x;
            const dz = pB.z - pA.z;
            const L = Math.hypot(dx, dz);
            if (L > 4) {
              allStationRings.push([
                orientedBoxRing(
                  (pA.x + pB.x) * 0.5,
                  (pA.z + pB.z) * 0.5,
                  dx / L,
                  dz / L,
                  L * 0.5 + 10,
                  (lnk.width || 6.4) * 0.65 + 4
                )
              ]);
            }
          }
        });
      });
    }

    if (allStationRings.length) {
      metroFeatures.push({ type: 'Feature', geometry: { type: 'MultiPolygon', coordinates: allStationRings } });
    }

    // Protect Qutab Minar, India Gate, Netaji Canopy, Humayun's Tomb, Red Fort, Lotus Temple & Akshardham from duplicate extrusions
    const monumentGuardDefs = [
      { coords: [77.1855, 28.5245], tx: 0, tz: 1, hl: 14, hw: 14 },
      { coords: [77.2295, 28.6129], tx: 0, tz: 1, hl: 34, hw: 34 },
      { coords: [77.23125, 28.6126], tx: 0, tz: 1, hl: 14, hw: 14 },
      { coords: [77.2507, 28.5933], tx: 1, tz: 0, hl: 26, hw: 26 },
      { coords: [77.2410, 28.6559], tx: 0, tz: 1, hl: 30, hw: 12 },
      { coords: [77.2588, 28.5535], tx: 0, tz: 1, hl: 24, hw: 24 },
      { coords: [77.2773, 28.6127], tx: 0, tz: 1, hl: 26, hw: 26 },
      { coords: [77.2206, 28.6423], tx: -0.18, tz: 0.98, hl: 192, hw: 46 }
    ];
    const monumentRings = monumentGuardDefs.map((m) => {
      const mPos = toLocalMeters(m.coords, 0);
      return [orientedBoxRing(mPos.x, mPos.z, m.tx, m.tz, m.hl, m.hw)];
    });

    buildingFeatures.push({
      type: 'Feature',
      geometry: { type: 'MultiPolygon', coordinates: allStationRings.concat(monumentRings) }
    });

    guardFeatures.push({
      type: 'Feature',
      geometry: { type: 'MultiPoint', coordinates: monumentGuardDefs.map((m) => m.coords) }
    });

    const corridorGuardGeo = guardFeatures.length
      ? { type: 'FeatureCollection', features: guardFeatures }
      : null;

    const allStations = allStationsData.length ? allStationsData : stationsData;
    const stationOnlyPointsGeo = {
      type: 'FeatureCollection',
      features: allStations.map((s) => ({
        type: 'Feature',
        geometry: { type: 'Point', coordinates: s.coords }
      }))
    };

    const monumentPointsGeo = {
      type: 'FeatureCollection',
      features: DELHI_MONUMENTS.map((mon) => ({
        type: 'Feature',
        geometry: { type: 'Point', coordinates: mon.coords }
      }))
    };

    return {
      corridorDistanceGeo: { type: 'FeatureCollection', features: buildingFeatures },
      corridorGuardGeo,
      metroCorridorOnlyGeo: { type: 'FeatureCollection', features: metroFeatures },
      stationOnlyPointsGeo,
      monumentPointsGeo
    };
  }

  function configureMapLibreVisualHarmony() {
    if (!map || !map.getStyle()) return;
    const layers = map.getStyle().layers || [];

    // 1. Hide clunky 2D fallback track polygons, Protomaps clay blocks, noisy shop POIs & non-rail transit clutter
    const hidePrefixes = [
      'flyover-', 'tunnel-', 'platform-', 'portal-',
      'underground-', 'crossover-', 'train-', '3d-clay-buildings',
      'road_one_way_arrow', 'highway-shield-', 'road_shield_'
    ];
    layers.forEach((l) => {
      if (l.id === 'poi_r20' || hidePrefixes.some((p) => l.id.startsWith(p))) {
        try { map.setLayoutProperty(l.id, 'visibility', 'none'); } catch (_) { }
      }
    });

    // 2. Build spatial MultiPolygon clearance zones so real OSM buildings never clip tracks/stations
    const hasSceneGeo = stationsData.length > 0 && samples.length > 0 && !!originMc;
    const clearance = hasSceneGeo ? buildCorridorClearanceGeoJSON() : null;

    // 3. Transform OpenFreeMap Liberty into a warm architectural sunlit city canvas
    try {
      if (map.getLayer('background')) map.setPaintProperty('background', 'background-color', '#F2EDE2');
      if (map.getLayer('natural_earth')) map.setPaintProperty('natural_earth', 'raster-opacity', 0.24);
      if (map.getLayer('park')) {
        map.setPaintProperty('park', 'fill-color', '#B3DA9A');
        map.setPaintProperty('park', 'fill-opacity', 0.86);
        map.setPaintProperty('park', 'fill-outline-color', '#86C16C');
      }
      if (map.getLayer('park_outline')) {
        map.setPaintProperty('park_outline', 'line-color', '#78B75D');
        map.setPaintProperty('park_outline', 'line-opacity', 0.55);
      }
      if (map.getLayer('landcover_wood')) {
        map.setPaintProperty('landcover_wood', 'fill-color', '#9BC980');
        map.setPaintProperty('landcover_wood', 'fill-opacity', 0.72);
      }
      if (map.getLayer('landcover_grass')) {
        map.setPaintProperty('landcover_grass', 'fill-color', '#C5E1AF');
        map.setPaintProperty('landcover_grass', 'fill-opacity', 0.68);
      }
      if (map.getLayer('landuse_pitch')) {
        map.setPaintProperty('landuse_pitch', 'fill-color', '#B6DA9E');
      }
      if (map.getLayer('landuse_track')) {
        map.setPaintProperty('landuse_track', 'fill-color', '#DED0B7');
      }
      if (map.getLayer('landuse_school')) {
        map.setPaintProperty('landuse_school', 'fill-color', '#ECE5D5');
      }
      if (map.getLayer('landuse_hospital')) {
        map.setPaintProperty('landuse_hospital', 'fill-color', '#F2E2DF');
      }
      if (map.getLayer('landuse_cemetery')) {
        map.setPaintProperty('landuse_cemetery', 'fill-color', '#CEE0C3');
      }
      if (map.getLayer('landuse_residential')) {
        map.setPaintProperty('landuse_residential', 'fill-color', '#EAE3D5');
        map.setPaintProperty('landuse_residential', 'fill-opacity', 0.58);
      }
      if (map.getLayer('water')) {
        map.setPaintProperty('water', 'fill-color', '#76C0EA');
        map.setPaintProperty('water', 'fill-opacity', 0.90);
      }
      if (!map.hasImage('delhi-water-caustic')) {
        try { map.addImage('delhi-water-caustic', makeWaterCausticImageData()); } catch (_) { }
      }
      if (map.getLayer('water')) {
        const baseWater = map.getLayer('water');
        const wSource = baseWater.source || 'openmaptiles';
        const wSourceLayer = baseWater.sourceLayer || baseWater['source-layer'] || 'water';
        const wIdx = layers.findIndex((l) => l.id === 'water');
        const nextAfterWater = wIdx >= 0 && wIdx + 1 < layers.length ? layers[wIdx + 1].id : undefined;

        if (!map.getLayer('water-bank-line')) {
          try {
            const bankDef = {
              id: 'water-bank-line',
              type: 'line',
              source: wSource,
              'source-layer': wSourceLayer,
              minzoom: 12.2,
              paint: {
                'line-color': '#B6D9EE',
                'line-width': ['interpolate', ['linear'], ['zoom'], 12.5, 0.8, 17, 2.6],
                'line-opacity': 0.72
              }
            };
            if (baseWater.filter) bankDef.filter = baseWater.filter;
            map.addLayer(bankDef, nextAfterWater);
          } catch (_) { }
        }
        if (!map.getLayer('water-shimmer-overlay')) {
          try {
            const shimDef = {
              id: 'water-shimmer-overlay',
              type: 'fill',
              source: wSource,
              'source-layer': wSourceLayer,
              minzoom: 12.5,
              paint: {
                'fill-pattern': 'delhi-water-caustic',
                'fill-opacity': ['interpolate', ['linear'], ['zoom'], 12.5, 0.0, 14.5, 0.14, 17.5, 0.24]
              }
            };
            if (baseWater.filter) shimDef.filter = baseWater.filter;
            map.addLayer(shimDef, 'water-bank-line');
          } catch (_) { }
        }
      }
      ['waterway_river', 'waterway_other', 'waterway_tunnel'].forEach((id) => {
        if (map.getLayer(id)) map.setPaintProperty(id, 'line-color', '#64B2DF');
      });

      // OpenFreeMap Liberty Road Hierarchy: sunlit boulevards + warm sandstone casings (cached by category for fast 24h theming)
      classifiedRoadLayers = {
        motorway: [],
        motorway_casing: [],
        trunk_primary: [],
        trunk_casing: [],
        secondary: [],
        secondary_casing: [],
        minor: [],
        minor_casing: [],
        path: [],
        path_casing: []
      };
      layers.forEach((l) => {
        if (l.type !== 'line' || l.source !== 'openmaptiles') return;
        const id = l.id;
        if (id.includes('motorway_link') && !id.includes('casing')) {
          classifiedRoadLayers.motorway.push(id);
          map.setPaintProperty(id, 'line-color', '#F6DE97');
        } else if (id.includes('motorway') && !id.includes('casing')) {
          classifiedRoadLayers.motorway.push(id);
          map.setPaintProperty(id, 'line-color', '#F4DA8E');
        } else if (id.includes('motorway') && id.includes('casing')) {
          classifiedRoadLayers.motorway_casing.push(id);
          map.setPaintProperty(id, 'line-color', '#CBB68A');
        } else if (id.includes('trunk_primary') && !id.includes('casing')) {
          classifiedRoadLayers.trunk_primary.push(id);
          map.setPaintProperty(id, 'line-color', '#F7E4A6');
        } else if (id.includes('trunk_primary') && id.includes('casing')) {
          classifiedRoadLayers.trunk_casing.push(id);
          map.setPaintProperty(id, 'line-color', '#C9B99B');
        } else if (id.includes('secondary_tertiary') && !id.includes('casing')) {
          classifiedRoadLayers.secondary.push(id);
          map.setPaintProperty(id, 'line-color', '#FFFDF7');
        } else if (id.includes('secondary_tertiary') && id.includes('casing')) {
          classifiedRoadLayers.secondary_casing.push(id);
          map.setPaintProperty(id, 'line-color', '#CEC4B2');
        } else if (id.includes('minor') || id.includes('street') || id.includes('link') || id.includes('service_track')) {
          if (id.includes('casing')) {
            classifiedRoadLayers.minor_casing.push(id);
            map.setPaintProperty(id, 'line-color', '#D7D0C1');
          } else {
            classifiedRoadLayers.minor.push(id);
            map.setPaintProperty(id, 'line-color', '#FFFFFF');
          }
        } else if (id.includes('path_pedestrian')) {
          if (id.includes('casing')) {
            classifiedRoadLayers.path_casing.push(id);
            map.setPaintProperty(id, 'line-color', '#D4CCB9');
            map.setPaintProperty(id, 'line-opacity', 0.42);
          } else {
            classifiedRoadLayers.path.push(id);
            map.setPaintProperty(id, 'line-color', '#EAE2CF');
            map.setPaintProperty(id, 'line-opacity', 0.42);
          }
        }
      });

      // 3B. Indian Railways Ballasted Steel Railroads vs Distinct DMRC Colored Metro Network
      railThemeLayers = { major: [], majorHatch: [], transit: [], transitHatch: [], irBallast: [], irSleepers: [], irRails: [] };
      const transitGuardExpr = clearance && clearance.corridorDistanceGeo
        ? ['>', ['distance', clearance.corridorDistanceGeo], 18.0]
        : null;
      const railBefore = map.getLayer('building-3d') ? 'building-3d' : undefined;

      // 3B-i) Multi-layer Broad-Gauge Railroad Stack (Ballast Bed + Perpendicular Crossties + Twin Offset Steel Rails)
      const irSurfaceFilter = ['all', ['==', ['get', 'class'], 'rail'], ['==', ['get', 'subclass'], 'rail'], ['!=', ['get', 'brunnel'], 'tunnel']];
      if (!map.getLayer('ir-rail-ballast')) {
        map.addLayer({
          id: 'ir-rail-ballast',
          type: 'line',
          source: 'openmaptiles',
          'source-layer': 'transportation',
          minzoom: 13.4,
          filter: irSurfaceFilter,
          layout: { 'line-cap': 'butt', 'line-join': 'round', visibility: 'visible' },
          paint: {
            'line-color': '#ACA393',
            'line-width': ['interpolate', ['linear'], ['zoom'], 13.4, 3.8, 14.5, 5.8, 16.5, 10.6, 18.5, 15.2],
            'line-opacity': ['interpolate', ['linear'], ['zoom'], 13.4, 0.55, 14.2, 0.86]
          }
        }, railBefore);
      }
      if (!map.getLayer('ir-rail-sleepers')) {
        map.addLayer({
          id: 'ir-rail-sleepers',
          type: 'line',
          source: 'openmaptiles',
          'source-layer': 'transportation',
          minzoom: 13.8,
          filter: irSurfaceFilter,
          layout: { 'line-cap': 'butt', 'line-join': 'round', visibility: 'visible' },
          paint: {
            'line-color': '#4A382B',
            'line-width': ['interpolate', ['linear'], ['zoom'], 13.8, 2.4, 15.5, 5.4, 17.5, 8.8, 19.0, 12.0],
            'line-dasharray': [0.16, 0.34],
            'line-opacity': ['interpolate', ['linear'], ['zoom'], 13.8, 0.45, 14.6, 0.88]
          }
        }, railBefore);
      }
      [
        ['ir-rail-steel-left', ['interpolate', ['linear'], ['zoom'], 14.4, -0.85, 16.5, -1.35, 18.5, -2.05, 19.0, -2.5]],
        ['ir-rail-steel-right', ['interpolate', ['linear'], ['zoom'], 14.4, 0.85, 16.5, 1.35, 18.5, 2.05, 19.0, 2.5]]
      ].forEach(([lid, offExpr]) => {
        if (!map.getLayer(lid)) {
          map.addLayer({
            id: lid,
            type: 'line',
            source: 'openmaptiles',
            'source-layer': 'transportation',
            minzoom: 14.4,
            filter: irSurfaceFilter,
            layout: { 'line-cap': 'butt', 'line-join': 'round', visibility: 'visible' },
            paint: {
              'line-color': '#1E293B',
              'line-offset': offExpr,
              'line-width': ['interpolate', ['linear'], ['zoom'], 14.4, 0.75, 16.5, 1.25, 18.5, 1.85],
              'line-opacity': ['interpolate', ['linear'], ['zoom'], 14.4, 0.55, 15.0, 0.94]
            }
          }, railBefore);
        }
      });
      railThemeLayers.irBallast.push('ir-rail-ballast');
      railThemeLayers.irSleepers.push('ir-rail-sleepers');
      railThemeLayers.irRails.push('ir-rail-steel-left', 'ir-rail-steel-right');

      // 3B-ii) Official DMRC Colored Corridors (Blue, Red, Violet, Magenta, Pink, Airport Orange, Green, Grey, Rapid)
      const metroVis = (subwayRailsVisible || undergroundXRay) ? 'visible' : 'none';
      if (!dmrcMetroLoaded) {
        dmrcMetroLoaded = true;
        fetch('src/data/dmrc_other_lines_gtfs.json')
          .then((r) => (r.ok ? r.json() : null))
          .then((fc) => {
            if (!fc || !map) return;
            if (!map.getSource('dmrc-other-lines')) {
              map.addSource('dmrc-other-lines', { type: 'geojson', data: fc });
            }
            const mBefore = map.getLayer('ir-rail-ballast') ? 'ir-rail-ballast' : (map.getLayer('building-3d') ? 'building-3d' : undefined);
            const curVis = (subwayRailsVisible || undergroundXRay) ? 'visible' : 'none';
            const otherLinesFilter = ['!=', ['get', 'line'], 'Blue Line'];
            if (!map.getLayer('dmrc-metro-casing')) {
              map.addLayer({
                id: 'dmrc-metro-casing',
                type: 'line',
                source: 'dmrc-other-lines',
                minzoom: 9.2,
                filter: otherLinesFilter,
                layout: { 'line-cap': 'round', 'line-join': 'round', visibility: curVis },
                paint: {
                  'line-color': '#0F172A',
                  'line-width': ['interpolate', ['linear'], ['zoom'], 9.5, 4.0, 13.0, 6.8, 16.0, 9.5, 18.5, 13.0],
                  'line-opacity': ['interpolate', ['linear'], ['zoom'], 9.5, 0.65, 15.0, 0.42]
                }
              }, mBefore);
            }
            if (!map.getLayer('dmrc-metro-core')) {
              map.addLayer({
                id: 'dmrc-metro-core',
                type: 'line',
                source: 'dmrc-other-lines',
                minzoom: 9.2,
                filter: otherLinesFilter,
                layout: { 'line-cap': 'round', 'line-join': 'round', visibility: curVis },
                paint: {
                  'line-color': ['get', 'color'],
                  'line-width': ['interpolate', ['linear'], ['zoom'], 9.5, 2.4, 13.0, 4.2, 16.0, 6.2, 18.5, 8.6],
                  'line-opacity': ['interpolate', ['linear'], ['zoom'], 9.5, 0.90, 15.0, 0.62, 18.5, 0.48]
                }
              }, mBefore);
            }
            if (!map.getLayer('dmrc-metro-label')) {
              map.addLayer({
                id: 'dmrc-metro-label',
                type: 'symbol',
                source: 'dmrc-other-lines',
                minzoom: 13.2,
                filter: otherLinesFilter,
                layout: {
                  'symbol-placement': 'line',
                  'symbol-spacing': 360,
                  'text-field': ['concat', '🚇 ', ['get', 'line']],
                  'text-font': ['Noto Sans Bold'],
                  'text-size': 10.5,
                  visibility: curVis
                },
                paint: {
                  'text-color': '#FFFFFF',
                  'text-halo-color': ['get', 'color'],
                  'text-halo-width': 2.2
                }
              });
            }
            map.triggerRepaint();
          })
          .catch(() => {});
      }

      layers.forEach((l) => {
        if (l.type !== 'line' || l.source !== 'openmaptiles') return;
        const id = l.id;
        if (!id.includes('major_rail') && !id.includes('transit_rail')) return;
        const isMajor = id.includes('major_rail');
        const isHatch = id.includes('hatching');
        const isTunnel = id.includes('tunnel');
        try {
          if (isMajor) {
            map.setLayoutProperty(id, 'visibility', 'visible');
            if (isHatch) {
              railThemeLayers.majorHatch.push(id);
              map.setPaintProperty(id, 'line-color', '#4A382B');
              map.setPaintProperty(id, 'line-opacity', isTunnel ? 0.36 : ['interpolate', ['linear'], ['zoom'], 13.4, 0.65, 14.2, 0.0]);
            } else {
              railThemeLayers.major.push(id);
              map.setPaintProperty(id, 'line-color', isTunnel ? '#64748B' : '#57463A');
              map.setPaintProperty(id, 'line-width', ['interpolate', ['linear'], ['zoom'], 10, 0.9, 13.5, 1.7, 16, 2.2]);
              map.setPaintProperty(id, 'line-opacity', isTunnel ? 0.48 : ['interpolate', ['linear'], ['zoom'], 13.4, 0.88, 14.2, 0.0]);
            }
          } else {
            if (transitGuardExpr) {
              if (!l.__origRailFilter) l.__origRailFilter = map.getFilter(id) || true;
              map.setFilter(id, ['all', l.__origRailFilter, transitGuardExpr]);
            }
            map.setLayoutProperty(id, 'visibility', metroVis);
            if (isHatch) {
              railThemeLayers.transitHatch.push(id);
              map.setPaintProperty(id, 'line-color', '#E0F2FE');
              map.setPaintProperty(id, 'line-width', ['interpolate', ['linear'], ['zoom'], 12, 1.0, 15, 2.0, 18, 2.8]);
              map.setPaintProperty(id, 'line-opacity', isTunnel ? 0.72 : 0.85);
            } else {
              railThemeLayers.transit.push(id);
              map.setPaintProperty(id, 'line-color', isTunnel ? '#0284C7' : '#0F172A');
              map.setPaintProperty(id, 'line-width', ['interpolate', ['linear'], ['zoom'], 12, 2.2, 15, 4.2, 18, 6.2]);
              map.setPaintProperty(id, 'line-opacity', isTunnel ? 0.62 : 0.82);
            }
          }
        } catch (_) {}
      });

      // 4. Sculpted Real Buildings: OpenFreeMap fallback (`building-3d`) + Overture Maps (`overture-buildings-3d`) + WallShadowLayer AO
      if (map.getLayer('building')) {
        map.setPaintProperty('building', 'fill-color', '#DFD8C9');
        map.setPaintProperty('building', 'fill-outline-color', '#C5BCAE');
        if (overtureLoaded) {
          map.setPaintProperty('building', 'fill-opacity', ['interpolate', ['linear'], ['zoom'], 12.6, 0.55, 13.4, 0.0]);
          map.setPaintProperty('building', 'fill-outline-color', 'rgba(197, 188, 174, 0)');
        }
        if (clearance) {
          map.setFilter('building', buildCorridorDistanceFilter(clearance, 24.0));
        }
      }

      if (map.getLayer('building-3d')) {
        map.setLayoutProperty('building-3d', 'visibility', 'visible');
        map.setLayerZoomRange('building-3d', 12.6, 24);
        map.setPaintProperty('building-3d', 'fill-extrusion-vertical-gradient', true);
        map.setPaintProperty('building-3d', 'fill-extrusion-color', [
          'case',
          ['>=', ['coalesce', ['get', 'render_height'], 8], 24],
          '#A9C5DD',
          [
            'match',
            ['%', ['round', ['coalesce', ['get', 'render_height'], 8]], 8],
            0, '#EDE2CF',
            1, '#E6C2A3',
            2, '#DBB494',
            3, '#E0D9CD',
            4, '#C2D6C2',
            5, '#B7CDD9',
            6, '#EAD0AA',
            '#DAAD98'
          ]
        ]);
        const hideNativeFallback = wallShadowLayer && wallShadowLayer.lastRenderedTileCount > 0 && map.getZoom() >= 12.6 && wallShadowLayer.wallShade;
        map.setPaintProperty('building-3d', 'fill-extrusion-opacity', hideNativeFallback ? 0.005 : (undergroundXRay ? 0.24 : 0.94));
        if (clearance) {
          map.setFilter('building-3d', [
            'all',
            ['!', ['has', 'hide_3d']],
            buildCorridorDistanceFilter(clearance, 24.0)
          ]);
        }
      }

      setupOvertureAndWallShadow(clearance);

      // 5. Crisp Typography: clean road labels & major/neighborhood POIs; dedupe Yellow Line station & hero monument badges
      ['poi_r1', 'poi_r7', 'highway-name-major', 'highway-name-minor', 'label_town', 'label_other'].forEach((id) => {
        if (!map.getLayer(id)) return;
        map.setPaintProperty(id, 'text-color', id.startsWith('highway') ? '#475569' : '#334155');
        map.setPaintProperty(id, 'text-halo-color', '#FFFFFF');
        map.setPaintProperty(id, 'text-halo-width', 1.5);
      });
      if (clearance) {
        if (map.getLayer('poi_r1')) {
          map.setFilter('poi_r1', [
            'all',
            ['match', ['geometry-type'], ['MultiPoint', 'Point'], true, false],
            ['>=', ['get', 'rank'], 1],
            ['<', ['get', 'rank'], 7],
            ['!=', ['get', 'class'], 'entrance'],
            ['>', ['distance', clearance.stationOnlyPointsGeo], 74],
            ['>', ['distance', clearance.metroCorridorOnlyGeo], 28],
            ['>', ['distance', clearance.monumentPointsGeo], 95]
          ]);
        }
        if (map.getLayer('poi_r7')) {
          map.setFilter('poi_r7', [
            'all',
            ['match', ['geometry-type'], ['MultiPoint', 'Point'], true, false],
            ['>=', ['get', 'rank'], 7],
            ['<', ['get', 'rank'], 20],
            ['!=', ['get', 'class'], 'entrance'],
            ['>', ['distance', clearance.stationOnlyPointsGeo], 74],
            ['>', ['distance', clearance.metroCorridorOnlyGeo], 28],
            ['>', ['distance', clearance.monumentPointsGeo], 95]
          ]);
        }
        if (map.getLayer('poi_transit')) {
          map.setLayerZoomRange('poi_transit', 16.2, 24);
          map.setFilter('poi_transit', [
            'all',
            ['match', ['get', 'class'], ['airport', 'bus', 'rail'], true, false],
            ['>', ['distance', clearance.stationOnlyPointsGeo], 160]
          ]);
        }
      }

      // 6. Global Warm South-East Sunlight & Horizon Sky Atmosphere (matches Three.js sunShadowLight & WallShadowLayer)
      map.setLight({
        anchor: 'map',
        color: '#FFFDF8',
        intensity: 0.40,
        position: [1.15, 138, 30]
      });
      if (typeof map.setSky === 'function') {
        map.setSky({
          'sky-color': '#87C4E8',
          'sky-horizon-blend': 0.45,
          'horizon-color': '#F3EFE6',
          'horizon-fog-blend': 0.36,
          'fog-color': '#EBE6DA',
          'fog-ground-blend': 0.14
        });
      }
    } catch (err) {
      console.warn('configureMapLibreVisualHarmony notice:', err);
    }

    // 3. Clean live Yellow Line overview train dots pinned directly to our 24 OSM-aligned fleet trains
    if (!map.getSource('yl-overview-trains')) {
      try {
        map.addSource('yl-overview-trains', {
          type: 'geojson',
          data: { type: 'FeatureCollection', features: [] }
        });
        map.addLayer({
          id: 'yl-overview-trains-layer',
          type: 'circle',
          source: 'yl-overview-trains',
          paint: {
            'circle-radius': 4.4,
            'circle-color': '#DC2626',
            'circle-stroke-color': '#FFFFFF',
            'circle-stroke-width': 1.6,
            'circle-opacity': ['interpolate', ['linear'], ['zoom'], 11.8, 0.95, 12.8, 0.0],
            'circle-stroke-opacity': ['interpolate', ['linear'], ['zoom'], 11.8, 0.95, 12.8, 0.0]
          }
        });
      } catch (_) { }
    }

    ['overview-corridor-aura', 'overview-corridor-casing', 'overview-corridor-core', 'overview-corridor-gleam'].forEach((id) => {
      if (!map.getLayer(id)) return;
      try {
        map.setPaintProperty(id, 'line-opacity', [
          'interpolate', ['linear'], ['zoom'],
          10.0, id === 'overview-corridor-aura' ? 0.22 : 0.90,
          12.6, id === 'overview-corridor-aura' ? 0.12 : 0.45,
          13.4, 0.0
        ]);
      } catch (_) { }
    });

    if (stationsData.length && map.getSource('stations')) {
      try {
        map.getSource('stations').setData({
          type: 'FeatureCollection',
          features: stationsData.map((s) => ({
            type: 'Feature',
            geometry: { type: 'Point', coordinates: s.coords },
            properties: {
              name: s.name,
              structure: s.structure,
              major: !!(s.major || s.interchange || s.terminus),
              terminus: !!s.terminus,
              interchange: s.interchange || null
            }
          }))
        });
      } catch (_) { }
    }

    ['station-nodes-major', 'station-nodes-major-pupil', 'station-nodes-local'].forEach((id) => {
      if (!map.getLayer(id)) return;
      try {
        if (id === 'station-nodes-major') {
          map.setPaintProperty(id, 'circle-radius', 5.2);
          map.setPaintProperty(id, 'circle-color', '#EAB308');
          map.setPaintProperty(id, 'circle-stroke-color', '#0F172A');
          map.setPaintProperty(id, 'circle-stroke-width', 2.0);
        } else if (id === 'station-nodes-major-pupil') {
          map.setPaintProperty(id, 'circle-radius', 2.0);
        } else if (id === 'station-nodes-local') {
          map.setPaintProperty(id, 'circle-radius', 3.4);
          map.setPaintProperty(id, 'circle-color', '#FFFFFF');
          map.setPaintProperty(id, 'circle-stroke-color', '#0F172A');
          map.setPaintProperty(id, 'circle-stroke-width', 1.6);
        }
        map.setPaintProperty(id, 'circle-opacity', [
          'interpolate', ['linear'], ['zoom'],
          12.2, 0.95,
          13.2, 0.0
        ]);
        map.setPaintProperty(id, 'circle-stroke-opacity', [
          'interpolate', ['linear'], ['zoom'],
          12.2, 0.95,
          13.2, 0.0
        ]);
      } catch (_) { }
    });

    if (map.getLayer('station-labels-major')) {
      try {
        map.setPaintProperty('station-labels-major', 'text-opacity', [
          'interpolate', ['linear'], ['zoom'],
          10.0, 0.94,
          11.2, 0.92,
          11.8, 0.0
        ]);
      } catch (_) { }
    }
    if (map.getLayer('station-labels-local')) {
      try {
        map.setPaintProperty('station-labels-local', 'text-opacity', [
          'interpolate', ['linear'], ['zoom'],
          10.0, 0.92,
          14.8, 0.85,
          15.6, 0.0
        ]);
      } catch (_) { }
    }

    // Crisp surface dashed indicator along buried underground route (shown when Rails are hidden beneath street) + persistent tube label
    if (undergroundRouteGeo) {
      if (!map.getSource('underground-route-guide')) {
        map.addSource('underground-route-guide', { type: 'geojson', data: undergroundRouteGeo });
      }
      const guideBefore = map.getLayer('building-3d') ? 'building-3d' : undefined;
      const guideDashVis = (subwayRailsVisible || undergroundXRay) ? 'none' : 'visible';
      const guideLabelVis = undergroundXRay ? 'none' : 'visible';
      if (!map.getLayer('underground-guide-casing')) {
        map.addLayer({
          id: 'underground-guide-casing',
          type: 'line',
          source: 'underground-route-guide',
          minzoom: 12.8,
          layout: { 'line-cap': 'butt', 'line-join': 'round', visibility: guideDashVis },
          paint: {
            'line-color': '#0F172A',
            'line-width': ['interpolate', ['linear'], ['zoom'], 12.8, 4.5, 16, 7.5, 18.5, 10.5],
            'line-dasharray': [2.2, 1.8],
            'line-opacity': 0.55
          }
        }, guideBefore);
      }
      if (!map.getLayer('underground-guide-dash')) {
        map.addLayer({
          id: 'underground-guide-dash',
          type: 'line',
          source: 'underground-route-guide',
          minzoom: 12.8,
          layout: { 'line-cap': 'butt', 'line-join': 'round', visibility: guideDashVis },
          paint: {
            'line-color': '#FACC15',
            'line-width': ['interpolate', ['linear'], ['zoom'], 12.8, 2.6, 16, 4.6, 18.5, 6.8],
            'line-dasharray': [2.2, 1.8],
            'line-opacity': 0.94
          }
        }, guideBefore);
      }
      if (!map.getLayer('underground-guide-label')) {
        map.addLayer({
          id: 'underground-guide-label',
          type: 'symbol',
          source: 'underground-route-guide',
          minzoom: 14.8,
          layout: {
            'symbol-placement': 'line',
            'symbol-spacing': 340,
            'text-field': '⬇ UNDERGROUND TUBE (-16m)',
            'text-font': ['Noto Sans Bold'],
            'text-size': 10.5,
            'text-offset': [0, 1.4],
            visibility: guideLabelVis
          },
          paint: {
            'text-color': '#0F172A',
            'text-halo-color': '#FEF08A',
            'text-halo-width': 2.4
          }
        });
      }
    }

    if (currentSecOfDay !== null) {
      applyAtmosphere(currentSecOfDay, true);
    }
    initMonumentMarkers();
  }

  function checkLatestOvertureRelease() {
    if (stacChecked || !map) return;
    stacChecked = true;
    fetch('https://stac.overturemaps.org/catalog.json', { mode: 'cors' })
      .then((res) => (res.ok ? res.json() : null))
      .then((cat) => {
        const latest = cat && typeof cat.latest === 'string' ? cat.latest.trim() : null;
        if (!latest || !/^\d{4}-\d{2}-\d{2}\.\d+$/.test(latest)) return;
        const candidateHttp = `https://overturemaps-extras-us-west-2.s3.us-west-2.amazonaws.com/tiles/${latest}/buildings.pmtiles`;
        return fetch(candidateHttp, { method: 'HEAD', mode: 'cors' }).then((hRes) => {
          if (hRes && (hRes.ok || hRes.status === 206)) {
            try { localStorage.setItem('dmrc_overture_release', latest); } catch (_) { }
          }
        });
      })
      .catch(() => { });
  }

  function setupOvertureAndWallShadow(clearance) {
    if (!map || !map.getStyle()) return;

    ensurePMTilesProtocol();

    if (window._pmtilesProtocolRegistered && !map.getSource('overture-buildings')) {
      try {
        const releaseTag = getPreferredOvertureRelease();
        map.addSource('overture-buildings', {
          type: 'vector',
          url: `pmtiles://https://overturemaps-extras-us-west-2.s3.us-west-2.amazonaws.com/tiles/${releaseTag}/buildings.pmtiles`,
          maxzoom: 14,
          attribution: '© Overture Maps Foundation'
        });
      } catch (e) {
        console.warn('[MetroWebGLLayer] Overture source notice:', e);
      }
    }

    const lastHex = ['slice', ['concat', 'x', ['to-string', ['coalesce', ['get', 'id'], '0']]], -1];
    const hasNumH = ['>', ['to-number', ['get', 'height'], 0], 0];
    const hasNumF = ['>', ['to-number', ['get', 'num_floors'], 0], 0];
    const heightExpr = [
      'case',
      hasNumH, ['to-number', ['get', 'height'], 9],
      hasNumF, ['*', ['to-number', ['get', 'num_floors'], 3], 3.25],
      [
        'match',
        ['coalesce', ['get', 'subtype'], 'residential'],
        'commercial', ['match', lastHex, ['0', '1', '2', '3'], 15.5, ['4', '5', '6', '7'], 19.5, ['8', '9', 'a', 'b'], 24.0, 17.5],
        ['civic', 'education', 'medical'], ['match', lastHex, ['0', '1', '2', '3'], 13.5, ['4', '5', '6', '7'], 17.0, 15.0],
        'religious', 13.0,
        'industrial', 11.0,
        ['outbuilding', 'agricultural', 'service', 'shed', 'garage', 'carport', 'roof'], 3.8,
        ['match', lastHex,
          ['0', '1'], 6.8,
          ['2', '3'], 8.2,
          ['4', '5'], 9.6,
          ['6', '7'], 11.2,
          ['8', '9'], 12.6,
          ['a', 'b'], 14.2,
          ['c', 'd'], 7.4,
          10.2
        ]
      ]
    ];

    const filterExpr = clearance
      ? ['all', ['!=', ['get', 'is_underground'], true], buildCorridorDistanceFilter(clearance, 24.0)]
      : ['!=', ['get', 'is_underground'], true];

    if (map.getSource('overture-buildings') && !map.getLayer('overture-buildings-3d')) {
      const beforeTarget = map.getLayer('wallshadow')
        ? 'wallshadow'
        : (map.getLayer('metro-webgl-3d-layer') ? 'metro-webgl-3d-layer' : undefined);
      try {
        map.addLayer({
          id: 'overture-buildings-3d',
          type: 'fill-extrusion',
          source: 'overture-buildings',
          'source-layer': 'building',
          minzoom: 12.6,
          maxzoom: 24,
          filter: filterExpr,
          paint: {
            'fill-extrusion-base': ['coalesce', ['get', 'min_height'], 0],
            'fill-extrusion-height': heightExpr,
            'fill-extrusion-vertical-gradient': true,
            'fill-extrusion-opacity': undergroundXRay ? 0.24 : 0.94,
            'fill-extrusion-color': [
              'case',
              ['all', ['has', 'facade_color'], ['==', ['slice', ['to-string', ['get', 'facade_color']], 0, 1], '#']],
              ['get', 'facade_color'],
              ['>=', heightExpr, 20],
              [
                'match',
                lastHex,
                ['0', '1', '2', '3'], '#9FC2DE',
                ['4', '5', '6', '7'], '#ABCAD9',
                ['8', '9', 'a', 'b'], '#8EB4D6',
                '#B5CBE0'
              ],
              [
                'match',
                ['coalesce', ['get', 'subtype'], 'residential'],
                'commercial', [
                  'match',
                  lastHex,
                  ['0', '1', '2', '3', '4'], '#B8D0E2',
                  ['5', '6', '7', '8', '9'], '#A6C4DB',
                  '#CBD7E3'
                ],
                ['civic', 'education', 'medical'], '#EAD2B4',
                'religious', '#D69E7E',
                'industrial', '#B8C4D0',
                [
                  'match',
                  lastHex,
                  '0', '#EFE3CF', // Sandstone cream
                  '1', '#E7C1A2', // Terracotta peach
                  '2', '#DCB492', // Earthy ochre stucco
                  '3', '#E2DDD0', // Limestone plaster
                  '4', '#C3D7C3', // Botanical sage stucco
                  '5', '#F3E7D4', // Sunlit ivory plaster
                  '6', '#DCAA96', // Rose terracotta
                  '7', '#EBCFA9', // Dholpur buff sandstone
                  '8', '#BCD0DC', // Powder slate facade
                  '9', '#EFE0C3', // Heritage buttercream
                  'a', '#E3C3B5', // Blush plaster
                  'b', '#CFD7CE', // Architectural celadon
                  'c', '#ECD2B2', // Amber travertine
                  'd', '#B5CBD8', // Cool coastal blue
                  'e', '#E8DFCF', // Warm travertine
                  '#D8BEA7'
                ]
              ]
            ]
          }
        }, beforeTarget);
      } catch (e) {
        console.warn('[MetroWebGLLayer] overture-buildings-3d layer notice:', e);
      }
    } else if (map.getLayer('overture-buildings-3d')) {
      try {
        map.setFilter('overture-buildings-3d', filterExpr);
      } catch (_) { }
    }

    if (window.WallShadowLayer && !map.getLayer('wallshadow')) {
      try {
        const hasOvertureLayer = !!map.getLayer('overture-buildings-3d');
        const hasFallbackLayer = !!map.getLayer('building-3d');
        const initTarget = hasOvertureLayer ? 'overture-buildings-3d' : 'building-3d';
        const initSource = hasOvertureLayer ? 'overture-buildings' : 'openmaptiles';
        activeBuildingLayerId = initTarget;
        activeBuildingSourceId = initSource;
        const mobileProfile = isMobileProfile();
        wallShadowLayer = new window.WallShadowLayer({
          id: 'wallshadow',
          buildingsLayerId: initTarget,
          sourceId: initSource,
          fallbackLayerId: (hasOvertureLayer && hasFallbackLayer) ? 'building-3d' : null,
          fallbackSourceId: (hasOvertureLayer && hasFallbackLayer) ? 'openmaptiles' : null,
          minZoom: 12.6,
          maxZoom: 20,
          sdfResolution: mobileProfile ? 256 : 512,
          stickyCacheMax: mobileProfile ? 24 : 64,
          strength: 0.34,
          band: 0.85,
          facadeDetail: 0.85,
          shadowAlpha: 0.24,
          heightScale: 0.48,
          shadowOffset: [-0.62, -0.48],
          shadowBlur: 2.2,
          aoRadiusMin: 16,
          aoRadiusMax: 54,
          aoIntensity: 0.36,
          aoOffset: [0, -1, 0],
          onRenderTiles(count) {
            const hideNative = count > 0 && map && map.getZoom() >= 12.6 && wallShadowLayer && wallShadowLayer.wallShade;
            const baseOp = undergroundXRay ? 0.24 : 0.94;
            const nextOp = hideNative ? 0.005 : baseOp;
            ['overture-buildings-3d', 'building-3d'].forEach((lid) => {
              if (map && map.getLayer(lid)) {
                const cur = map.getPaintProperty(lid, 'fill-extrusion-opacity');
                if (cur !== nextOp) {
                  try { map.setPaintProperty(lid, 'fill-extrusion-opacity', nextOp); } catch (_) { }
                }
              }
            });
          }
        });
        const beforeThree = map.getLayer('metro-webgl-3d-layer') ? 'metro-webgl-3d-layer' : undefined;
        map.addLayer(wallShadowLayer, beforeThree);
      } catch (e) {
        console.warn('[MetroWebGLLayer] WallShadowLayer setup notice:', e);
      }
    } else if (wallShadowLayer && map.getLayer('overture-buildings-3d') && map.getLayer('building-3d')) {
      wallShadowLayer.setFallback('building-3d', 'openmaptiles');
    }

    // Guarantee exact Z/draw sequence: building-3d -> overture-buildings-3d -> wallshadow -> underground-guide -> metro-webgl-3d-layer -> station labels & overview dots
    try {
      const metroBefore = map.getLayer('metro-webgl-3d-layer') ? 'metro-webgl-3d-layer' : undefined;
      if (map.getLayer('underground-guide-casing') && metroBefore) {
        map.moveLayer('underground-guide-casing', metroBefore);
      }
      if (map.getLayer('underground-guide-dash') && metroBefore) {
        map.moveLayer('underground-guide-dash', metroBefore);
      }
      const guideOrMetroBefore = map.getLayer('underground-guide-casing') ? 'underground-guide-casing' : metroBefore;
      if (map.getLayer('wallshadow') && guideOrMetroBefore) {
        map.moveLayer('wallshadow', guideOrMetroBefore);
      }
      const wsBefore = map.getLayer('wallshadow') ? 'wallshadow' : guideOrMetroBefore;
      if (map.getLayer('overture-buildings-3d') && wsBefore) {
        map.moveLayer('overture-buildings-3d', wsBefore);
      }
      const ovBefore = map.getLayer('overture-buildings-3d') ? 'overture-buildings-3d' : wsBefore;
      if (map.getLayer('building-3d') && ovBefore) {
        map.moveLayer('building-3d', ovBefore);
      }
      ['station-labels-local', 'station-labels-major', 'underground-guide-label', 'yl-overview-trains-layer'].forEach((topId) => {
        if (map.getLayer(topId)) map.moveLayer(topId);
      });
    } catch (_) { }

    if (!overtureWatcherAttached) {
      overtureWatcherAttached = true;
      const promoteOvertureWhenReady = () => {
        if (!map || overtureLoaded || !map.getSource('overture-buildings') || !map.getLayer('overture-buildings-3d')) return;
        let hasLoadedTile = false;
        try {
          const style = map.style;
          const mgr = style && ((style.tileManagers && style.tileManagers['overture-buildings']) ||
            (style.sourceCaches && style.sourceCaches['overture-buildings']));
          if (mgr && typeof mgr.getVisibleCoordinates === 'function') {
            const coords = mgr.getVisibleCoordinates();
            for (let i = 0; i < coords.length; i++) {
              const tile = mgr.getTile(coords[i]);
              if (tile && tile.state === 'loaded') {
                hasLoadedTile = true;
                break;
              }
            }
          }
        } catch (_) { }

        if (hasLoadedTile) {
          overtureLoaded = true;
          activeBuildingLayerId = 'overture-buildings-3d';
          activeBuildingSourceId = 'overture-buildings';
          try {
            // Keep building-3d visible as per-tile instant fallback inside WallShadowLayer
            if (map.getLayer('building-3d')) {
              map.setLayoutProperty('building-3d', 'visibility', 'visible');
            }
            if (map.getLayer('building')) {
              map.setPaintProperty('building', 'fill-opacity', ['interpolate', ['linear'], ['zoom'], 12.6, 0.55, 13.4, 0.0]);
              map.setPaintProperty('building', 'fill-outline-color', 'rgba(197, 188, 174, 0)');
            }
          } catch (_) { }
          if (wallShadowLayer) {
            wallShadowLayer.setTarget('overture-buildings-3d', 'overture-buildings');
            if (map.getLayer('building-3d')) {
              wallShadowLayer.setFallback('building-3d', 'openmaptiles');
            }
          }
          map.triggerRepaint();
          setTimeout(checkLatestOvertureRelease, 3500);
        }
      };

      map.on('sourcedata', (e) => {
        if (e && e.sourceId === 'overture-buildings') promoteOvertureWhenReady();
      });
      map.on('idle', promoteOvertureWhenReady);
    }
  }

  /* ───────────────────────────────────────────────────────────
   * 6. Scene Orchestration, MapLibre CustomLayer & Interactions
   * ─────────────────────────────────────────────────────────── */
  async function loadTopologyAndBuild() {
    try {
      const osmPromise = window.__yellowLineOsmPromise || (
        window.__yellowLineOsmPromise = fetch('src/data/yellow_line_accurate_osm.json').then((r) => r.json())
      );
      const topoPromise = window.__delhiTopoPromise || (
        window.__delhiTopoPromise = fetch('src/data/delhi_network_topology_geo.json').then((r) => r.json())
      );
      const svcPromise = window.__yellowLineServicePromise || (
        window.__yellowLineServicePromise = fetch('src/data/yellow_line_service.json').then((r) => r.json()).catch(() => null)
      );
      const blueOsmPromise = window.__blueLineOsmPromise || (
        window.__blueLineOsmPromise = fetch('src/data/blue_line_accurate_osm.json').then((r) => r.json()).catch(() => null)
      );
      const blueSvcPromise = window.__blueLineServicePromise || (
        window.__blueLineServicePromise = fetch('src/data/blue_line_service.json').then((r) => r.json()).catch(() => null)
      );
      const vaishaliOsmPromise = window.__vaishaliOsmPromise || (
        window.__vaishaliOsmPromise = fetch('src/data/vaishali_branch_accurate_osm.json').then((r) => r.json()).catch(() => null)
      );
      const yamunaYardPromise = window.__yamunaYardPromise || (
        window.__yamunaYardPromise = fetch('src/data/yamuna_bank_yard_tracks.json').then((r) => r.json()).catch(() => null)
      );
      const interchangeHubsPromise = window.__interchangeHubsPromise || (
        window.__interchangeHubsPromise = fetch('src/data/dmrc_interchange_hubs.json').then((r) => r.json()).catch(() => null)
      );
      const [osmData, topoData, svcData, blueOsmData, blueSvcData, vaishaliOsmData, yamunaYardJson, interchangeHubsJson] = await Promise.all([
        osmPromise, topoPromise, svcPromise, blueOsmPromise, blueSvcPromise, vaishaliOsmPromise, yamunaYardPromise, interchangeHubsPromise
      ]);
      yamunaYardData = yamunaYardJson;
      interchangeHubsData = interchangeHubsJson;
      buildScene(osmData, topoData, svcData, blueOsmData, blueSvcData, vaishaliOsmData);
    } catch (err) {
      console.error('MetroWebGLLayer failed to load metro data:', err);
    }
  }

  function updateVisibilityAndCulling(now, dtSec, skipOverviewSync) {
    if (!map || !originMc) return;
    const centerMc = window.maplibregl.MercatorCoordinate.fromLngLat(map.getCenter(), 0);
    const focusX = (centerMc.x - originMc.x) / meterUnit;
    const focusZ = (centerMc.y - originMc.y) / meterUnit;
    const zoom = map.getZoom();

    // shortcut: narrows street-zoom visR on mobile to 1350m (from 2600m) for multi-line scale; raise if horizon station pop appears
    const mob = isMobileProfile();
    const visR = zoom >= 17.2 ? (mob ? 1350 : 2100) : (zoom >= 15.2 ? (mob ? 2400 : 3600) : (zoom >= 13.5 ? 7200 : 18000));
    const visR2 = visR * visR;
    const detailR = zoom >= 15.5 ? (mob ? 850 : 1150) : (zoom >= 13.8 ? (mob ? 1150 : 1600) : 0);
    const detailR2 = detailR * detailR;
    const shadowR2 = 340 * 340;

    if (yamunaYardGroup) {
      const ybSt = blueCorridor && blueCorridor.stationsData ? blueCorridor.stationsData.find((s) => s.name === 'Yamuna Bank') : null;
      const ybD2 = ybSt ? ((ybSt.pos.x - focusX) * (ybSt.pos.x - focusX) + (ybSt.pos.z - focusZ) * (ybSt.pos.z - focusZ)) : 0;
      const yardR2 = Math.max(visR + 900, 2600) * Math.max(visR + 900, 2600);
      yamunaYardGroup.visible = (activeLineId !== 'yellow') && (ybD2 <= yardR2);
    }

    const list = allStationsData.length ? allStationsData : stationsData;
    for (let i = 0; i < list.length; i++) {
      const st = list[i];
      if (activeLineId !== 'all' && !st._isSharedDualHub) {
        const isB = Boolean(st.isBlue || st.lineId === 'blue' || st.lineKey === 'blue' || (st.corridor && st.corridor.isBlue));
        if (activeLineId === 'blue' && !isB) {
          if (st._group && st._group.visible) st._group.visible = false;
          if (st._ring && st._ring.visible) st._ring.visible = false;
          continue;
        }
        if (activeLineId === 'yellow' && isB) {
          if (st._group && st._group.visible) st._group.visible = false;
          if (st._ring && st._ring.visible) st._ring.visible = false;
          continue;
        }
      }

      const dx = st.pos.x - focusX;
      const dz = st.pos.z - focusZ;
      const d2 = dx * dx + dz * dz;
      const isVis = d2 <= visR2;

      if (st._group && st._group.visible !== isVis) {
        st._group.visible = isVis;
      }
      if (isVis) {
        if (!st._signageReady) ensureStationSignage(st);
        const showDetail = detailR2 > 0 && d2 <= detailR2;
        if (st._detail && st._detail.visible !== showDetail) {
          st._detail.visible = showDetail;
        }
        const inShadow = d2 <= shadowR2;
        if (inShadow !== st._inShadow && st._shadowMeshes) {
          st._inShadow = inShadow;
          for (let k = 0; k < st._shadowMeshes.length; k++) {
            st._shadowMeshes[k].castShadow = inShadow;
          }
        }
      }

      if (st._ring) {
        const isSel = selectedStationName === st.name && isVis;
        if (st._ring.visible !== isSel) st._ring.visible = isSel;
        if (isSel) {
          st._ring.scale.setScalar(1.14 + Math.sin(now * 0.006) * 0.10);
        }
      }
    }

    // Distance & shadow culling for 3D Delhi Hero Landmarks & Indian Railways Stations
    for (let i = 0; i < monumentGroups.length; i++) {
      const mon = monumentGroups[i];
      const dx = mon.x - focusX;
      const dz = mon.z - focusZ;
      const d2 = dx * dx + dz * dz;
      const isVis = d2 <= mon.visR2;
      if (isVis && !mon.group && mon.buildFn) {
        ensureMonumentBuilt(mon);
      }
      if (!mon.group) continue;
      if (mon.group.visible !== isVis) {
        mon.group.visible = isVis;
      }
      if (isVis) {
        const inShadow = d2 <= shadowR2;
        if (inShadow !== mon._inShadow) {
          mon._inShadow = inShadow;
          for (let k = 0; k < mon.shadowMeshes.length; k++) {
            mon.shadowMeshes[k].castShadow = inShadow;
          }
        }
      }
    }

    if (dtSec > 0) {
      updateFleet(dtSec, focusX, focusZ, visR2, shadowR2);
    } else {
      updateFleet(0.001, focusX, focusZ, visR2, shadowR2);
    }

    if (!skipOverviewSync && zoom < 12.9 && !(map.isZooming && map.isZooming()) && now - lastOverviewSyncTime > 160 && map.getSource('yl-overview-trains')) {
      lastOverviewSyncTime = now;
      const feats = fleetTrains.map((tr) => {
        const c = tr.corridor || yellowCorridor;
        const s = sampleAtDist(tr.dist, c);
        if (!s) return null;
        return {
          type: 'Feature',
          geometry: { type: 'Point', coordinates: localMetersToLngLat(s.pos) },
          properties: { id: tr.id, dir: tr.dir, line: (c ? c.lineId : 'yellow') }
        };
      }).filter(Boolean);
      map.getSource('yl-overview-trains').setData({ type: 'FeatureCollection', features: feats });
    }
  }

  function buildScene(osmData, topoData, svcData, blueOsmData, blueSvcData, vaishaliOsmData) {
    if (!scene) return;
    initOrigin();

    infraGroup = new THREE.Group();
    yellowCorridor = buildCorridorCurve(osmData, topoData, svcData, 'yellow');
    samples = yellowCorridor.samples;
    totalLen = yellowCorridor.totalLen;
    stationsData = yellowCorridor.stationsData;
    fastCurveProxy = yellowCorridor.fastCurveProxy;

    if (blueOsmData) {
      blueCorridor = buildCorridorCurve(blueOsmData, topoData, blueSvcData, 'blue');
    }
    if (vaishaliOsmData) {
      vaishaliCorridor = buildCorridorCurve(vaishaliOsmData, topoData, null, 'blue-vaishali');
    }
    allCorridors = [yellowCorridor, blueCorridor, vaishaliCorridor].filter(Boolean);
    allStationsData = allCorridors.flatMap((c) => (c === vaishaliCorridor ? c.stationsData.filter((s) => s.name !== 'Yamuna Bank') : c.stationsData));

    const hemi = new THREE.HemisphereLight(0xF8FAFC, 0x94A3B8, 0.24);
    hemiLight = hemi;
    sunShadowLight = new THREE.DirectionalLight(0xFFFBEB, 0.62);
    sunShadowLight.position.set(SUN_OFFSET_X, SUN_OFFSET_Y, SUN_OFFSET_Z);
    sunShadowLight.castShadow = true;
    const shadowRes = isMobileProfile() ? 768 : 1536;
    sunShadowLight.shadow.mapSize.set(shadowRes, shadowRes);
    sunShadowLight.shadow.camera.near = 20;
    sunShadowLight.shadow.camera.far = 680;
    sunShadowLight.shadow.camera.left = -220;
    sunShadowLight.shadow.camera.right = 220;
    sunShadowLight.shadow.camera.top = 220;
    sunShadowLight.shadow.camera.bottom = -220;
    sunShadowLight.shadow.bias = -0.0005;
    sunShadowLight.shadow.normalBias = 0.22;
    scene.add(sunShadowLight.target);

    const fill = new THREE.DirectionalLight(0xBAE6FD, 0.12);
    fillLight = fill;
    fill.position.set(-140, 140, -110);
    scene.add(hemi, sunShadowLight, fill);

    const m = getMaterials();
    const catcherGeo = new THREE.PlaneGeometry(440, 440);
    catcherGeo.rotateX(-Math.PI / 2);
    shadowCatcherMesh = new THREE.Mesh(catcherGeo, m.groundShadowCatcher);
    shadowCatcherMesh.position.set(0, 0.14, 0);
    shadowCatcherMesh.receiveShadow = true;
    shadowCatcherMesh.frustumCulled = false;
    scene.add(shadowCatcherMesh);

    buildTrackInfrastructure(infraGroup, yellowCorridor.portalCoords, yellowCorridor);
    if (blueCorridor) {
      buildTrackInfrastructure(infraGroup, blueCorridor.portalCoords, blueCorridor);
    }
    if (vaishaliCorridor) {
      buildTrackInfrastructure(infraGroup, vaishaliCorridor.portalCoords, vaishaliCorridor);
    }
    if (yamunaYardData) {
      yamunaYardGroup = buildYamunaYardInfrastructure(infraGroup, yamunaYardData);
    }
    buildBeautifulDelhiEnvironment(infraGroup);
    buildAllStations(infraGroup, yellowCorridor);
    if (blueCorridor) {
      buildAllStations(infraGroup, blueCorridor);
    }
    if (vaishaliCorridor) {
      buildAllStations(infraGroup, vaishaliCorridor);
    }
    buildFleet(infraGroup, yellowCorridor);
    if (blueCorridor) {
      buildFleet(infraGroup, blueCorridor);
    }
    if (vaishaliCorridor) {
      buildFleet(infraGroup, vaishaliCorridor);
    }

    scene.add(infraGroup);
    updateVisibilityAndCulling(performance.now(), 0, true);
    isReady = true;

    configureMapLibreVisualHarmony();
    startAnimationLoop();

    if (map) {
      const bumpMotion = () => { lastCamActionTs = performance.now(); };
      ['movestart', 'move', 'zoom', 'rotate', 'pitch', 'pointerdown', 'touchstart'].forEach((ev) => {
        map.on(ev, bumpMotion);
      });
      const scheduleParkRefresh = () => {
        if (parkRefreshTimer) clearTimeout(parkRefreshTimer);
        parkRefreshTimer = setTimeout(() => {
          parkRefreshTimer = null;
          refreshDynamicParkTrees(false);
        }, 180);
      };
      map.on('moveend', scheduleParkRefresh);
      map.on('idle', scheduleParkRefresh);
      setTimeout(() => refreshDynamicParkTrees(true), 600);
      setTimeout(() => refreshDynamicParkTrees(true), 1800);
    }
  }

  function startAnimationLoop() {
    animLastTime = performance.now();
    let lastRepaintTs = animLastTime;
    const mapEl = document.getElementById('map');
    function tick(now) {
      if (document.hidden || (mapEl && mapEl.classList.contains('hidden'))) {
        animLastTime = now;
        requestAnimationFrame(tick);
        return;
      }
      const mobileIdle = isMobileProfile() && (now - lastCamActionTs > 450) && (!map || !map.isMoving());
      if (mobileIdle && (now - lastRepaintTs < 32)) {
        requestAnimationFrame(tick);
        return;
      }
      const dt = Math.min(0.05, Math.max(0.001, (now - animLastTime) / 1000));
      animLastTime = now;
      lastRepaintTs = now;

      if (isReady) {
        updateVisibilityAndCulling(now, dt, false);
      }
      if (map) map.triggerRepaint();
      requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
  }

  const customLayer = {
    id: 'metro-webgl-3d-layer',
    type: 'custom',
    renderingMode: '3d',

    onAdd(mapInstance, gl) {
      map = mapInstance;
      if (!window.THREE) return;

      glRenderer = new THREE.WebGLRenderer({
        canvas: map.getCanvas(),
        context: gl,
        antialias: true
      });
      glRenderer.autoClear = false;
      glRenderer.outputEncoding = THREE.sRGBEncoding;
      glRenderer.toneMapping = THREE.ACESFilmicToneMapping;
      glRenderer.toneMappingExposure = 1.06;
      glRenderer.shadowMap.enabled = true;
      glRenderer.shadowMap.type = THREE.PCFShadowMap;

      scene = new THREE.Scene();
      camera = new THREE.Camera();

      // Lighting uses hemiLight + sunShadowLight + fillLight (avoiding PMREM CubeUV shader double-compilation on startup)

      setupInteractions();
      loadTopologyAndBuild();
    },

    render(gl, options) {
      if (!isReady || !glRenderer || !scene || !camera || !originMatrix) return;

      const projArray =
        (options && options.defaultProjectionData && options.defaultProjectionData.mainMatrix) ||
        (options && options.modelViewProjectionMatrix) ||
        options;
      if (!projArray) return;

      const savedFbo = gl.getParameter(gl.FRAMEBUFFER_BINDING);
      const savedVp = gl.getParameter(gl.VIEWPORT);
      const zoom = map ? map.getZoom() : 15;
      const pitch = map ? map.getPitch() : 45;
      const doShadow = !!sunShadowLight && savedFbo === null && zoom >= 14.2 && pitch > 8;

      glRenderer.shadowMap.enabled = doShadow;
      if (sunShadowLight) sunShadowLight.castShadow = doShadow;
      if (shadowCatcherMesh) shadowCatcherMesh.visible = doShadow;

      if (doShadow && map && originMc) {
        const focusMc = window.maplibregl.MercatorCoordinate.fromLngLat(map.getCenter(), 0);
        const fx = (focusMc.x - originMc.x) / meterUnit;
        const fz = (focusMc.y - originMc.y) / meterUnit;
        const sx = Math.round(fx / 24) * 24;
        const sz = Math.round(fz / 24) * 24;
        if (sx !== lastShadowSnapX || sz !== lastShadowSnapZ) {
          lastShadowSnapX = sx;
          lastShadowSnapZ = sz;
          sunShadowLight.position.set(sx + currentSunOffsetX, currentSunOffsetY, sz + currentSunOffsetZ);
          sunShadowLight.target.position.set(sx, 0, sz);
          sunShadowLight.target.updateMatrixWorld();
          if (shadowCatcherMesh) shadowCatcherMesh.position.set(sx, 0.14, sz);
        }
      }

      tempProj.fromArray(projArray);
      camera.projectionMatrix.multiplyMatrices(tempProj, originMatrix);
      camera.projectionMatrixInverse.copy(camera.projectionMatrix).invert();

      glRenderer.setRenderTarget(null);
      glRenderer.setViewport(savedVp[0], savedVp[1], savedVp[2], savedVp[3]);
      glRenderer.resetState();
      glRenderer.render(scene, camera);

      gl.bindFramebuffer(gl.FRAMEBUFFER, savedFbo);
      gl.viewport(savedVp[0], savedVp[1], savedVp[2], savedVp[3]);
    }
  };

  function hideTooltip() {
    if (hoverTooltip) hoverTooltip.style.display = 'none';
    if (map && map.getCanvas()) map.getCanvas().style.cursor = '';
  }

  function setupInteractions() {
    if (!map) return;

    hoverTooltip = document.createElement('div');
    hoverTooltip.id = 'webgl-station-tooltip';
    hoverTooltip.style.cssText = [
      'position:fixed;display:none;pointer-events:none;z-index:9999;',
      'background:rgba(28,28,30,0.88);color:#F8FAFC;',
      'backdrop-filter:blur(16px) saturate(180%);-webkit-backdrop-filter:blur(16px) saturate(180%);',
      'padding:6px 12px;border-radius:999px;border:1px solid rgba(255,255,255,0.16);',
      'font-family:-apple-system,BlinkMacSystemFont,"SF Pro Text",Inter,sans-serif;font-size:12px;font-weight:600;',
      'letter-spacing:-0.01em;box-shadow:0 12px 28px rgba(15,23,42,0.28);white-space:nowrap;'
    ].join('');
    const hostEl = map.getContainer ? map.getContainer() : document.body;
    hostEl.appendChild(hoverTooltip);

    map.on('mousemove', (e) => {
      if (!isReady) return;
      const mapEl = document.getElementById('map');
      if (mapEl && mapEl.classList.contains('hidden')) {
        hideTooltip();
        return;
      }
      const hit = findStationUnderPointer(e.point);
      if (hit) {
        map.getCanvas().style.cursor = 'pointer';
        const kind = hit.structure === 'elevated' ? 'Elevated Viaduct (+17m)' : 'Underground Cutaway';
        const xBadge = hit.interchange ? ` · ${hit.interchange}` : '';
        const dotColor = (hit.lineId === 'blue') ? '#3B82F6' : '#FACC15';
        hoverTooltip.innerHTML = `<span style="color:${dotColor}">●</span> ${hit.name} <span style="color:#CBD5E1;font-weight:500">(${kind}${xBadge})</span>`;
        hoverTooltip.style.left = `${e.originalEvent.clientX + 14}px`;
        hoverTooltip.style.top = `${e.originalEvent.clientY - 14}px`;
        hoverTooltip.style.display = 'block';
      } else {
        hideTooltip();
      }
    });

    map.on('movestart', hideTooltip);
    map.on('dragstart', hideTooltip);
    map.on('zoomstart', hideTooltip);
    if (map.getCanvas()) {
      map.getCanvas().addEventListener('mouseleave', hideTooltip);
    }

    map.on('click', (e) => {
      if (!isReady) return;
      const hit = findStationUnderPointer(e.point);
      if (!hit) return;
      hideTooltip();
      selectedStationName = hit.name;
      flyToStation(hit.name);
      if (typeof window.openStationPanel === 'function') {
        window.openStationPanel(hit.name, true);
      }
    });
  }

  function findStationUnderPointer(point) {
    if (!map || !camera) return null;
    const stList = allStationsData.length ? allStationsData : stationsData;
    if (!stList.length) return null;
    const rect = map.getCanvas().getBoundingClientRect();
    const w = rect.width || map.getCanvas().clientWidth;
    const h = rect.height || map.getCanvas().clientHeight;
    let best = null;
    const zoom = map.getZoom();
    let minD = zoom >= 16 ? 58 : (zoom >= 13 ? 36 : 22);

    const tmp = new THREE.Vector3();
    for (let i = 0; i < stList.length; i++) {
      const st = stList[i];
      if (activeLineId !== 'all') {
        const isB = Boolean(st.isBlue || st.lineId === 'blue' || st.lineKey === 'blue' || (st.corridor && st.corridor.isBlue));
        if (activeLineId === 'blue' && !isB) continue;
        if (activeLineId === 'yellow' && isB) continue;
      }
      tmp.set(st.pos.x, st.structure === 'elevated' ? VIADUCT_Y + 3 : 2.5, st.pos.z);
      tmp.project(camera);
      if (tmp.z < -1 || tmp.z > 1) continue;
      const sx = (tmp.x * 0.5 + 0.5) * w;
      const sy = (-tmp.y * 0.5 + 0.5) * h;
      const d = Math.hypot(sx - point.x, sy - point.y);
      if (d < minD) {
        minD = d;
        best = st;
      }
    }
    return best;
  }

  function flyToStation(name) {
    if (!map) return;
    const key = normalizeStationName(name);
    const stList = allStationsData.length ? allStationsData : stationsData;
    const st = stList.find((s) => normalizeStationName(s.name) === key || s.id === name);
    if (!st) return;
    selectedStationName = st.name;
    if (st.corridor) {
      activeWalkCorridor = st.corridor;
    }
    cameraTrackDist = st.dist;
    cameraAnchorStationDist = st.dist;
    lastTrackAnchorTs = performance.now();
    const btn3D = document.getElementById('btn-3d-map-view');
    const btn2D = document.getElementById('btn-2d-map-view');
    if (btn3D && btn2D) {
      btn3D.classList.add('active');
      btn2D.classList.remove('active');
    }
    const locMap = {
      'samaypur badli': 'samaypur',
      'kashmere gate': 'kashmere',
      'rajiv chowk': 'rajiv',
      'green park': 'greenpark',
      'hauz khas': 'hauzkhas',
      'qutab minar': 'qutab',
      'millennium city centre': 'gurgaon',
      'dwarka sector 21': 'dwarka',
      'akshardham': 'akshardham',
      'noida electronic city': 'noida'
    };
    const matchLoc = locMap[normalizeStationName(st.name)];
    document.querySelectorAll('.bookmark-chip').forEach((chip) => {
      chip.classList.toggle('active', !!matchLoc && chip.getAttribute('data-loc') === matchLoc);
    });
    if (typeof window.syncStationStepper === 'function') {
      window.syncStationStepper(st.name);
    }
    if (st.coords) prewarmOvertureAtLngLat(st.coords[0], st.coords[1], true);

    const normName = normalizeStationName(st.name);
    if (normName === 'akshardham') {
      const akMon = monumentGroups.find((m) => m.name && m.name.toLowerCase().includes('akshardham'));
      if (akMon && !akMon.group && akMon.buildFn) ensureMonumentBuilt(akMon);
      map.flyTo({
        center: [77.2782, 28.6152],
        zoom: 16.3,
        pitch: 58,
        bearing: -42,
        duration: 950
      });
    } else if (normName === 'yamuna bank') {
      map.flyTo({
        center: st.coords,
        zoom: 16.8,
        pitch: 58,
        bearing: -32,
        duration: 950
      });
    } else {
      map.flyTo({
        center: st.coords,
        zoom: 18.25,
        pitch: 54,
        bearing: -22,
        duration: 950
      });
    }
  }

  function anchorTrackToStation(name) {
    const key = normalizeStationName(name);
    const stList = allStationsData.length ? allStationsData : stationsData;
    const st = stList.find((s) => normalizeStationName(s.name) === key || s.id === name);
    if (!st) return false;
    if (st.corridor) {
      activeWalkCorridor = st.corridor;
    }
    cameraTrackDist = st.dist;
    cameraAnchorStationDist = st.dist;
    lastTrackAnchorTs = performance.now();
    selectedStationName = st.name;
    return true;
  }

  function flyToRailwayHub(idOrName) {
    if (!map) return false;
    const key = String(idOrName || '').toLowerCase();
    const hub = INDIA_RAILWAY_HUBS.find((h) =>
      h.id === key ||
      h.code.toLowerCase() === key ||
      h.name.toLowerCase() === key ||
      (Array.isArray(h.aliases) && h.aliases.some((a) => a.toLowerCase() === key))
    );
    if (!hub) return false;
    const mon = monumentGroups.find((m) => m.name === `${hub.name} (${hub.code})` || m.name.toLowerCase().includes(hub.code.toLowerCase()));
    if (mon && !mon.group && mon.buildFn) ensureMonumentBuilt(mon);
    if (hub.coords) prewarmOvertureAtLngLat(hub.coords[0], hub.coords[1], true);
    let bearing = (hub.cam && hub.cam.bearing) !== undefined ? hub.cam.bearing : -20;
    if (!hub.cam && hub.p0 && hub.p1) {
      const cosLat = Math.cos(hub.coords[1] * Math.PI / 180);
      const dx = (hub.p1[0] - hub.p0[0]) * cosLat;
      const dy = (hub.p1[1] - hub.p0[1]);
      bearing = (Math.atan2(dx, dy) * 180 / Math.PI) + 26;
    }
    const defaultZoom = hub.tier === 'terminal' ? 16.5 : (hub.tier === 'major' ? 16.7 : 17.0);
    map.flyTo({
      center: hub.coords,
      zoom: (hub.cam && hub.cam.zoom) || defaultZoom,
      pitch: (hub.cam && hub.cam.pitch) || 54,
      bearing,
      duration: 950
    });
    return true;
  }

  function stepAlongTrack(deltaMeters = 100) {
    if (!map || !originMc) return null;
    const c = activeWalkCorridor || (activeLineId === 'blue' ? blueCorridor : yellowCorridor) || yellowCorridor;
    if (!c || !c.samples || !c.samples.length || c.totalLen <= 0) return null;
    const cSamples = c.samples;
    const cLen = c.totalLen;
    const cStations = c.stationsData;

    const centerMc = window.maplibregl.MercatorCoordinate.fromLngLat(map.getCenter(), 0);
    const cx = (centerMc.x - originMc.x) / meterUnit;
    const cz = (centerMc.y - originMc.y) / meterUnit;

    const curSmp = sampleAtDist(cameraTrackDist, c);
    const driftFromTracked = curSmp ? Math.hypot(curSmp.pos.x - cx, curSmp.pos.z - cz) : Infinity;
    const isAnimating = Boolean(map.isMoving && map.isMoving());
    if (driftFromTracked > 120 && !isAnimating && performance.now() - lastTrackAnchorTs > 1500) {
      let bestDist = 0;
      let minD2 = Infinity;
      for (let i = 0; i < cSamples.length; i++) {
        const sp = cSamples[i].pos;
        const d2 = (sp.x - cx) ** 2 + (sp.z - cz) ** 2;
        if (d2 < minD2) {
          minD2 = d2;
          bestDist = cSamples[i].dist;
        }
      }
      cameraTrackDist = bestDist;
      let nearSt = null;
      let minStD = Infinity;
      for (let i = 0; i < cStations.length; i++) {
        const sd = Math.abs(cStations[i].dist - bestDist);
        if (sd < minStD) {
          minStD = sd;
          nearSt = cStations[i];
        }
      }
      cameraAnchorStationDist = nearSt ? nearSt.dist : bestDist;
    }

    cameraTrackDist = Math.max(0, Math.min(cLen, cameraTrackDist + deltaMeters));
    lastTrackAnchorTs = performance.now();
    const smp = sampleAtDist(cameraTrackDist, c);
    if (!smp) return null;
    const lngLat = localMetersToLngLat(smp.pos);
    prewarmOvertureAtLngLat(lngLat[0], lngLat[1], true);
    map.easeTo({
      center: lngLat,
      zoom: Math.max(map.getZoom(), 18.2),
      pitch: Math.max(map.getPitch(), 48),
      duration: 260
    });
    return {
      distM: Math.round(cameraTrackDist),
      offsetM: Math.round(cameraTrackDist - cameraAnchorStationDist),
      coords: lngLat
    };
  }

  /* ───────────────────────────────────────────────────────────
   * 7. 24-Hour Atmospheric Solar Arc Engine & Underground X-Ray Mode
   * ─────────────────────────────────────────────────────────── */
  const ATMOS_KEYS = [
    {
      sec: 0,
      sky: [0.027, 0.051, 0.098], hor: [0.078, 0.133, 0.231], fog: [0.070, 0.118, 0.212],
      fogStart: 3.40, fogEnd: 9.20, shadowCol: [0.014, 0.020, 0.038],
      sunPos: [110, 240, 110], mapAz: 145, mapPol: 34, mapLightInt: 0.28,
      sunTint: [0.46, 0.56, 0.78], ambTint: [0.26, 0.34, 0.52], skyReflect: 0.34,
      shadowOff: [-0.45, -0.38], shadowH: 0.44, shadowA: 0.13, aoInt: 0.28,
      nightGlow: 0.96,
      bg: [13, 21, 36], park: [18, 36, 34], wood: [14, 29, 27], water: [10, 37, 64],
      waterBank: [30, 73, 112], roadMain: [39, 55, 79], roadSec: [30, 44, 66], roadCase: [9, 16, 28],
      bldg2d: [25, 36, 56],
      hemiSky: [72, 98, 148], hemiGnd: [18, 28, 46], hemiInt: 0.26,
      sunCol: [148, 178, 232], sunInt: 0.28, fillCol: [56, 84, 130], fillInt: 0.14, exposure: 0.98
    },
    {
      sec: 14400,
      sky: [0.039, 0.067, 0.125], hor: [0.106, 0.172, 0.294], fog: [0.094, 0.149, 0.258],
      fogStart: 3.40, fogEnd: 9.20, shadowCol: [0.014, 0.020, 0.038],
      sunPos: [155, 195, 30], mapAz: 112, mapPol: 46, mapLightInt: 0.28,
      sunTint: [0.50, 0.60, 0.80], ambTint: [0.28, 0.36, 0.54], skyReflect: 0.36,
      shadowOff: [-0.56, -0.14], shadowH: 0.46, shadowA: 0.14, aoInt: 0.28,
      nightGlow: 0.88,
      bg: [18, 28, 46], park: [23, 44, 41], wood: [18, 35, 32], water: [15, 45, 76],
      waterBank: [36, 84, 128], roadMain: [48, 65, 92], roadSec: [37, 52, 76], roadCase: [12, 20, 34],
      bldg2d: [31, 43, 66],
      hemiSky: [84, 110, 162], hemiGnd: [22, 32, 52], hemiInt: 0.26,
      sunCol: [164, 190, 238], sunInt: 0.29, fillCol: [66, 94, 140], fillInt: 0.14, exposure: 0.99
    },
    {
      sec: 19800, // 05:30 AM First Metro Dawn
      sky: [0.333, 0.463, 0.659], hor: [0.949, 0.788, 0.659], fog: [0.918, 0.824, 0.745],
      fogStart: 3.55, fogEnd: 9.60, shadowCol: [0.052, 0.064, 0.105],
      sunPos: [220, 125, -45], mapAz: 82, mapPol: 68, mapLightInt: 0.36,
      sunTint: [1.08, 0.91, 0.78], ambTint: [0.68, 0.76, 0.92], skyReflect: 0.68,
      shadowOff: [-0.90, 0.18], shadowH: 0.72, shadowA: 0.22, aoInt: 0.34,
      nightGlow: 0.28,
      bg: [223, 217, 206], park: [144, 188, 128], wood: [122, 168, 108], water: [90, 163, 212],
      waterBank: [152, 198, 224], roadMain: [225, 194, 134], roadSec: [234, 228, 218], roadCase: [182, 170, 152],
      bldg2d: [204, 196, 182],
      hemiSky: [198, 212, 238], hemiGnd: [148, 138, 128], hemiInt: 0.28,
      sunCol: [255, 216, 174], sunInt: 0.56, fillCol: [142, 172, 216], fillInt: 0.16, exposure: 1.04
    },
    {
      sec: 25200, // 07:00 Early Morning Sun
      sky: [0.463, 0.718, 0.878], hor: [0.953, 0.918, 0.863], fog: [0.925, 0.894, 0.847],
      fogStart: 3.75, fogEnd: 10.20, shadowCol: [0.085, 0.102, 0.145],
      sunPos: [200, 210, 50], mapAz: 108, mapPol: 46, mapLightInt: 0.40,
      sunTint: [1.05, 0.99, 0.92], ambTint: [0.76, 0.82, 0.92], skyReflect: 0.76,
      shadowOff: [-0.76, -0.18], shadowH: 0.56, shadowA: 0.24, aoInt: 0.36,
      nightGlow: 0.0,
      bg: [239, 233, 221], park: [174, 214, 150], wood: [150, 196, 124], water: [112, 188, 232],
      waterBank: [178, 215, 236], roadMain: [242, 214, 138], roadSec: [252, 250, 244], roadCase: [198, 184, 156],
      bldg2d: [220, 212, 198],
      hemiSky: [242, 246, 252], hemiGnd: [148, 158, 172], hemiInt: 0.26,
      sunCol: [255, 246, 224], sunInt: 0.62, fillCol: [178, 222, 248], fillInt: 0.13, exposure: 1.05
    },
    {
      sec: 33300, // 09:15 AM Peak Daylight (Signature Crisp Limestone)
      sky: [0.529, 0.769, 0.910], hor: [0.953, 0.937, 0.902], fog: [0.922, 0.902, 0.855],
      fogStart: 3.85, fogEnd: 10.50, shadowCol: [0.090, 0.110, 0.150],
      sunPos: [180, 265, 140], mapAz: 138, mapPol: 30, mapLightInt: 0.40,
      sunTint: [1.03, 1.01, 0.97], ambTint: [0.78, 0.84, 0.92], skyReflect: 0.78,
      shadowOff: [-0.62, -0.48], shadowH: 0.48, shadowA: 0.24, aoInt: 0.36,
      nightGlow: 0.0,
      bg: [242, 237, 226], park: [179, 218, 154], wood: [155, 201, 128], water: [118, 192, 234],
      waterBank: [182, 217, 238], roadMain: [244, 218, 142], roadSec: [255, 253, 247], roadCase: [201, 185, 155],
      bldg2d: [223, 216, 201],
      hemiSky: [248, 250, 252], hemiGnd: [148, 163, 184], hemiInt: 0.24,
      sunCol: [255, 251, 235], sunInt: 0.62, fillCol: [186, 230, 253], fillInt: 0.12, exposure: 1.06
    },
    {
      sec: 57600, // 16:00 Warm Afternoon
      sky: [0.502, 0.745, 0.894], hor: [0.957, 0.925, 0.878], fog: [0.925, 0.894, 0.835],
      fogStart: 3.75, fogEnd: 10.20, shadowCol: [0.088, 0.106, 0.148],
      sunPos: [18, 270, 178], mapAz: 186, mapPol: 34, mapLightInt: 0.42,
      sunTint: [1.05, 0.99, 0.91], ambTint: [0.76, 0.82, 0.91], skyReflect: 0.76,
      shadowOff: [-0.08, -0.60], shadowH: 0.50, shadowA: 0.24, aoInt: 0.36,
      nightGlow: 0.0,
      bg: [241, 235, 222], park: [176, 214, 150], wood: [152, 196, 124], water: [114, 188, 230],
      waterBank: [180, 214, 235], roadMain: [242, 214, 136], roadSec: [253, 250, 242], roadCase: [198, 182, 150],
      bldg2d: [222, 214, 198],
      hemiSky: [246, 248, 250], hemiGnd: [150, 160, 178], hemiInt: 0.24,
      sunCol: [255, 246, 220], sunInt: 0.64, fillCol: [180, 220, 248], fillInt: 0.13, exposure: 1.06
    },
    {
      sec: 65400, // 18:10 Golden Sunset Dusk
      sky: [0.275, 0.357, 0.549], hor: [0.900, 0.720, 0.610], fog: [0.850, 0.720, 0.650],
      fogStart: 3.55, fogEnd: 9.60, shadowCol: [0.045, 0.052, 0.092],
      sunPos: [-225, 118, 95], mapAz: 248, mapPol: 66, mapLightInt: 0.44,
      sunTint: [1.07, 0.91, 0.77], ambTint: [0.64, 0.71, 0.88], skyReflect: 0.65,
      shadowOff: [0.95, -0.38], shadowH: 0.72, shadowA: 0.24, aoInt: 0.36,
      nightGlow: 0.36,
      bg: [213, 200, 188], park: [132, 166, 110], wood: [112, 147, 94], water: [86, 138, 182],
      waterBank: [138, 174, 202], roadMain: [204, 170, 118], roadSec: [221, 211, 197], roadCase: [158, 143, 126],
      bldg2d: [194, 180, 168],
      hemiSky: [184, 176, 212], hemiGnd: [122, 108, 102], hemiInt: 0.28,
      sunCol: [255, 196, 132], sunInt: 0.66, fillCol: [124, 146, 196], fillInt: 0.16, exposure: 1.06
    },
    {
      sec: 69600, // 19:20 Deep Blue Hour
      sky: [0.086, 0.149, 0.278], hor: [0.196, 0.286, 0.439], fog: [0.161, 0.239, 0.376],
      fogStart: 3.40, fogEnd: 9.20, shadowCol: [0.032, 0.044, 0.078],
      sunPos: [-160, 175, 120], mapAz: 255, mapPol: 56, mapLightInt: 0.34,
      sunTint: [0.62, 0.68, 0.90], ambTint: [0.36, 0.44, 0.64], skyReflect: 0.45,
      shadowOff: [0.58, -0.35], shadowH: 0.52, shadowA: 0.17, aoInt: 0.30,
      nightGlow: 0.88,
      bg: [30, 41, 62], park: [30, 56, 52], wood: [23, 46, 42], water: [20, 54, 90],
      waterBank: [46, 94, 138], roadMain: [62, 79, 108], roadSec: [47, 62, 88], roadCase: [20, 29, 46],
      bldg2d: [42, 54, 78],
      hemiSky: [108, 134, 188], hemiGnd: [30, 42, 68], hemiInt: 0.24,
      sunCol: [168, 186, 238], sunInt: 0.36, fillCol: [78, 108, 162], fillInt: 0.15, exposure: 1.02
    },
    {
      sec: 75600, // 21:00 Crisp Night
      sky: [0.027, 0.051, 0.098], hor: [0.078, 0.133, 0.231], fog: [0.070, 0.118, 0.212],
      fogStart: 3.40, fogEnd: 9.20, shadowCol: [0.014, 0.020, 0.038],
      sunPos: [110, 240, 110], mapAz: 145, mapPol: 34, mapLightInt: 0.28,
      sunTint: [0.46, 0.56, 0.78], ambTint: [0.26, 0.34, 0.52], skyReflect: 0.34,
      shadowOff: [-0.45, -0.38], shadowH: 0.44, shadowA: 0.13, aoInt: 0.28,
      nightGlow: 0.96,
      bg: [13, 21, 36], park: [18, 36, 34], wood: [14, 29, 27], water: [10, 37, 64],
      waterBank: [30, 73, 112], roadMain: [39, 55, 79], roadSec: [30, 44, 66], roadCase: [9, 16, 28],
      bldg2d: [25, 36, 56],
      hemiSky: [72, 98, 148], hemiGnd: [18, 28, 46], hemiInt: 0.26,
      sunCol: [148, 178, 232], sunInt: 0.28, fillCol: [56, 84, 130], fillInt: 0.14, exposure: 0.98
    },
    {
      sec: 86400, // 24:00 Wrap
      sky: [0.027, 0.051, 0.098], hor: [0.078, 0.133, 0.231], fog: [0.070, 0.118, 0.212],
      fogStart: 3.40, fogEnd: 9.20, shadowCol: [0.014, 0.020, 0.038],
      sunPos: [110, 240, 110], mapAz: 145, mapPol: 34, mapLightInt: 0.28,
      sunTint: [0.46, 0.56, 0.78], ambTint: [0.26, 0.34, 0.52], skyReflect: 0.34,
      shadowOff: [-0.45, -0.38], shadowH: 0.44, shadowA: 0.13, aoInt: 0.28,
      nightGlow: 0.96,
      bg: [13, 21, 36], park: [18, 36, 34], wood: [14, 29, 27], water: [10, 37, 64],
      waterBank: [30, 73, 112], roadMain: [39, 55, 79], roadSec: [30, 44, 66], roadCase: [9, 16, 28],
      bldg2d: [25, 36, 56],
      hemiSky: [72, 98, 148], hemiGnd: [18, 28, 46], hemiInt: 0.26,
      sunCol: [148, 178, 232], sunInt: 0.28, fillCol: [56, 84, 130], fillInt: 0.14, exposure: 0.98
    }
  ];

  function lerpV(a, b, t) {
    return a + (b - a) * t;
  }

  function lerpArr(a, b, t) {
    return [lerpV(a[0], b[0], t), lerpV(a[1], b[1], t), lerpV(a[2], b[2], t)];
  }

  function unitRgbToHex(rgb) {
    const r = Math.max(0, Math.min(255, Math.round(rgb[0] * 255)));
    const g = Math.max(0, Math.min(255, Math.round(rgb[1] * 255)));
    const b = Math.max(0, Math.min(255, Math.round(rgb[2] * 255)));
    return `rgb(${r}, ${g}, ${b})`;
  }

  function byteRgbToCss(rgb) {
    return `rgb(${Math.round(rgb[0])}, ${Math.round(rgb[1])}, ${Math.round(rgb[2])})`;
  }

  function byteRgbToInt(rgb) {
    return ((Math.round(rgb[0]) & 255) << 16) | ((Math.round(rgb[1]) & 255) << 8) | (Math.round(rgb[2]) & 255);
  }

  function computeAtmosphere(rawSec) {
    const sec = ((rawSec % 86400) + 86400) % 86400;
    let k0 = ATMOS_KEYS[0];
    let k1 = ATMOS_KEYS[ATMOS_KEYS.length - 1];
    for (let i = 0; i < ATMOS_KEYS.length - 1; i++) {
      if (sec >= ATMOS_KEYS[i].sec && sec <= ATMOS_KEYS[i + 1].sec) {
        k0 = ATMOS_KEYS[i];
        k1 = ATMOS_KEYS[i + 1];
        break;
      }
    }
    const span = Math.max(1, k1.sec - k0.sec);
    const t = Math.max(0, Math.min(1, (sec - k0.sec) / span));
    return {
      sec,
      sky: lerpArr(k0.sky, k1.sky, t),
      hor: lerpArr(k0.hor, k1.hor, t),
      fog: lerpArr(k0.fog, k1.fog, t),
      fogStart: lerpV(k0.fogStart, k1.fogStart, t),
      fogEnd: lerpV(k0.fogEnd, k1.fogEnd, t),
      shadowCol: lerpArr(k0.shadowCol, k1.shadowCol, t),
      sunPos: lerpArr(k0.sunPos, k1.sunPos, t),
      mapAz: lerpV(k0.mapAz, k1.mapAz, t),
      mapPol: lerpV(k0.mapPol, k1.mapPol, t),
      mapLightInt: lerpV(k0.mapLightInt, k1.mapLightInt, t),
      sunTint: lerpArr(k0.sunTint, k1.sunTint, t),
      ambTint: lerpArr(k0.ambTint, k1.ambTint, t),
      skyReflect: lerpV(k0.skyReflect, k1.skyReflect, t),
      shadowOff: [lerpV(k0.shadowOff[0], k1.shadowOff[0], t), lerpV(k0.shadowOff[1], k1.shadowOff[1], t)],
      shadowH: lerpV(k0.shadowH, k1.shadowH, t),
      shadowA: lerpV(k0.shadowA, k1.shadowA, t),
      aoInt: lerpV(k0.aoInt, k1.aoInt, t),
      nightGlow: lerpV(k0.nightGlow, k1.nightGlow, t),
      bg: lerpArr(k0.bg, k1.bg, t),
      park: lerpArr(k0.park, k1.park, t),
      wood: lerpArr(k0.wood, k1.wood, t),
      water: lerpArr(k0.water, k1.water, t),
      waterBank: lerpArr(k0.waterBank, k1.waterBank, t),
      roadMain: lerpArr(k0.roadMain, k1.roadMain, t),
      roadSec: lerpArr(k0.roadSec, k1.roadSec, t),
      roadCase: lerpArr(k0.roadCase, k1.roadCase, t),
      bldg2d: lerpArr(k0.bldg2d, k1.bldg2d, t),
      hemiSky: lerpArr(k0.hemiSky, k1.hemiSky, t),
      hemiGnd: lerpArr(k0.hemiGnd, k1.hemiGnd, t),
      hemiInt: lerpV(k0.hemiInt, k1.hemiInt, t),
      sunCol: lerpArr(k0.sunCol, k1.sunCol, t),
      sunInt: lerpV(k0.sunInt, k1.sunInt, t),
      fillCol: lerpArr(k0.fillCol, k1.fillCol, t),
      fillInt: lerpV(k0.fillInt, k1.fillInt, t),
      exposure: lerpV(k0.exposure, k1.exposure, t)
    };
  }

  /* ───────────────────────────────────────────────────────────
   * 8. Photographic Delhi Monument Medallions & Spotlight Card
   * ─────────────────────────────────────────────────────────── */
  function closeMonumentSpotlight() {
    selectedMonumentId = null;
    const card = document.getElementById('monument-spotlight-card');
    if (card) card.classList.add('hidden');
    for (let i = 0; i < monumentMarkers.length; i++) {
      monumentMarkers[i].el.classList.remove('active');
    }
  }

  function openMonumentSpotlight(mon) {
    if (!mon) return;
    selectedMonumentId = mon.id;
    const stPanel = document.getElementById('station-panel');
    if (stPanel) stPanel.classList.add('hidden');

    const card = document.getElementById('monument-spotlight-card');
    if (!card) return;
    const imgEl = document.getElementById('monument-spotlight-img');
    const titleEl = document.getElementById('monument-title');
    const eraEl = document.getElementById('monument-era');
    const descEl = document.getElementById('monument-spotlight-desc');
    const flyBtn = document.getElementById('btn-monument-fly-station');

    const nearList = getNearestStationsForLngLat(mon.coords, 2);
    const primaryNear = nearList[0] ? nearList[0].station.name : mon.station;
    const fmtD = (m) => (m >= 1000 ? `${(m / 1000).toFixed(1)} km` : `${m} m`);
    const nearNote = nearList.length
      ? ` Nearest Metro: ${nearList.map((n) => `${n.station.name} (${fmtD(n.distanceM)})`).join(' · ')}.`
      : '';

    if (imgEl) {
      imgEl.src = mon.img;
      imgEl.alt = mon.name;
    }
    if (titleEl) titleEl.textContent = mon.name;
    if (eraEl) eraEl.textContent = mon.era;
    if (descEl) descEl.textContent = `${mon.desc}${nearNote}`;
    if (flyBtn) {
      const distSuffix = nearList[0] ? ` (${fmtD(nearList[0].distanceM)})` : '';
      flyBtn.textContent = `🚇 Fly to ${primaryNear}${distSuffix} ➔`;
      flyBtn.onclick = () => {
        const targetStation = primaryNear;
        closeMonumentSpotlight();
        flyToStation(targetStation);
        if (typeof window.openStationPanel === 'function') {
          window.openStationPanel(targetStation, true);
        }
      };
    }

    const isDark = currentNightGlow >= 0.62;
    card.classList.toggle('dark-hud', isDark);
    card.classList.remove('hidden');

    for (let i = 0; i < monumentMarkers.length; i++) {
      const mItem = monumentMarkers[i];
      mItem.el.classList.toggle('active', mItem.mon.id === mon.id);
    }
  }

  function flyToMonument(idOrName) {
    if (!map) return false;
    const key = String(idOrName || '').toLowerCase();
    const mon = DELHI_MONUMENTS.find((m) => m.id === key || m.name.toLowerCase() === key);
    if (!mon) return false;
    const btn3D = document.getElementById('btn-3d-map-view');
    const btn2D = document.getElementById('btn-2d-map-view');
    if (btn3D && btn2D) {
      btn3D.classList.add('active');
      btn2D.classList.remove('active');
    }
    openMonumentSpotlight(mon);
    if (mon.coords) prewarmOvertureAtLngLat(mon.coords[0], mon.coords[1], true);
    map.flyTo({
      center: mon.coords,
      zoom: (mon.cam && mon.cam.zoom) || 17.2,
      pitch: (mon.cam && mon.cam.pitch) || 56,
      bearing: (mon.cam && mon.cam.bearing) || -28,
      duration: 950
    });
    return true;
  }

  function syncMonumentMarkersVisibility() {
    if (!monumentMarkers.length) return;
    const mapEl = document.getElementById('map');
    const isMapVisible = !mapEl || !mapEl.classList.contains('hidden');
    const z = map ? map.getZoom() : 14;
    const pitch = map ? map.getPitch() : 45;
    const compactMode = z < 11.4;
    const isDark = currentNightGlow >= 0.62;
    const vw = window.innerWidth || 1440;
    const vh = window.innerHeight || 900;

    for (let i = 0; i < monumentMarkers.length; i++) {
      const item = monumentMarkers[i];
      const minZ = item.mon.tier === 1 ? 9.6 : (item.mon.tier === 2 ? 11.4 : 12.6);
      let show = isMapVisible && z >= minZ;
      if (show && map) {
        const pt = map.project(item.mon.coords);
        if (pt.x < -36 || pt.x > vw + 36 || pt.y < 122 || pt.y > vh - 126) {
          show = false;
        } else if (pitch > 48 && pt.y < 160 && z > 12.8) {
          show = false;
        }
      }
      item.el.style.display = show ? 'flex' : 'none';
      item.el.classList.toggle('compact-pin', compactMode);
      item.el.classList.toggle('dark-hud', isDark);
      item.el.classList.toggle('active', selectedMonumentId === item.mon.id);
      if (item.mon.has3d && item.marker && typeof item.marker.setOffset === 'function') {
        item.marker.setOffset(z >= 14.5 ? [0, -34] : [0, -4]);
      }
    }

    for (let i = 0; i < majorStationMarkers.length; i++) {
      const sItem = majorStationMarkers[i];
      let show = isMapVisible && z >= 11.4;
      if (show && map) {
        const pt = map.project(sItem.st.coords);
        if (pt.x < -40 || pt.x > vw + 40 || pt.y < 126 || pt.y > vh - 126) {
          show = false;
        } else if (pitch > 48 && pt.y < 166 && z > 12.8) {
          show = false;
        }
      }
      sItem.el.style.display = show ? 'inline-flex' : 'none';
      sItem.el.classList.toggle('dark-hud', isDark);
      sItem.el.classList.toggle('active', selectedStationName === sItem.st.name);
      if (sItem.marker && typeof sItem.marker.setOffset === 'function') {
        sItem.marker.setOffset(z >= 14.5 && sItem.st.structure === 'elevated' ? [0, -34] : [0, -8]);
      }
    }

    for (let i = 0; i < railHubMarkers.length; i++) {
      const rItem = railHubMarkers[i];
      const tier = rItem.hub.tier || 'terminal';
      const minZ = tier === 'terminal' ? 12.4 : (tier === 'major' ? 13.4 : 14.2);
      let show = isMapVisible && z >= minZ;
      if (show && map) {
        const pt = map.project(rItem.hub.coords);
        if (pt.x < -40 || pt.x > vw + 40 || pt.y < 126 || pt.y > vh - 126) {
          show = false;
        } else if (pitch > 48 && pt.y < 166) {
          show = false;
        }
      }
      rItem.el.style.display = show ? 'inline-flex' : 'none';
      rItem.el.classList.toggle('dark-hud', isDark);
    }
  }

  function initMonumentMarkers() {
    if (!map || !window.maplibregl) return;

    if (!monumentMarkersInitialized) {
      monumentMarkersInitialized = true;
      const closeBtn = document.getElementById('close-monument-spotlight');
      if (closeBtn) {
        closeBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          closeMonumentSpotlight();
        });
      }

      DELHI_MONUMENTS.forEach((mon) => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = mon.featured ? 'monument-pin featured-pin' : 'monument-pin';
        btn.setAttribute('data-monument-id', mon.id);
        btn.setAttribute('aria-label', `${mon.name} (${mon.era})`);
        const near = getNearestStationsForLngLat(mon.coords, 1)[0];
        const nearName = near ? near.station.name : mon.station;
        const nearDist = near ? (near.distanceM >= 1000 ? `${(near.distanceM / 1000).toFixed(1)}km` : `${near.distanceM}m`) : '';
        const nearHtml = nearName ? `<span class="monument-pin-near">🚇 ${nearName}${nearDist ? ` · ${nearDist}` : ''}</span>` : '';
        btn.innerHTML = [
          `<span class="monument-pin-frame"><img class="monument-pin-img" src="${mon.img}" alt="${mon.name}" decoding="async" /></span>`,
          `<span class="monument-pin-stem" aria-hidden="true"></span>`,
          `<span class="monument-pin-label"><span>${mon.name}</span>${nearHtml}</span>`
        ].join('');

        btn.addEventListener('click', (e) => {
          e.stopPropagation();
          hideTooltip();
          flyToMonument(mon.id);
        });

        const marker = new window.maplibregl.Marker({
          element: btn,
          anchor: 'bottom',
          offset: [0, -4]
        })
          .setLngLat(mon.coords)
          .addTo(map);

        monumentMarkers.push({ mon, marker, el: btn });
      });
    }

    if (!majorStationMarkersInitialized && stationsData.length) {
      majorStationMarkersInitialized = true;
      stationsData.forEach((st) => {
        if (!st.major || !st.coords) return;
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'major-station-pill';
        btn.setAttribute('data-station-name', st.name);
        const tag = st.terminus ? 'TERMINUS' : (st._isSharedDualHub ? 'YELLOW × BLUE HUB' : (st.structure === 'elevated' ? '+15m' : `${st.elevM || -16}m TUBE`));
        btn.innerHTML = `<span class="major-station-dot" aria-hidden="true"></span><span>${st.name}</span><span class="major-station-meta">${tag}</span>`;
        btn.addEventListener('click', (e) => {
          e.stopPropagation();
          hideTooltip();
          flyToStation(st.name);
          if (typeof window.openStationPanel === 'function') {
            window.openStationPanel(st.name, true);
          }
        });
        const marker = new window.maplibregl.Marker({
          element: btn,
          anchor: 'bottom',
          offset: [0, -8]
        })
          .setLngLat(st.coords)
          .addTo(map);
        majorStationMarkers.push({ st, marker, el: btn });
      });

      INDIA_RAILWAY_HUBS.forEach((hub) => {
        const rBtn = document.createElement('button');
        rBtn.type = 'button';
        rBtn.className = 'railway-hub-pill';
        rBtn.setAttribute('data-rail-hub-id', hub.id);
        rBtn.innerHTML = `<span aria-hidden="true">🚉</span><span>${hub.name}</span><span class="railway-hub-code">${hub.code}</span>`;
        rBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          hideTooltip();
          flyToRailwayHub(hub.id);
        });
        const rMarker = new window.maplibregl.Marker({
          element: rBtn,
          anchor: 'bottom',
          offset: [0, -14]
        })
          .setLngLat(hub.coords)
          .addTo(map);
        railHubMarkers.push({ hub, marker: rMarker, el: rBtn });
      });
    }

    if (!map.__monumentSyncAttached) {
      map.__monumentSyncAttached = true;
      map.on('zoom', syncMonumentMarkersVisibility);
      map.on('move', syncMonumentMarkersVisibility);
    }
    syncMonumentMarkersVisibility();
  }

  function syncHudTheme() {
    const mapEl = document.getElementById('map');
    const isMapVisible = !mapEl || !mapEl.classList.contains('hidden');
    syncMonumentMarkersVisibility();
    if (!isMapVisible) return;
    const isDark = currentNightGlow >= 0.62;
    [
      document.querySelector('.master-mode-strip'),
      document.getElementById('map-perspective-pill'),
      document.getElementById('station-search-container'),
      document.getElementById('station-stepper-pill'),
      document.querySelector('.timetable-dock'),
      document.querySelector('.maplibregl-ctrl-top-right'),
      document.getElementById('monument-spotlight-card'),
      document.getElementById('station-panel'),
      document.getElementById('inspector-card')
    ].forEach((el) => {
      if (el) el.classList.toggle('dark-hud', isDark);
    });
  }

  function applyAtmosphere(rawSec, forceMapUpdate) {
    const atm = computeAtmosphere(rawSec);
    currentSecOfDay = atm.sec;
    currentNightGlow = atm.nightGlow;
    currentShadowAlpha = atm.shadowA;

    const prevOffX = currentSunOffsetX;
    const prevOffY = currentSunOffsetY;
    const prevOffZ = currentSunOffsetZ;
    currentSunOffsetX = atm.sunPos[0];
    currentSunOffsetY = atm.sunPos[1];
    currentSunOffsetZ = atm.sunPos[2];

    if (sunShadowLight) {
      sunShadowLight.color.setHex(byteRgbToInt(atm.sunCol));
      sunShadowLight.intensity = atm.sunInt;
      if (
        Math.abs(prevOffX - currentSunOffsetX) > 4 ||
        Math.abs(prevOffY - currentSunOffsetY) > 4 ||
        Math.abs(prevOffZ - currentSunOffsetZ) > 4
      ) {
        lastShadowSnapX = Infinity; // re-snap directional shadow frustum cleanly on next render
      }
    }
    if (hemiLight) {
      hemiLight.color.setHex(byteRgbToInt(atm.hemiSky));
      hemiLight.groundColor.setHex(byteRgbToInt(atm.hemiGnd));
      hemiLight.intensity = atm.hemiInt;
    }
    if (fillLight) {
      fillLight.color.setHex(byteRgbToInt(atm.fillCol));
      fillLight.intensity = atm.fillInt;
    }
    if (glRenderer) {
      glRenderer.toneMappingExposure = atm.exposure;
    }

    if (matLib) {
      const nT = Math.max(0, Math.min(1, atm.nightGlow * 0.88));
      const envScale = 1.0 - nT * 0.72;
      const tintMat = (mat, dayHex, nightHex, dayEnv) => {
        if (!mat) return;
        mat.color.copy(_tmpColA.setHex(dayHex).lerp(_tmpColB.setHex(nightHex), nT));
        if (dayEnv != null) mat.envMapIntensity = dayEnv * envScale;
      };
      tintMat(matLib.concreteLight, 0xDED9CE, 0x3D485C, 0.22);
      tintMat(matLib.concreteWeb, 0xC2BCB0, 0x2F384A, 0.22);
      tintMat(matLib.pierCream, 0xD8D2C5, 0x3A4457, 0.22);
      tintMat(matLib.terrazzoDeck, 0xEAE5D9, 0x455064, 0.22);
      tintMat(matLib.trenchFloor, 0xCBD5E1, 0x333D4F, 0.22);
      tintMat(matLib.plazaPave, 0xD2C9B8, 0x2B3445, 0.22);
      tintMat(matLib.sagePark, 0xADD096, 0x1E3631, 0.22);
      tintMat(matLib.crosswalkWhite, 0xF8FAFC, 0x525F74, 0.22);
      tintMat(matLib.dmrcBlueRoof, 0x0284C7, 0x0A4A70, 0.36);
      tintMat(matLib.redRoof, 0xB9382E, 0x542220, 0.28);
      tintMat(matLib.sandstoneBuff, 0xE2CCB0, 0x524840, 0.18);
      tintMat(matLib.qutabRedStone, 0xB85C3C, 0x4B2B25, 0.16);
      tintMat(matLib.brickRed, 0xA44A3F, 0x442524, 0.16);
      tintMat(matLib.lutyensCream, 0xF3EAD8, 0x4D5463, 0.20);
      tintMat(matLib.terracotta, 0xC96F4B, 0x4E322B, 0.18);
      tintMat(matLib.whiteMarble, 0xF7F5EE, 0x4F596B, 0.28);
      tintMat(matLib.ballastSleeper, 0xFFFFFF, 0x5A6475, 0.22);
      tintMat(matLib.tileWall, 0xFFFFFF, 0x626E82, 0.22);
      tintMat(matLib.treeFoliage, 0x588A4F, 0x1A332C, 0.15);
      tintMat(matLib.treeFoliageAlt, 0x6B9D5E, 0x203D34, 0.15);
      tintMat(matLib.treeFoliageDeep, 0x497A44, 0x162C26, 0.15);
      tintMat(matLib.treeFoliageMid, 0x5C8F52, 0x1B362E, 0.15);
      tintMat(matLib.treeFoliageBright, 0x70A362, 0x224137, 0.15);
      tintMat(matLib.treeFoliageAshok, 0x376636, 0x142822, 0.14);
      if (matLib.skylightGlass) {
        matLib.skylightGlass.color.copy(_tmpColA.setHex(0xBAE6FD).lerp(_tmpColB.setHex(0x2B4C6E), nT));
      }
    }

    if (trainBeamMat) {
      trainBeamMat.opacity = Math.max(0, Math.min(0.76, atm.nightGlow * 0.76));
      trainBeamMat.visible = atm.nightGlow > 0.03;
    }
    if (window.MetroKit && window.MetroKit.Materials) {
      const wm = window.MetroKit.Materials.windowMaterials;
      if (wm) {
        const winGlow = 0.14 + atm.nightGlow * 0.86;
        for (let i = 0; i < wm.length; i++) wm[i].emissiveIntensity = winGlow;
      }
      const hm = window.MetroKit.Materials.headlightMaterials;
      if (hm) {
        const hlCol = atm.nightGlow > 0.45 ? 0xFFFDE0 : 0xFEF08A;
        for (let i = 0; i < hm.length; i++) hm[i].color.setHex(hlCol);
      }
    }

    if (wallShadowLayer) {
      wallShadowLayer.setEnvironment({
        shadowOffset: atm.shadowOff,
        heightScale: atm.shadowH,
        shadowAlpha: undergroundXRay ? 0.08 : atm.shadowA,
        aoIntensity: undergroundXRay ? 0.16 : atm.aoInt,
        shadowColor: atm.shadowCol,
        fogColor: atm.fog,
        fogStart: atm.fogStart,
        fogEnd: atm.fogEnd,
        nightGlow: atm.nightGlow,
        opacity: undergroundXRay ? 0.24 : 1.0,
        sunTint: atm.sunTint,
        ambTint: atm.ambTint,
        skyReflect: atm.skyReflect
      });
    }

    const nowTs = performance.now();
    const shouldSyncMap = !!map && map.getStyle() && (
      forceMapUpdate ||
      (Math.abs(atm.sec - lastAtmosMapSec) >= 180 && nowTs - lastAtmosMapTs >= 55)
    );

    if (shouldSyncMap) {
      lastAtmosMapSec = atm.sec;
      lastAtmosMapTs = nowTs;
      try {
        map.setLight({
          anchor: 'map',
          color: byteRgbToCss(atm.sunCol),
          intensity: atm.mapLightInt,
          position: [1.15, atm.mapAz, atm.mapPol]
        });
        if (typeof map.setSky === 'function') {
          map.setSky({
            'sky-color': unitRgbToHex(atm.sky),
            'sky-horizon-blend': 0.45,
            'horizon-color': unitRgbToHex(atm.hor),
            'horizon-fog-blend': 0.36,
            'fog-color': unitRgbToHex(atm.fog),
            'fog-ground-blend': 0.14
          });
        }
        if (map.getLayer('background')) map.setPaintProperty('background', 'background-color', byteRgbToCss(atm.bg));
        if (map.getLayer('landuse_residential')) map.setPaintProperty('landuse_residential', 'fill-color', byteRgbToCss(atm.bg));
        const dKeep = 1.0 - Math.min(1.0, atm.nightGlow * 0.90);
        const tintBg = (dayRgb) => byteRgbToCss([
          Math.round(atm.bg[0] + (dayRgb[0] - atm.bg[0]) * dKeep * 0.45),
          Math.round(atm.bg[1] + (dayRgb[1] - atm.bg[1]) * dKeep * 0.45),
          Math.round(atm.bg[2] + (dayRgb[2] - atm.bg[2]) * dKeep * 0.45)
        ]);
        const tintPark = (dayRgb) => byteRgbToCss([
          Math.round(atm.park[0] + (dayRgb[0] - atm.park[0]) * dKeep * 0.45),
          Math.round(atm.park[1] + (dayRgb[1] - atm.park[1]) * dKeep * 0.45),
          Math.round(atm.park[2] + (dayRgb[2] - atm.park[2]) * dKeep * 0.45)
        ]);
        if (map.getLayer('landuse_school')) map.setPaintProperty('landuse_school', 'fill-color', tintBg([236, 229, 213]));
        if (map.getLayer('landuse_hospital')) map.setPaintProperty('landuse_hospital', 'fill-color', tintBg([242, 226, 223]));
        if (map.getLayer('landuse_track')) map.setPaintProperty('landuse_track', 'fill-color', tintBg([222, 208, 183]));
        if (map.getLayer('landcover_sand')) map.setPaintProperty('landcover_sand', 'fill-color', tintBg([238, 230, 198]));
        if (map.getLayer('aeroway_fill')) map.setPaintProperty('aeroway_fill', 'fill-color', tintBg([224, 223, 218]));
        if (map.getLayer('landuse_cemetery')) map.setPaintProperty('landuse_cemetery', 'fill-color', tintPark([206, 224, 195]));
        if (map.getLayer('road_area_pattern')) {
          map.setPaintProperty('road_area_pattern', 'fill-opacity', Math.max(0.18, 0.78 - atm.nightGlow * 0.56));
        }
        if (map.getLayer('landcover_wetland')) {
          map.setPaintProperty('landcover_wetland', 'fill-opacity', Math.max(0.10, 0.72 - atm.nightGlow * 0.62));
        }
        if (map.getLayer('park')) map.setPaintProperty('park', 'fill-color', byteRgbToCss(atm.park));
        if (map.getLayer('park_outline')) map.setPaintProperty('park_outline', 'line-color', byteRgbToCss(atm.wood));
        if (map.getLayer('landcover_wood')) map.setPaintProperty('landcover_wood', 'fill-color', byteRgbToCss(atm.wood));
        if (map.getLayer('landcover_grass')) map.setPaintProperty('landcover_grass', 'fill-color', byteRgbToCss(atm.park));
        if (map.getLayer('landuse_pitch')) map.setPaintProperty('landuse_pitch', 'fill-color', byteRgbToCss(atm.park));
        if (map.getLayer('water')) map.setPaintProperty('water', 'fill-color', byteRgbToCss(atm.water));
        if (map.getLayer('water-bank-line')) map.setPaintProperty('water-bank-line', 'line-color', byteRgbToCss(atm.waterBank));
        if (map.getLayer('water-shimmer-overlay')) {
          const sOp = atm.nightGlow > 0.6 ? 0.08 : 0.22;
          map.setPaintProperty('water-shimmer-overlay', 'fill-opacity', ['interpolate', ['linear'], ['zoom'], 12.5, 0.0, 14.5, sOp * 0.65, 17.5, sOp]);
        }
        ['waterway_river', 'waterway_other', 'waterway_tunnel'].forEach((id) => {
          if (map.getLayer(id)) map.setPaintProperty(id, 'line-color', byteRgbToCss(atm.water));
        });
        if (map.getLayer('building')) {
          map.setPaintProperty('building', 'fill-color', byteRgbToCss(atm.bldg2d));
        }

        if (classifiedRoadLayers) {
          const rMain = byteRgbToCss(atm.roadMain);
          const rSec = byteRgbToCss(atm.roadSec);
          const rCase = byteRgbToCss(atm.roadCase);
          classifiedRoadLayers.motorway.forEach((id) => map.setPaintProperty(id, 'line-color', rMain));
          classifiedRoadLayers.trunk_primary.forEach((id) => map.setPaintProperty(id, 'line-color', rMain));
          classifiedRoadLayers.motorway_casing.forEach((id) => map.setPaintProperty(id, 'line-color', rCase));
          classifiedRoadLayers.trunk_casing.forEach((id) => map.setPaintProperty(id, 'line-color', rCase));
          classifiedRoadLayers.secondary.forEach((id) => map.setPaintProperty(id, 'line-color', rSec));
          classifiedRoadLayers.secondary_casing.forEach((id) => map.setPaintProperty(id, 'line-color', rCase));
          classifiedRoadLayers.minor.forEach((id) => map.setPaintProperty(id, 'line-color', rSec));
          classifiedRoadLayers.minor_casing.forEach((id) => map.setPaintProperty(id, 'line-color', rCase));
          classifiedRoadLayers.path.forEach((id) => map.setPaintProperty(id, 'line-color', rSec));
          classifiedRoadLayers.path_casing.forEach((id) => map.setPaintProperty(id, 'line-color', rCase));
        }

        const isDarkLabels = atm.nightGlow >= 0.62;
        const lblText = isDarkLabels ? '#E2E8F0' : '#334155';
        const hwyText = isDarkLabels ? '#CBD5E1' : '#475569';
        const lblHalo = isDarkLabels ? '#0F172A' : '#FFFFFF';
        ['poi_r1', 'poi_r7', 'highway-name-major', 'highway-name-minor', 'label_town', 'label_other', 'station-labels-major', 'station-labels-local'].forEach((id) => {
          if (!map.getLayer(id)) return;
          map.setPaintProperty(id, 'text-color', id.startsWith('highway') ? hwyText : lblText);
          map.setPaintProperty(id, 'text-halo-color', lblHalo);
        });
        const irSteel = isDarkLabels ? '#CBD5E1' : '#1E293B';
        const irSleeper = isDarkLabels ? '#64748B' : '#4A382B';
        const irBallast = isDarkLabels ? '#334155' : '#ACA393';
        railThemeLayers.major.forEach((id) => map.getLayer(id) && map.setPaintProperty(id, 'line-color', isDarkLabels ? '#94A3B8' : '#57463A'));
        railThemeLayers.majorHatch.forEach((id) => map.getLayer(id) && map.setPaintProperty(id, 'line-color', irSleeper));
        railThemeLayers.irBallast.forEach((id) => map.getLayer(id) && map.setPaintProperty(id, 'line-color', irBallast));
        railThemeLayers.irSleepers.forEach((id) => map.getLayer(id) && map.setPaintProperty(id, 'line-color', irSleeper));
        railThemeLayers.irRails.forEach((id) => map.getLayer(id) && map.setPaintProperty(id, 'line-color', irSteel));
        railThemeLayers.transit.forEach((id) => map.getLayer(id) && map.setPaintProperty(id, 'line-color', id.includes('tunnel') ? '#0284C7' : (isDarkLabels ? '#1E293B' : '#0F172A')));
        railThemeLayers.transitHatch.forEach((id) => map.getLayer(id) && map.setPaintProperty(id, 'line-color', isDarkLabels ? '#7DD3FC' : '#E0F2FE'));
      } catch (_) { }
      syncHudTheme();
    }

    if (map && (!isMobileProfile() || !isReady || shouldSyncMap)) map.triggerRepaint();
  }

  function setTimeOfDay(secOfDay, force) {
    if (typeof secOfDay !== 'number' || !Number.isFinite(secOfDay)) return;
    applyAtmosphere(secOfDay, !!force);
  }

  function syncSubwayRailAndGuideVisibility() {
    const show3dSubway = subwayRailsVisible || undergroundXRay;
    if (xrayTubeGroup) {
      xrayTubeGroup.visible = undergroundXRay;
    }
    if (buriedSubwayGroup) {
      buriedSubwayGroup.visible = show3dSubway;
    }
    if (wallShadowLayer) {
      wallShadowLayer.setEnvironment({
        opacity: undergroundXRay ? 0.24 : 1.0,
        shadowAlpha: undergroundXRay ? 0.08 : currentShadowAlpha,
        aoIntensity: undergroundXRay ? 0.16 : 0.36
      });
    }
    if (map) {
      const guideDashVis = show3dSubway ? 'none' : 'visible';
      const guideLabelVis = undergroundXRay ? 'none' : 'visible';
      ['underground-guide-casing', 'underground-guide-dash'].forEach((gid) => {
        if (map.getLayer(gid)) {
          try { map.setLayoutProperty(gid, 'visibility', guideDashVis); } catch (_) { }
        }
      });
      if (map.getLayer('underground-guide-label')) {
        try { map.setLayoutProperty('underground-guide-label', 'visibility', guideLabelVis); } catch (_) { }
      }
      const transitVis = show3dSubway ? 'visible' : 'none';
      railThemeLayers.transit
        .concat(railThemeLayers.transitHatch, ['dmrc-metro-casing', 'dmrc-metro-core', 'dmrc-metro-label'])
        .forEach((tid) => {
          if (map.getLayer(tid)) {
            try { map.setLayoutProperty(tid, 'visibility', transitVis); } catch (_) {}
          }
        });
      const hideNative = wallShadowLayer && wallShadowLayer.lastRenderedTileCount > 0 && map.getZoom() >= 12.6 && wallShadowLayer.wallShade;
      const nextOp = hideNative ? 0.005 : (undergroundXRay ? 0.24 : 0.94);
      ['overture-buildings-3d', 'building-3d'].forEach((lid) => {
        if (map.getLayer(lid)) {
          try { map.setPaintProperty(lid, 'fill-extrusion-opacity', nextOp); } catch (_) { }
        }
      });
      map.triggerRepaint();
    }
  }

  function setUndergroundXRay(enabled) {
    undergroundXRay = !!enabled;
    syncSubwayRailAndGuideVisibility();
    return undergroundXRay;
  }

  function setSubwayRailsVisible(enabled) {
    subwayRailsVisible = !!enabled;
    syncSubwayRailAndGuideVisibility();
    return subwayRailsVisible;
  }

  return {
    install(mapInstance) {
      map = mapInstance;
      configureMapLibreVisualHarmony();
      if (!map.getLayer('metro-webgl-3d-layer')) {
        // Place Three.js 3D layer strictly after wallshadow / overture-buildings-3d / building-3d and before symbol labels
        const layers = (map.getStyle() && map.getStyle().layers) || [];
        let beforeId;
        const anchorIds = ['wallshadow', 'overture-buildings-3d', 'building-3d'];
        let anchorIdx = -1;
        for (let k = 0; k < anchorIds.length; k++) {
          const idx = layers.findIndex((l) => l.id === anchorIds[k]);
          if (idx > anchorIdx) anchorIdx = idx;
        }
        if (anchorIdx >= 0 && anchorIdx + 1 < layers.length) {
          beforeId = layers[anchorIdx + 1].id;
        } else {
          const firstSym = layers.find((l) => l.type === 'symbol');
          if (firstSym) beforeId = firstSym.id;
        }
        map.addLayer(customLayer, beforeId);
      }
      if (!heroCorridorPrewarmed) {
        let heroFallbackTimer = null;
        const onInitialTile = (e) => {
          if (e && e.sourceId === 'overture-buildings' && e.tile && e.tile.state === 'loaded') {
            map.off('sourcedata', onInitialTile);
            if (heroFallbackTimer) clearTimeout(heroFallbackTimer);
            setTimeout(prewarmOvertureHeroCorridor, 120);
          }
        };
        map.on('sourcedata', onInitialTile);
        heroFallbackTimer = setTimeout(() => {
          map.off('sourcedata', onInitialTile);
          prewarmOvertureHeroCorridor();
        }, 7000);
      }
    },
    configureMapLibreVisualHarmony,
    prewarmOvertureAtLngLat,
    refreshDynamicParkTrees,
    flyToStation,
    anchorTrackToStation,
    stepAlongTrack,
    flyToMonument,
    flyToRailwayHub,
    closeMonumentSpotlight,
    syncMonumentMarkersVisibility,
    hideTooltip,
    setTimeOfDay,
    setUndergroundXRay,
    isUndergroundXRay() { return undergroundXRay; },
    setSubwayRailsVisible,
    isSubwayRailsVisible() { return subwayRailsVisible; },
    syncHudTheme,
    setSelectedStation(name) { selectedStationName = name || null; },
    setYellowOnly(flag) { yellowOnly = !!flag; },
    setLineFilter(lineId) {
      activeLineId = lineId || 'all';
      if (activeLineId === 'blue') {
        activeWalkCorridor = blueCorridor;
      } else if (activeLineId === 'yellow') {
        activeWalkCorridor = yellowCorridor;
      }
      updateVisibilityAndCulling(performance.now(), 0, false);
      if (typeof window.syncStationStepper === 'function') {
        window.syncStationStepper();
      }
    },
    getActiveLine() { return activeLineId; },
    getCorridors() { return { yellow: yellowCorridor, blue: blueCorridor, vaishali: vaishaliCorridor }; },
    getActiveStations() {
      if (activeLineId === 'blue') {
        const main = blueCorridor ? blueCorridor.stationsData : [];
        const vBranch = vaishaliCorridor ? vaishaliCorridor.stationsData.filter((s) => s.name !== 'Yamuna Bank') : [];
        return main.concat(vBranch);
      }
      if (activeLineId === 'yellow' && yellowCorridor) return yellowCorridor.stationsData;
      return allStationsData.length ? allStationsData : stationsData;
    },
    getStationCount() { return allStationsData.length || stationsData.length; },
    getStations() { return allStationsData.length ? allStationsData : stationsData; },
    getMonuments() { return DELHI_MONUMENTS; },
    getRailwayHubs() { return INDIA_RAILWAY_HUBS; },
    getNearestStationsForLngLat,
    getDebugInfo() {
      return {
        isReady,
        stationCount: stationsData.length,
        fleetCount: fleetTrains.length,
        totalLenM: Math.round(totalLen),
        yellowOnly,
        overtureLoaded,
        activeBuildingLayerId,
        activeBuildingSourceId,
        wallShadowTiles: wallShadowLayer ? wallShadowLayer.lastRenderedTileCount : 0,
        wallShadowPrimaryTiles: wallShadowLayer ? (wallShadowLayer.lastPrimaryTileCount || 0) : 0,
        wallShadowFallbackTiles: wallShadowLayer ? (wallShadowLayer.lastFallbackTileCount || 0) : 0,
        parkTreeCount: parkPool ? parkPool.trunkInst.count : 0,
        monumentCount: monumentGroups.length,
        monumentMarkerCount: monumentMarkers.length,
        secOfDay: currentSecOfDay,
        nightGlow: Number(currentNightGlow.toFixed(2)),
        undergroundXRay,
        subwayRailsVisible
      };
    }
  };
})();
