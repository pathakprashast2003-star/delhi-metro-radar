/**
 * Delhi Metro Comprehensive Interconnecting Transit Network
 * Authentic geographic corridors providing metropolitan context for Delhi Metro Radar.
 * Lines: Blue, Red, Violet, Magenta, Pink, Airport Express, Rapid Metro Gurugram.
 */

export const DMRC_NETWORK_GEOJSON = {
  type: 'FeatureCollection',
  features: [
    // ── 1. BLUE LINE (Line 3/4) - East-West Trans-Yamuna Spine (Intersects Yellow at Rajiv Chowk) ──
    {
      type: 'Feature',
      properties: {
        id: 'blue-line',
        name: 'Blue Line (Line 3)',
        color: '#0055A5',
        interchangeWithYellow: 'Rajiv Chowk',
        lengthKm: 65.3
      },
      geometry: {
        type: 'LineString',
        coordinates: [
          [77.0195, 28.5522], // Dwarka Sector 21
          [77.0378, 28.5702], // Dwarka Sector 8
          [77.0583, 28.5925], // Dwarka
          [77.0678, 28.6080], // Dwarka Mor
          [77.0865, 28.6295], // Janakpuri West
          [77.1022, 28.6365], // Tilak Nagar
          [77.1215, 28.6445], // Rajouri Garden
          [77.1425, 28.6515], // Moti Nagar
          [77.1645, 28.6545], // Shadipur
          [77.1855, 28.6505], // Karol Bagh
          [77.2025, 28.6435], // Jhandewalan
          [77.2115, 28.6365], // Ramakrishna Ashram Marg
          [77.2195, 28.6328], // RAJIV CHOWK (INTERCHANGE)
          [77.2285, 28.6305], // Barakhamba Road
          [77.2345, 28.6255], // Mandi House
          [77.2495, 28.6225], // Supreme Court (Pragati Maidan)
          [77.2655, 28.6185], // Indraprastha
          [77.2885, 28.6165], // Yamuna Bank
          [77.3025, 28.6255], // Akshardham
          [77.3085, 28.6055], // Mayur Vihar Phase 1
          [77.3245, 28.5875], // New Ashok Nagar
          [77.3385, 28.5745], // Noida Sector 15
          [77.3525, 28.5685], // Noida City Centre
          [77.3755, 28.5785], // Noida Sector 52
          [77.3915, 28.5885]  // Noida Electronic City
        ]
      }
    },

    // ── 2. RED LINE (Line 1) - Northern Trans-Yamuna Corridor (Intersects Yellow at Kashmere Gate) ──
    {
      type: 'Feature',
      properties: {
        id: 'red-line',
        name: 'Red Line (Line 1)',
        color: '#E21E26',
        interchangeWithYellow: 'Kashmere Gate',
        lengthKm: 34.7
      },
      geometry: {
        type: 'LineString',
        coordinates: [
          [77.1065, 28.7205], // Rithala
          [77.1225, 28.7125], // Rohini West
          [77.1385, 28.7055], // Pitampura
          [77.1525, 28.6965], // Netaji Subhash Place
          [77.1705, 28.6875], // Keshav Puram
          [77.1905, 28.6755], // Inderlok
          [77.2085, 28.6695], // Tis Hazari
          [77.2281, 28.6675], // KASHMERE GATE (INTERCHANGE)
          [77.2425, 28.6695], // Shastri Park
          [77.2565, 28.6745], // Seelampur
          [77.2725, 28.6785], // Welcome
          [77.2915, 28.6805], // Shahdara
          [77.3125, 28.6815], // Dilshad Garden
          [77.3455, 28.6825], // Major Mohit Sharma Rajendra Nagar
          [77.3785, 28.6845]  // Shaheed Sthal (New Bus Adda Ghaziabad)
        ]
      }
    },

    // ── 3. VIOLET LINE (Line 6) - Heritage & South-East Industrial Corridor (Intersects at KG & Central Sec) ──
    {
      type: 'Feature',
      properties: {
        id: 'violet-line',
        name: 'Violet Line (Line 6)',
        color: '#7C3AED',
        interchangeWithYellow: 'Kashmere Gate & Central Secretariat',
        lengthKm: 46.6
      },
      geometry: {
        type: 'LineString',
        coordinates: [
          [77.2281, 28.6675], // KASHMERE GATE
          [77.2385, 28.6565], // Lal Quila
          [77.2415, 28.6495], // Jama Masjid
          [77.2425, 28.6385], // Delhi Gate
          [77.2415, 28.6295], // ITO
          [77.2345, 28.6255], // Mandi House
          [77.2275, 28.6185], // Janpath
          [77.2120, 28.6149], // CENTRAL SECRETARIAT (INTERCHANGE)
          [77.2185, 28.6005], // Khan Market
          [77.2295, 28.5885], // Jawaharlal Nehru Stadium
          [77.2415, 28.5705], // Lajpat Nagar
          [77.2525, 28.5585], // Moolchand
          [77.2585, 28.5445], // Nehru Place
          [77.2605, 28.5385], // Kalkaji Mandir
          [77.2695, 28.5285], // Govind Puri
          [77.2885, 28.5085], // Mohan Estate
          [77.3025, 28.4985], // Badarpur Border
          [77.3185, 28.4285], // Bata Chowk
          [77.3245, 28.3755]  // Raja Nahar Singh (Ballabhgarh)
        ]
      }
    },

    // ── 4. MAGENTA LINE (Line 8) - Southern Orbital & Outer Ring (Intersects Yellow at Hauz Khas) ──
    {
      type: 'Feature',
      properties: {
        id: 'magenta-line',
        name: 'Magenta Line (Line 8)',
        color: '#C026D3',
        interchangeWithYellow: 'Hauz Khas',
        lengthKm: 37.5
      },
      geometry: {
        type: 'LineString',
        coordinates: [
          [77.0865, 28.6295], // Janakpuri West
          [77.0985, 28.6125], // Dabri Mor
          [77.1085, 28.5945], // Dashrath Puri
          [77.1185, 28.5825], // Palam
          [77.1265, 28.5685], // Sadar Bazar Cantonment
          [77.1385, 28.5585], // Terminal 1 IGI Airport
          [77.1585, 28.5525], // Shankar Vihar
          [77.1725, 28.5485], // Vasant Vihar
          [77.1855, 28.5455], // Munirka
          [77.1955, 28.5445], // IIT Delhi
          [77.2067, 28.5442], // HAUZ KHAS (INTERCHANGE)
          [77.2185, 28.5435], // Panchsheel Park
          [77.2345, 28.5415], // Chirag Delhi
          [77.2485, 28.5405], // Greater Kailash
          [77.2605, 28.5385], // Kalkaji Mandir
          [77.2755, 28.5485], // Okhla NSIC
          [77.2985, 28.5585], // Jasola Vihar
          [77.3155, 28.5545], // Kalindi Kunj
          [77.3325, 28.5625]  // Botanical Garden Noida
        ]
      }
    },

    // ── 5. PINK LINE (Line 7) - The Great Ring Railway (Intersects at Azadpur & Dilli Haat INA) ──
    {
      type: 'Feature',
      properties: {
        id: 'pink-line',
        name: 'Pink Line (Ring Railway)',
        color: '#DB2777',
        interchangeWithYellow: 'Azadpur & Dilli Haat - INA',
        lengthKm: 58.6
      },
      geometry: {
        type: 'LineString',
        coordinates: [
          [77.1825, 28.7185], // Majlis Park
          [77.1798, 28.7072], // AZADPUR (INTERCHANGE)
          [77.1685, 28.6985], // Shalimar Bagh
          [77.1525, 28.6965], // Netaji Subhash Place
          [77.1355, 28.6825], // Shakurpur
          [77.1215, 28.6705], // Punjabi Bagh West
          [77.1215, 28.6445], // Rajouri Garden
          [77.1325, 28.6325], // Mayapuri
          [77.1485, 28.6185], // Naraina Vihar
          [77.1625, 28.5985], // Delhi Cantt
          [77.1685, 28.5855], // Durgabai Deshmukh South Campus
          [77.1855, 28.5785], // Sir Vishweshwaraiah Moti Bagh
          [77.1985, 28.5755], // Bhikaji Cama Place
          [77.2055, 28.5745], // Sarojini Nagar
          [77.2108, 28.5741], // DILLI HAAT - INA (INTERCHANGE)
          [77.2285, 28.5715], // South Extension
          [77.2415, 28.5705], // Lajpat Nagar
          [77.2555, 28.5785], // Vinobapuri
          [77.2685, 28.5905], // Ashram
          [77.2855, 28.6055], // Sarai Kale Khan - Nizamuddin
          [77.3085, 28.6055], // Mayur Vihar Phase 1
          [77.3225, 28.6285], // Mayur Vihar Pocket 1
          [77.3185, 28.6485], // Anand Vihar ISBT
          [77.3055, 28.6655], // Karkarduma
          [77.2725, 28.6785], // Welcome
          [77.2685, 28.7055]  // Shiv Vihar
        ]
      }
    },

    // ── 6. AIRPORT EXPRESS LINE (Orange Line) - High Speed Airport Link (Intersects at New Delhi) ──
    {
      type: 'Feature',
      properties: {
        id: 'airport-express',
        name: 'Airport Express Line',
        color: '#EA580C',
        interchangeWithYellow: 'New Delhi',
        lengthKm: 22.7
      },
      geometry: {
        type: 'LineString',
        coordinates: [
          [77.2223, 28.6429], // NEW DELHI METRO & RAILWAY STATION (INTERCHANGE)
          [77.2125, 28.6285], // Shivaji Stadium
          [77.1685, 28.5885], // Dhaula Kuan
          [77.1205, 28.5505], // Delhi Aerocity
          [77.0855, 28.5555], // Airport Terminal 3
          [77.0195, 28.5522], // Dwarka Sector 21
          [76.9985, 28.5485]  // Yashobhoomi Dwarka Sector 25
        ]
      }
    },

    // ── 7. RAPID METRO GURUGRAM - DLF Cyber City Commercial Ring (Intersects Yellow at Sikanderpur) ──
    {
      type: 'Feature',
      properties: {
        id: 'rapid-metro',
        name: 'Rapid Metro Gurugram',
        color: '#059669',
        interchangeWithYellow: 'Sikanderpur',
        lengthKm: 12.8
      },
      geometry: {
        type: 'LineString',
        coordinates: [
          [77.0935, 28.4815], // SIKANDERPUR (INTERCHANGE)
          [77.0895, 28.4905], // Phase 2
          [77.0885, 28.4985], // Belvedere Towers
          [77.0895, 28.5025], // Cyber City Loop North
          [77.0985, 28.4995], // Moulsari Avenue
          [77.1025, 28.4925], // Phase 3
          [77.0935, 28.4815], // Back to Sikanderpur
          [77.0945, 28.4685], // Sector 42-43
          [77.0985, 28.4555], // Sector 53-54
          [77.1045, 28.4425]  // Sector 55-56
        ]
      }
    }
  ]
};

export const DMRC_MAJOR_INTERCHANGE_NODES = {
  type: 'FeatureCollection',
  features: [
    { type: 'Feature', properties: { name: 'Rajiv Chowk', lines: 'Yellow ✕ Blue' }, geometry: { type: 'Point', coordinates: [77.2195, 28.6328] } },
    { type: 'Feature', properties: { name: 'Kashmere Gate', lines: 'Yellow ✕ Red ✕ Violet' }, geometry: { type: 'Point', coordinates: [77.2281, 28.6675] } },
    { type: 'Feature', properties: { name: 'Central Secretariat', lines: 'Yellow ✕ Violet' }, geometry: { type: 'Point', coordinates: [77.2120, 28.6149] } },
    { type: 'Feature', properties: { name: 'Hauz Khas', lines: 'Yellow ✕ Magenta' }, geometry: { type: 'Point', coordinates: [77.2067, 28.5442] } },
    { type: 'Feature', properties: { name: 'Azadpur', lines: 'Yellow ✕ Pink' }, geometry: { type: 'Point', coordinates: [77.1798, 28.7072] } },
    { type: 'Feature', properties: { name: 'Dilli Haat - INA', lines: 'Yellow ✕ Pink' }, geometry: { type: 'Point', coordinates: [77.2108, 28.5741] } },
    { type: 'Feature', properties: { name: 'New Delhi', lines: 'Yellow ✕ Airport Express' }, geometry: { type: 'Point', coordinates: [77.2223, 28.6429] } },
    { type: 'Feature', properties: { name: 'Sikanderpur', lines: 'Yellow ✕ Rapid Metro' }, geometry: { type: 'Point', coordinates: [77.0935, 28.4815] } }
  ]
};

