// app.js — Dashboard frontend + Firebase listeners + optional simulation
// IMPORTANT: This file contains your Firebase config (from your project).
// It will read data from Realtime Database and render UI live.
// Simulation will write test data into your database (use only for testing).

/* ============================
   Firebase config (your copy)
   ============================ */
const firebaseConfig = {
  apiKey: "AIzaSyARqj0_tnZoO5YDAVPxQeMh5KhhECo8J38",
  authDomain: "virtual-esp32-monitor-2dbca.firebaseapp.com",
  databaseURL: "https://virtual-esp32-monitor-2dbca-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "virtual-esp32-monitor-2dbca",
  storageBucket: "virtual-esp32-monitor-2dbca.appspot.com",
  messagingSenderId: "1083228962718",
  appId: "1:1083228962718:web:6254e39342964b9fd0208f"
};

firebase.initializeApp(firebaseConfig);
const db = firebase.database();

/* ====== UI refs ====== */
const tabs = document.querySelectorAll('.nav-btn');
const sections = document.querySelectorAll('.tab');
const startSimBtn = document.getElementById('startSim');
const stopSimBtn = document.getElementById('stopSim');

const liveTempEl = document.getElementById('live-temp');
const liveHumEl = document.getElementById('live-hum');
const liveUvEl = document.getElementById('live-uv');
const liveLightEl = document.getElementById('live-light');

const hourAvgTempEl = document.getElementById('hour-avg-temp');
const hourAvgHumEl = document.getElementById('hour-avg-hum');
const hourAvgUvEl = document.getElementById('hour-avg-uv');
const hourAvgLightEl = document.getElementById('hour-avg-light');

const hourlyTableBody = document.querySelector('#hourly-table tbody');
const historyTableBody = document.querySelector('#history-table tbody');
const dailyList = document.getElementById('daily-list');
const alertsList = document.getElementById('alerts-list');

/* ===== Sidebar nav ===== */
tabs.forEach(btn=>{
  btn.addEventListener('click', ()=>{
    tabs.forEach(b=>b.classList.remove('active'));
    btn.classList.add('active');
    const tab = btn.dataset.tab;
    sections.forEach(s => s.id === tab ? s.classList.add('active-tab') : s.classList.remove('active-tab'));
  });
});

/* ===== Utility: time keys ===== */
function getHourKeyFromTs(ts = Date.now()){
  const now = new Date(ts);
  const y = now.getFullYear();
  const m = String(now.getMonth()+1).padStart(2,'0');
  const d = String(now.getDate()).padStart(2,'0');
  const h = String(now.getHours()).padStart(2,'0');
  return `${y}-${m}-${d}-${h}`;
}
function formatHourKey(k){
  // k like 2025-12-03-14 -> readable
  return k.replace(/-/g, (i)=> i==0 ? '-' : '-').replace(/(\d{4}-\d{2}-\d{2})-(\d{2})/, '$1 $2:00');
}

/* ===== Charts (live & history) setup ===== */
const liveCtx = document.getElementById('liveChart').getContext('2d');
const historyCtx = document.getElementById('historyChart').getContext('2d');

let liveChart = new Chart(liveCtx, {
  type: 'line',
  data: {
    labels: [], // timestamps
    datasets: [
      { label: 'Temp (°C)', data: [], tension:0.3, borderWidth:2, fill:false },
      { label: 'Hum (%)', data: [], tension:0.3, borderWidth:2, fill:false },
      { label: 'UV', data: [], tension:0.3, borderWidth:2, fill:false },
      { label: 'Light (lux)', data: [], tension:0.3, borderWidth:2, fill:false }
    ]
  },
  options:{
    scales:{ x:{ display:false } },
    plugins:{ legend:{ position:'bottom' } }
  }
});

let historyChart = new Chart(historyCtx, {
  type: 'bar',
  data: { labels: [], datasets: [
    { label:'Avg Temp', data: [] , backgroundColor:'rgba(0,131,143,0.7)'},
    { label:'Avg Hum', data: [] , backgroundColor:'rgba(3,155,229,0.5)'}
  ]},
  options:{ plugins:{ legend:{ position:'bottom' } } }
});

/* ====== Listeners: Live sensor node ====== */
db.ref('sensor').on('value', snap=>{
  const v = snap.val();
  if(!v) return;
  const t = v.temperature ?? '--';
  const h = v.humidity ?? '--';
  const u = v.uv ?? '--';
  const l = v.light ?? '--';

  liveTempEl.textContent = `${t} °C`;
  liveHumEl.textContent = `${h} %`;
  liveUvEl.textContent = u;
  liveLightEl.textContent = `${l} lux`;

  // push to live chart (keep max 24 points)
  const label = new Date().toLocaleTimeString();
  if(liveChart.data.labels.length > 24){ liveChart.data.labels.shift(); liveChart.data.datasets.forEach(ds=>ds.data.shift()); }
  liveChart.data.labels.push(label);
  liveChart.data.datasets[0].data.push(Number(t));
  liveChart.data.datasets[1].data.push(Number(h));
  liveChart.data.datasets[2].data.push(Number(u));
  liveChart.data.datasets[3].data.push(Number(l));
  liveChart.update();
});

/* ====== Listener: sensor_history (hourly averages) ====== */
db.ref('sensor_history').on('value', snap=>{
  const all = snap.val() || {};
  // Build list of hour keys sorted descending (newest first)
  const keys = Object.keys(all).sort().reverse();

  // Update hourly table (show recent 24)
  hourlyTableBody.innerHTML = '';
  historyTableBody.innerHTML = '';
  historyChart.data.labels = [];
  historyChart.data.datasets[0].data = [];
  historyChart.data.datasets[1].data = [];

  const recent = keys.slice(0, 24);
  recent.forEach(key=>{
    const item = all[key] || {};
    const row = document.createElement('tr');
    const fmt = formatHourKey(key);
    row.innerHTML = `
      <td>${fmt}</td>
      <td>${item.avg_temperature ?? '--'}</td>
      <td>${item.avg_humidity ?? '--'}</td>
      <td>${item.avg_uv ?? '--'}</td>
      <td>${item.avg_light ?? '--'}</td>
    `;
    hourlyTableBody.appendChild(row);

    // also history table (chronological newest first)
    const histRow = document.createElement('tr');
    histRow.innerHTML = `<td>${fmt}</td><td>${item.avg_temperature ?? '--'}</td><td>${item.avg_humidity ?? '--'}</td><td>${item.avg_uv ?? '--'}</td><td>${item.avg_light ?? '--'}</td>`;
    historyTableBody.appendChild(histRow);

    // push for history chart (reverse the slice later)
    historyChart.data.labels.unshift(fmt);
    historyChart.data.datasets[0].data.unshift(item.avg_temperature ?? 0);
    historyChart.data.datasets[1].data.unshift(item.avg_humidity ?? 0);
  });

  historyChart.update();

  // Show current hour averages (if exists)
  const currentKey = getHourKeyFromTs();
  const current = all[currentKey] || {};
  hourAvgTempEl.textContent = (current.avg_temperature ?? '--') + (current.avg_temperature ? ' °C' : '');
  hourAvgHumEl.textContent = (current.avg_humidity ?? '--') + (current.avg_humidity ? ' %' : '');
  hourAvgUvEl.textContent = (current.avg_uv ?? '--');
  hourAvgLightEl.textContent = (current.avg_light ?? '--') + (current.avg_light ? ' lux' : '');
});

/* ====== Listener: daily_summary ====== */
db.ref('daily_summary').on('value', snap=>{
  const all = snap.val() || {};
  dailyList.innerHTML = '';
  // show last 7 days
  const days = Object.keys(all).sort().reverse().slice(0,7);
  if(days.length===0) dailyList.innerHTML = '<p>No daily summary yet.</p>';
  days.forEach(day=>{
    const d = all[day];
    const block = document.createElement('div');
    block.className = 'card small';
    block.style.marginBottom = '8px';
    block.innerHTML = `
      <h4>${day}</h4>
      <div>Avg Temp: ${d.avg_temperature ?? '--'} °C</div>
      <div>Avg Hum: ${d.avg_humidity ?? '--'} %</div>
      <div>Avg UV: ${d.avg_uv ?? '--'}</div>
      <div>Avg Light: ${d.avg_light ?? '--'} lux</div>
    `;
    dailyList.appendChild(block);
  });
});

/* ====== Listener: Alerts (derived from latest sensor) ====== */
db.ref('sensor').on('value', snap=>{
  const v = snap.val();
  if(!v){ alertsList.innerHTML = '<p>No data.</p>'; return; }
  const alerts = [];
  if(v.temperature >= 30) alerts.push('High Temperature (>=30°C)');
  if(v.humidity >= 75) alerts.push('High Humidity (>=75%)');
  if(v.uv >= 8) alerts.push('High UV Index (>=8)');
  if(v.light >= 800) alerts.push('Bright Light (>=800 lux)');

  if(alerts.length===0) alertsList.innerHTML = '<p>No alerts</p>';
  else {
    alertsList.innerHTML = '';
    alerts.forEach(a=>{
      const el = document.createElement('div');
      el.className = 'alert-badge';
      el.textContent = a;
      alertsList.appendChild(el);
    });
  }
});

/* ====== Simulation (writes test data) ====== */
/* WARNING: simulation writes to your Firebase DB. Use only for testing. */
let simInterval = null;
let simRunning = false;

// In-situ hourly buffer for simulation (ensures hourly averages are written similarly to server logic)
let simHourlyBuffer = { temperature: [], humidity: [], uv: [], light: [] };
let simCurrentHour = new Date().getHours();

function simProcessHourlyData(){
  const prevHour = getHourKeyFromTs(new Date().setHours(simCurrentHour));
  const hourData = {};
  ['temperature','humidity','uv','light'].forEach(p=>{
    const arr = simHourlyBuffer[p];
    const avg = arr.length>0 ? arr.reduce((a,b)=>a+b,0)/arr.length : 0;
    hourData[`avg_${p}`] = parseFloat(avg.toFixed(2));
    // update daily summary
    const dateKey = (new Date()).toISOString().slice(0,10);
    const dailyRef = db.ref(`daily_summary/${dateKey}/${p}_hourly`);
    dailyRef.push(avg);
    dailyRef.once('value', s=>{
      const vals = s.val() ? Object.values(s.val()) : [];
      const dailyAvg = vals.reduce((a,b)=>a+b,0)/vals.length;
      db.ref(`daily_summary/${dateKey}`).update({ [`avg_${p}`]: parseFloat(dailyAvg.toFixed(2)) });
    });
  });
  db.ref(`sensor_history/${prevHour}`).set(hourData);
  simHourlyBuffer = { temperature: [], humidity: [], uv: [], light: [] };
}

function startSimulation(intervalMs = 10000){
  if(simRunning) return;
  simRunning = true;
  simInterval = setInterval(()=>{
    const temp = parseFloat((20 + Math.random()*10).toFixed(1));
    const hum = parseFloat((50 + Math.random()*30).toFixed(1));
    const uv = parseFloat((0 + Math.random()*11).toFixed(1));
    const light = parseFloat((100 + Math.random()*900).toFixed(1));

    // write live sensor node
    db.ref('sensor').set({ temperature: temp, humidity: hum, uv: uv, light: light });

    // buffer for hourly averages (simulation side)
    simHourlyBuffer.temperature.push(temp);
    simHourlyBuffer.humidity.push(hum);
    simHourlyBuffer.uv.push(uv);
    simHourlyBuffer.light.push(light);

    const nowHour = new Date().getHours();
    // update running avg to sensor_history/currentHour (so you see live hourly avg)
    const currentHourKey = getHourKeyFromTs();
    const avgData = {};
    ['temperature','humidity','uv','light'].forEach(p=>{
      const arr = simHourlyBuffer[p];
      const avg = arr.length>0 ? arr.reduce((a,b)=>a+b,0)/arr.length : 0;
      avgData[`avg_${p}`] = parseFloat(avg.toFixed(2));
    });
    db.ref(`sensor_history/${currentHourKey}`).set(avgData);

    // finalize previous hour if changed
    if(nowHour !== simCurrentHour){
      simProcessHourlyData();
      simCurrentHour = nowHour;
    }

  }, intervalMs);
}

function stopSimulation(){
  if(simInterval) clearInterval(simInterval);
  simRunning = false;
  simInterval = null;
}

startSimBtn.addEventListener('click', ()=>startSimulation(10000));
stopSimBtn.addEventListener('click', ()=>stopSimulation());

/* ====== Small helper: ensure initial UI state if DB empty ====== */
(function init(){
  // request initial sensor data; if none, show placeholder
  db.ref('sensor').once('value', snap=>{
    if(!snap.exists()){
      liveTempEl.textContent = '-- °C';
      liveHumEl.textContent = '-- %';
      liveUvEl.textContent = '--';
      liveLightEl.textContent = '-- lux';
    }
  });

  // disable stopSim initially
  stopSimBtn.disabled = false;
})();