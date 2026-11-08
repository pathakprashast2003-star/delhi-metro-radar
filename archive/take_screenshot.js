const puppeteer = require('puppeteer-core');

async function snap(url, outputPath, waitMs = 3000) {
  const browser = await puppeteer.launch({
    executablePath: '/Applications/Brave Browser.app/Contents/MacOS/Brave Browser',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--use-gl=angle', '--enable-webgl']
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 900, deviceScaleFactor: 2 });
  
  page.on('console', msg => console.log('PAGE LOG:', msg.text()));
  page.on('pageerror', err => console.error('PAGE ERROR:', err.message));

  console.log(`Navigating to ${url}...`);
  await page.goto(url, { waitUntil: 'domcontentloaded' });
  
  // Wait for map or 3d elements to render
  await new Promise(r => setTimeout(r, waitMs));

  await page.screenshot({ path: outputPath });
  console.log(`Saved screenshot to ${outputPath}`);
  await browser.close();
}

const targetUrl = process.argv[2] || 'http://localhost:8080';
const targetPath = process.argv[3] || '/Users/prashastpathak/.gemini/antigravity/brain/3cecd419-e4fd-498d-95de-6985cc4c0520/corridor_pristine.png';
const waitTime = parseInt(process.argv[4] || '3500', 10);

snap(targetUrl, targetPath, waitTime);
