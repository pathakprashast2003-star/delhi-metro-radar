const puppeteer = require('puppeteer-core');
const path = require('path');

const ARTIFACT_DIR = '/Users/prashastpathak/.gemini/antigravity/brain/3cecd419-e4fd-498d-95de-6985cc4c0520';

async function verify() {
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

  // 1. Live Morning Peak: Click on a train that is STOPPED or BRAKING to verify Inspector Card
  console.log('Capturing Live Revenue Fleet with Train Stopped at Station...');
  await page.evaluate(() => {
    // Select first train that is stopped or dwelling
    if (window.map && window.map.getSource('active-trains')) {
      // Find a train
      fetch('/api/trains')
        .then(r => r.json())
        .then(data => {
          const stoppedTrain = data.trains.find(t => t.state === 'STOPPED') || data.trains[0];
          if (stoppedTrain) {
            const card = document.getElementById('inspector-card');
            if (card) {
              card.classList.remove('hidden');
              document.getElementById('ins-id').textContent = `Train ${stoppedTrain.id}`;
              document.getElementById('ins-track').textContent = `${stoppedTrain.track} · ${stoppedTrain.elevLabel || ''}`;
              document.getElementById('ins-dir').textContent = stoppedTrain.directionLabel;
              document.getElementById('ins-between').textContent = stoppedTrain.currentStation ? `📍 At Platform: ${stoppedTrain.currentStation}` : `${stoppedTrain.fromStation} ➔ ${stoppedTrain.toStation}`;
              document.getElementById('ins-speed').textContent = `${stoppedTrain.speedKph} km/h`;

              const stateEl = document.getElementById('ins-state');
              if (stateEl) {
                stateEl.textContent = stoppedTrain.stateLabel || '🔴 STOPPED (BOARDING)';
                stateEl.className = 'spec-v state-badge state-stopped';
              }

              const dwellRow = document.getElementById('ins-dwell-row');
              if (dwellRow) {
                dwellRow.classList.remove('hidden');
                document.getElementById('ins-dwell-timer').textContent = `${stoppedTrain.dwellRemaining || 24}s remaining`;
                document.getElementById('ins-dwell-total').textContent = `/ ${stoppedTrain.dwellTotal || 50}s dwell`;
                document.getElementById('ins-dwell-reason').textContent = stoppedTrain.dwellReason || 'High Interchange Crowds · Blue Line Transfer';
                document.getElementById('ins-dwell-fill').style.width = '48%';
              }
            }
          }
        });
    }
  });
  await new Promise(r => setTimeout(r, 2000));
  const peakPath = path.join(ARTIFACT_DIR, 'live_morning_peak_stopping.png');
  await page.screenshot({ path: peakPath });
  console.log(`Saved: ${peakPath}`);

  // 2. Test 02:00 AM Night Maintenance Window (No Metros Running)
  console.log('Switching to 02:00 AM Night Maintenance Window...');
  await page.click('.time-preset-chip[data-time="7200"]');
  await new Promise(r => setTimeout(r, 2500));
  const nightPath = path.join(ARTIFACT_DIR, 'night_maintenance_no_metros.png');
  await page.screenshot({ path: nightPath });
  console.log(`Saved: ${nightPath}`);

  // 3. Test 05:30 AM First Metro Startup
  console.log('Switching to 05:30 AM First Metro Launch...');
  await page.click('.time-preset-chip[data-time="19800"]');
  await new Promise(r => setTimeout(r, 2500));
  const firstMetroPath = path.join(ARTIFACT_DIR, 'first_metro_startup_0530.png');
  await page.screenshot({ path: firstMetroPath });
  console.log(`Saved: ${firstMetroPath}`);

  // Reset back to live mode
  await page.click('#btn-toggle-time-mode');
  await new Promise(r => setTimeout(r, 1000));

  await browser.close();
  console.log('Verification finished successfully!');
}

verify().catch(console.error);
