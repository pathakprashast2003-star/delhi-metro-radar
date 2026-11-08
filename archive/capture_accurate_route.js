const puppeteer = require('puppeteer-core');
const path = require('path');

const ARTIFACT_DIR = '/Users/prashastpathak/.gemini/antigravity/brain/3cecd419-e4fd-498d-95de-6985cc4c0520';

async function capture() {
  const browser = await puppeteer.launch({
    executablePath: '/Applications/Brave Browser.app/Contents/MacOS/Brave Browser',
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--user-data-dir=/tmp/puppeteer-brave-profile-' + Date.now(),
      '--headless=new'
    ]
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 900, deviceScaleFactor: 2 });

  console.log('Navigating to http://localhost:8080...');
  await page.goto('http://localhost:8080', { waitUntil: 'networkidle2' });
  await new Promise(r => setTimeout(r, 3500));

  // 1. South Delhi / MG Road Corridor matching user's framing exactly
  console.log('Capturing MG Road Corridor view...');
  await page.evaluate(() => {
    if (window.map) {
      window.map.jumpTo({
        center: [77.140, 28.498],
        zoom: 12.6,
        pitch: 0,
        bearing: 0
      });
    }
  });
  await new Promise(r => setTimeout(r, 3000));
  const mgRoadPath = path.join(ARTIFACT_DIR, 'accurate_route_mg_road_comparison.png');
  await page.screenshot({ path: mgRoadPath });
  console.log(`Saved: ${mgRoadPath}`);

  // 2. Chhatarpur & Sultanpur Elevated Viaduct Real Road Curve
  console.log('Capturing Chhatarpur road curvature view...');
  await page.evaluate(() => {
    if (window.map) {
      window.map.jumpTo({
        center: [77.165, 28.505],
        zoom: 14.8,
        pitch: 40,
        bearing: -25
      });
    }
  });
  await new Promise(r => setTimeout(r, 2500));
  const curvePath = path.join(ARTIFACT_DIR, 'accurate_route_chhatarpur_close.png');
  await page.screenshot({ path: curvePath });
  console.log(`Saved: ${curvePath}`);

  // 3. Full Corridor Overview
  console.log('Capturing Full Corridor Overview...');
  await page.evaluate(() => {
    if (window.map) {
      window.map.jumpTo({
        center: [77.1600, 28.6050],
        zoom: 10.6,
        pitch: 30,
        bearing: -6
      });
    }
  });
  await new Promise(r => setTimeout(r, 2500));
  const overviewPath = path.join(ARTIFACT_DIR, 'accurate_route_full_overview.png');
  await page.screenshot({ path: overviewPath });
  console.log(`Saved: ${overviewPath}`);

  await browser.close();
  console.log('All accurate route screenshots captured successfully!');
}

capture().catch(console.error);

