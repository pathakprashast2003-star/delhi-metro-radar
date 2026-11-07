/**
 * Delhi Metro Radar - Yellow Line (Line 2) Dataset
 * Complete 37 stations from Samaypur Badli (North) to Millennium City Centre Gurugram (South)
 * Track length: ~49.3 km | Total transit time: ~85 min | Average speed: ~35 km/h
 */

export const YELLOW_LINE_CONFIG = {
  id: 'yellow',
  name: 'Yellow Line',
  color: '#FACC15',       // Primary bright yellow
  glowColor: '#EAB308',   // Radar neon glow
  darkColor: '#854D0E',
  northTerminal: 'Samaypur Badli',
  southTerminal: 'Millennium City Centre Gurugram',
  headwayMinutesPeak: 3.0,
  headwayMinutesOffPeak: 5.5,
  dwellTimeSeconds: 30,
};

export const YELLOW_LINE_STATIONS = [
  { id: 1, name: "Samaypur Badli", code: "SPBD", coords: [77.146545, 28.742872], interchange: [] },
  { id: 2, name: "Rohini Sector 18, 19", code: "RH18", coords: [77.135574, 28.740192], interchange: [] },
  { id: 3, name: "Haiderpur Badli Mor", code: "HDBM", coords: [77.149956, 28.718657], interchange: [] },
  { id: 4, name: "Jahangirpuri", code: "JAGP", coords: [77.161240, 28.728180], interchange: [] },
  { id: 5, name: "Adarsh Nagar", code: "ADNR", coords: [77.167288, 28.714400], interchange: [] },
  { id: 6, name: "Azadpur", code: "AZDP", coords: [77.179863, 28.707287], interchange: [{ line: "Pink Line", color: "#EC4899" }] },
  { id: 7, name: "Model Town", code: "MDTN", coords: [77.193764, 28.702833], interchange: [] },
  { id: 8, name: "Guru Tegh Bahadur Nagar", code: "GTBN", coords: [77.206411, 28.698131], interchange: [] },
  { id: 9, name: "Vishwavidyalaya", code: "VSVY", coords: [77.212418, 28.694765], interchange: [] },
  { id: 10, name: "Vidhan Sabha", code: "VNSB", coords: [77.221626, 28.687845], interchange: [] },
  { id: 11, name: "Civil Lines", code: "CVLN", coords: [77.224953, 28.676945], interchange: [] },
  { id: 12, name: "Kashmere Gate", code: "KGAT", coords: [77.228170, 28.667500], interchange: [{ line: "Red Line", color: "#EF4444" }, { line: "Violet Line", color: "#8B5CF6" }] },
  { id: 13, name: "Chandni Chowk", code: "CHCK", coords: [77.229218, 28.656443], interchange: [{ line: "Old Delhi Rly", color: "#94A3B8" }] },
  { id: 14, name: "Chawri Bazar", code: "CWBZ", coords: [77.226280, 28.649635], interchange: [] },
  { id: 15, name: "New Delhi", code: "NDLS", coords: [77.222351, 28.642944], interchange: [{ line: "Airport Express", color: "#F97316" }, { line: "New Delhi Rly", color: "#94A3B8" }] },
  { id: 16, name: "Rajiv Chowk", code: "RJC", coords: [77.219574, 28.632896], interchange: [{ line: "Blue Line", color: "#3B82F6" }] },
  { id: 17, name: "Patel Chowk", code: "PTCK", coords: [77.212288, 28.622967], interchange: [] },
  { id: 18, name: "Central Secretariat", code: "CTST", coords: [77.212029, 28.614973], interchange: [{ line: "Violet Line", color: "#8B5CF6" }] },
  { id: 19, name: "Udyog Bhawan", code: "UDBH", coords: [77.210052, 28.611525], interchange: [] },
  { id: 20, name: "Lok Kalyan Marg", code: "LKM", coords: [77.209122, 28.597519], interchange: [] },
  { id: 21, name: "Jor Bagh", code: "JRBH", coords: [77.212900, 28.587800], interchange: [] },
  { id: 22, name: "Dilli Haat - INA", code: "DHINA", coords: [77.210800, 28.574100], interchange: [{ line: "Pink Line", color: "#EC4899" }] },
  { id: 23, name: "AIIMS", code: "AIMS", coords: [77.207805, 28.566860], interchange: [] },
  { id: 24, name: "Green Park", code: "GNPK", coords: [77.205700, 28.559500], interchange: [] },
  { id: 25, name: "Hauz Khas", code: "HZKS", coords: [77.206707, 28.544256], interchange: [{ line: "Magenta Line", color: "#D946EF" }] },
  { id: 26, name: "Malviya Nagar", code: "MLVN", coords: [77.209800, 28.535500], interchange: [] },
  { id: 27, name: "Saket", code: "SAKT", coords: [77.206900, 28.523800], interchange: [] },
  { id: 28, name: "Qutab Minar", code: "QTMN", coords: [77.184300, 28.513400], interchange: [] },
  { id: 29, name: "Chhatarpur", code: "CHTP", coords: [77.170600, 28.508200], interchange: [] },
  { id: 30, name: "Sultanpur", code: "SLTP", coords: [77.147800, 28.497500], interchange: [] },
  { id: 31, name: "Ghitorni", code: "GHTR", coords: [77.135200, 28.489100], interchange: [] },
  { id: 32, name: "Arjan Garh", code: "AJGH", coords: [77.126400, 28.479500], interchange: [] },
  { id: 33, name: "Guru Dronacharya", code: "GRDN", coords: [77.108400, 28.480200], interchange: [] },
  { id: 34, name: "Sikanderpur", code: "SKDP", coords: [77.093100, 28.482700], interchange: [{ line: "Rapid Metro", color: "#06B6D4" }] },
  { id: 35, name: "MG Road", code: "MGRD", coords: [77.084800, 28.478700], interchange: [] },
  { id: 36, name: "IFFCO Chowk", code: "IFCK", coords: [77.072200, 28.472500], interchange: [] },
  { id: 37, name: "Millennium City Centre Gurugram", code: "MCCG", coords: [77.072500, 28.459400], interchange: [] }
];

/**
 * Builds a smoothed GeoJSON LineString of the Yellow Line track
 */
export function getYellowLineGeoJSON() {
  const coordinates = YELLOW_LINE_STATIONS.map(s => s.coords);
  return {
    type: 'Feature',
    properties: {
      line: 'yellow',
      name: 'Yellow Line',
      color: YELLOW_LINE_CONFIG.color
    },
    geometry: {
      type: 'LineString',
      coordinates
    }
  };
}

/**
 * Builds GeoJSON FeatureCollection of station point nodes
 */
export function getYellowStationsGeoJSON() {
  return {
    type: 'FeatureCollection',
    features: YELLOW_LINE_STATIONS.map((station, index) => ({
      type: 'Feature',
      properties: {
        id: station.id,
        name: station.name,
        code: station.code,
        index: index,
        isTerminal: index === 0 || index === YELLOW_LINE_STATIONS.length - 1,
        hasInterchange: station.interchange.length > 0,
        interchange: JSON.stringify(station.interchange)
      },
      geometry: {
        type: 'Point',
        coordinates: station.coords
      }
    }))
  };
}
