const DATA_URL = 'data/cobh-trains.json';
const BUS_SCHEDULE_URL = 'data/cobh-connect-schedule.json';
const WORKER_URL = 'https://damp-violet-1053.jp-2b4.workers.dev/';

const departuresTable = document.getElementById('departuresTable');
const statusText = document.getElementById('statusText');
const statusDot = document.getElementById('statusDot');
const lastUpdated = document.getElementById('lastUpdated');
const busToCorkTable = document.getElementById('busToCorkTable');
const busUpdated = document.getElementById('busUpdated');

async function fetchWorkerData() {
  const response = await fetch(WORKER_URL + '?t=' + Date.now(), { cache: 'no-store' });
  if (!response.ok) throw new Error('Could not load Worker train data');
  return response.json();
}

async function fetchCachedGithubData() {
  const response = await fetch(DATA_URL + '?t=' + Date.now(), { cache: 'no-store' });
  if (!response.ok) throw new Error('Could not load cached train data');
  return response.json();
}

async function fetchBusSchedule() {
  const response = await fetch(BUS_SCHEDULE_URL + '?t=' + Date.now(), { cache: 'no-store' });
  if (!response.ok) throw new Error('Could not load Cobh Connect schedule');
  return response.json();
}

async function getTrainData() {
  try {
    return await fetchWorkerData();
  } catch (workerError) {
    const cached = await fetchCachedGithubData();
    cached.message = cached.message || 'Using cached train data.';
    cached.used_cache = true;
    return cached;
  }
}

function rowHtml(train) {
  const due = train.due_in !== null && train.due_in !== undefined ? train.due_in + ' min' : '-';
  const expected = train.expected_departure;
  const late = Number(train.late || 0);
  const status = late > 0 ? '+' + late + ' min' : 'On time';
  const statusClass = late > 0 ? 'late' : 'on-time';

  return `
    <div class="table-row">
      <div>
        <div class="destination">${train.destination || '-'}</div>
      </div>
      <div class="due">${due}</div>
      <div>${expected || '-'}</div>
      <div class="status ${statusClass}">${status}</div>
    </div>
  `;
}

function renderTrainTable(el, trains) {
  const heading = '<div class="table-row table-head"><div>Dest.</div><div>Due</div><div>Expected</div><div>Status</div></div>';

  if (!trains.length) {
    el.innerHTML = heading + '<div class="empty">No upcoming services found.</div>';
    return;
  }

  el.innerHTML = heading + trains.slice(0, 6).map(train => rowHtml(train)).join('');
}

function parseUpdatedAt(value) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function formatUpdatedAt(value) {
  const date = parseUpdatedAt(value);
  if (!date) return 'Last updated: -';
  return 'Last updated: ' + date.toLocaleTimeString('en-IE', { hour: '2-digit', minute: '2-digit' });
}

function freshnessMinutes(value) {
  const date = parseUpdatedAt(value);
  if (!date) return null;
  return Math.floor((Date.now() - date.getTime()) / 60000);
}

function updateTrainFreshness(data) {
  const age = freshnessMinutes(data.updated_at);

  if (data.ok === false || age === null) {
    statusText.textContent = 'Train updates are temporarily unavailable.';
    statusDot.className = 'status-dot error';
    return;
  }

  if (data.used_cache) {
    statusText.textContent = 'Showing cached train data. Live Worker update unavailable.';
    statusDot.className = age <= 60 ? 'status-dot warn' : 'status-dot error';
    return;
  }

  statusText.textContent = 'Showing latest available Cobh station data.';
  statusDot.className = 'status-dot ok';
}

function getDublinNow() {
  const parts = new Intl.DateTimeFormat('en-IE', {
    timeZone: 'Europe/Dublin',
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
    hour12: false, weekday: 'long'
  }).formatToParts(new Date()).reduce((acc, part) => {
    acc[part.type] = part.value;
    return acc;
  }, {});

  return {
    weekday: parts.weekday.toLowerCase(),
    minutes: Number(parts.hour) * 60 + Number(parts.minute)
  };
}

function nextDayKey(day) {
  const days = ['monday','tuesday','wednesday','thursday','friday','saturday','sunday'];
  const index = days.indexOf(day);
  return days[(index + 1) % 7];
}

function minutesFromTime(time) {
  const [h, m] = time.split(':').map(Number);
  return h * 60 + m;
}

function nextBusDepartures(scheduleData, count = 4) {
  const now = getDublinNow();
  const byDay = scheduleData.departures_by_day || {};
  const todayTimes = byDay[now.weekday] || [];
  const tomorrowTimes = byDay[nextDayKey(now.weekday)] || [];

  const futureToday = todayTimes
    .map(time => ({ time, due: minutesFromTime(time) - now.minutes }))
    .filter(row => row.due >= 0);

  let rows = futureToday;
  if (rows.length < count) {
    rows = rows.concat(tomorrowTimes.map(time => ({
      time,
      due: minutesFromTime(time) + 1440 - now.minutes
    })));
  }

  return rows.slice(0, count).map(row => ({
    destination: scheduleData.destination || 'Cork',
    route: scheduleData.route_short_name || '200',
    due: row.due,
    departure: row.time,
    stop_name: scheduleData.stop_name || 'Spy Hill'
  }));
}

function renderBusTable(el, services) {
  const heading = '<div class="table-row table-head bus-row"><div>Dest.</div><div>Due</div><div>Departure</div></div>';
  if (!services.length) {
    el.innerHTML = heading + '<div class="empty">No scheduled departures found.</div>';
    return;
  }

  el.innerHTML = heading + services.map(service => {
    const dueText = service.due >= 60 ? Math.floor(service.due / 60) + 'h ' + (service.due % 60) + 'm' : service.due + ' min';
    return `
      <div class="table-row bus-row">
        <div><div class="destination">${service.destination}</div><div class="subtext">Route ${service.route} from ${service.stop_name}</div></div>
        <div class="due">${dueText}</div>
        <div>${service.departure}</div>
      </div>
    `;
  }).join('');
}

async function loadBusBoard() {
  try {
    const scheduleData = await fetchBusSchedule();
    renderBusTable(busToCorkTable, nextBusDepartures(scheduleData));
    busUpdated.textContent = 'Scheduled from GTFS';
  } catch (error) {
    renderBusTable(busToCorkTable, []);
    busUpdated.textContent = 'Bus schedule unavailable';
  }
}

async function loadBoard() {
  try {
    const data = await getTrainData();
    const departures = data.departures || [];

    renderTrainTable(departuresTable, departures);
    lastUpdated.textContent = formatUpdatedAt(data.updated_at);
    updateTrainFreshness(data);
  } catch (error) {
    renderTrainTable(departuresTable, []);
    statusText.textContent = 'Train updates are temporarily unavailable.';
    statusDot.className = 'status-dot error';
    lastUpdated.textContent = 'Last updated: -';
  }

  loadBusBoard();
}

loadBoard();
setInterval(loadBoard, 60000);
