const puppeteer = require('puppeteer-core');
const path = require('path');

const ARTIFACT_DIR = '/Users/prashastpathak/.gemini/antigravity/brain/3cecd419-e4fd-498d-95de-6985cc4c0520';

async function verify() {
  const browser = await puppeteer.launch({
    executablePath: '/Applications/Brave Browser.app/Contents/MacOS/Brave Browser',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--use-gl=angle', '--enable-webgl']
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 900, deviceScaleFactor: 2 });

  page.on('console', msg => console.log('PAGE LOG:', msg.text()));
  page.on('pageerror', err => console.error('PAGE ERROR:', err.message));

  console.log('Navigating to http://localhost:8080...');
  await page.goto('http://localhost:8080', { waitUntil: 'domcontentloaded' });
  await new Promise(r => setTimeout(r, 3500));

  // 1. Detailed Flyover Rails (Qutab Minar -> Chhatarpur)
  console.log('Focusing on Detailed Flyover Rails...');
  await page.evaluate(() => {
    if (window.mapInstance) {
      window.mapInstance.flyTo({
        center: [77.1770, 28.5108], // Flyover viaduct between Qutab Minar & Chhatarpur
        zoom: 16.5,
        pitch: 45,
        bearing: -18,
        duration: 0
      });
    }
  });
  await new Promise(r => setTimeout(r, 2500));
  const flyoverRailsPath = path.join(ARTIFACT_DIR, 'detailed_rail_flyover.png');
  await page.screenshot({ path: flyoverRailsPath });
  console.log(`Saved: ${flyoverRailsPath}`);

  // 2. Detailed Underground Tunnel Rails (Rajiv Chowk)
  console.log('Focusing on Detailed Underground Tunnel Rails...');
  await page.evaluate(() => {
    if (window.mapInstance) {
      window.mapInstance.flyTo({
        center: [77.2196, 28.6329], // Rajiv Chowk
        zoom: 16.5,
        pitch: 42,
        bearing: -14,
        duration: 0
      });
    }
  });
  await new Promise(r => setTimeout(r, 2500));
  const tunnelRailsPath = path.join(ARTIFACT_DIR, 'detailed_rail_tunnel.png');
  await page.screenshot({ path: tunnelRailsPath });
  console.log(`Saved: ${tunnelRailsPath}`);

  // 3. North Portal Transition (Model Town -> GTB Nagar)
  console.log('Focusing on North Portal Transition...');
  await page.evaluate(() => {
    if (window.mapInstance) {
      window.mapInstance.flyTo({
        center: [77.2001, 28.70045], // North Portal
        zoom: 16.0,
        pitch: 45,
        bearing: -15,
        duration: 0
      });
    }
  });
  await new Promise(r => setTimeout(r, 2500));
  const portalPath = path.join(ARTIFACT_DIR, 'detailed_rail_portal.png');
  await page.screenshot({ path: portalPath });
  console.log(`Saved: ${portalPath}`);

  // 4. Pure Tracks Only Mode (Clicking Tracks Only toggle)
  console.log('Testing Tracks Only Mode...');
  await page.click('#mode-tracks');
  await new Promise(r => setTimeout(r, 1000));
  const tracksOnlyPath = path.join(ARTIFACT_DIR, 'detailed_rail_tracks_only.png');
  await page.screenshot({ path: tracksOnlyPath });
  console.log(`Saved: ${tracksOnlyPath}`);

  await browser.close();
  console.log('All detailed rail verification screenshots captured successfully!');
}

verify().catch(console.error);
