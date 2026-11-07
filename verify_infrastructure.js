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

  // 1. Overview screenshot
  const overviewPath = path.join(ARTIFACT_DIR, 'infra_corridor_overview.png');
  await page.screenshot({ path: overviewPath });
  console.log(`Saved: ${overviewPath}`);

  // 2. North Portal (Model Town -> GTB Nagar)
  console.log('Focusing on North Portal (Model Town -> GTB Nagar)...');
  await page.evaluate(() => {
    if (window.mapInstance) {
      window.mapInstance.flyTo({
        center: [77.2001, 28.70045], // North Portal
        zoom: 15.0,
        pitch: 45,
        bearing: -15,
        duration: 0
      });
    }
  });
  await new Promise(r => setTimeout(r, 2500));
  const northPortalPath = path.join(ARTIFACT_DIR, 'infra_north_portal.png');
  await page.screenshot({ path: northPortalPath });
  console.log(`Saved: ${northPortalPath}`);

  // 3. Central Underground Tube Tunnel (Rajiv Chowk & Patel Chowk)
  console.log('Focusing on Central Underground Tunnel (Rajiv Chowk)...');
  await page.evaluate(() => {
    if (window.mapInstance) {
      window.mapInstance.flyTo({
        center: [77.2196, 28.6329], // Rajiv Chowk
        zoom: 15.4,
        pitch: 45,
        bearing: -14,
        duration: 0
      });
    }
  });
  await new Promise(r => setTimeout(r, 2500));
  const undergroundPath = path.join(ARTIFACT_DIR, 'infra_central_underground.png');
  await page.screenshot({ path: undergroundPath });
  console.log(`Saved: ${undergroundPath}`);

  // 4. South Portal (Saket -> Qutab Minar)
  console.log('Focusing on South Portal (Saket -> Qutab Minar)...');
  await page.evaluate(() => {
    if (window.mapInstance) {
      window.mapInstance.flyTo({
        center: [77.1956, 28.5186], // South Portal
        zoom: 15.0,
        pitch: 45,
        bearing: -15,
        duration: 0
      });
    }
  });
  await new Promise(r => setTimeout(r, 2500));
  const southPortalPath = path.join(ARTIFACT_DIR, 'infra_south_portal.png');
  await page.screenshot({ path: southPortalPath });
  console.log(`Saved: ${southPortalPath}`);

  // 5. South Elevated Flyover Viaduct (Qutab Minar -> Chhatarpur)
  console.log('Focusing on South Elevated Flyover Viaduct (Qutab Minar)...');
  await page.evaluate(() => {
    if (window.mapInstance) {
      window.mapInstance.flyTo({
        center: [77.1770, 28.5108], // Between Qutab Minar and Chhatarpur
        zoom: 15.5,
        pitch: 48,
        bearing: -20,
        duration: 0
      });
    }
  });
  await new Promise(r => setTimeout(r, 2500));
  const flyoverPath = path.join(ARTIFACT_DIR, 'infra_south_flyover.png');
  await page.screenshot({ path: flyoverPath });
  console.log(`Saved: ${flyoverPath}`);

  await browser.close();
  console.log('All verification screenshots captured successfully!');
}

verify().catch(console.error);
