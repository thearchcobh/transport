const DATA_URL = 'data/cobh-trains.json';

const departuresTable = document.getElementById('departuresTable');
const statusText = document.getElementById('statusText');
const statusDot = document.getElementById('statusDot');
const lastUpdated = document.getElementById('lastUpdated');
const busToCorkTable = document.getElementById('busToCorkTable');
const busUpdated = document.getElementById('busUpdated');

const BUS_SCHEDULES = {
  weekday: {
    toCork: ['05:50','06:20','06:50','07:20','07:50','08:20','08:50','09:20','09:50','10:20','10:50','11:20','11:50','12:20','12:50','13:20','13:50','14:20','14:50','15:20','15:50','16:20','16:50','17:20','17:50','18:20','18:50','19:20','19:50','20:20','20:50','21:20','21:50','22:20','22:50','23:20','23:35']
  },
  saturday: {
    toCork: ['07:50','08:20','08:50','09:20','09:50','10:20','10:50','11:20','11:50','12:20','12:50','13:20','13:50','14:20','14:50','15:20','15:50','16:20','16:50','17:20','17:50','18:20','18:50','19:20','19:50','20:20','20:50','21:20','21:50','22:20','22:50','23:20','23:35']
  },
  sunday: {
    toCork: ['07:50','08:50','09:50','10:50','11:50','12:50','13:50','14:50','15:50','16:50','17:50','18:50','19:50','20:50','21:50','22:35']
  }
};

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
  const heading = '<div class="table-row table-head"><div>Destination</div><div>Due</div><div>Expected</div><div>Status</div></div>';

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

  if (age <= 20) {
    statusText.textContent = 'Showing latest available Cobh station data.';
    statusDot.className = 'status-dot ok';
    return;
  }

  if (age <= 60) {
    statusText.textContent = 'Train data may be delayed.';
    statusDot.className = 'status-dot warn';
    return;
  }

  statusText.textContent = 'Train data is out of date.';
  statusDot.className = 'status-dot error';
}

function getDublinNow() {
  const parts = new Intl.DateTimeFormat('en-IE', {
    timeZone: 'Europe/Dublin',
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
    hour12: false, weekday: 'short'
  }).formatToParts(new Date()).reduce((acc, part) => {
    acc[part.type] = part.value;
    return acc;
  }, {});

  return {
    weekday: parts.weekday,
    minutes: Number(parts.hour) * 60 + Number(parts.minute)
  };
}

function serviceDayKey(weekday) {
  if (weekday === 'Sat') return 'saturday';
  if (weekday === 'Sun') return 'sunday';
  return 'weekday';
}

function minutesFromTime(time) {
  const [h, m] = time.split(':').map(Number);
  return h * 60 + m;
}

function nextBusDepartures(times, count = 4) {
  const now = getDublinNow();
  const todayKey = serviceDayKey(now.weekday);
  const tomorrowKey = todayKey === 'weekday' ? 'weekday' : (todayKey === 'saturday' ? 'sunday' : 'weekday');
  const todayRows = times.map(time => ({ time, due: minutesFromTime(time) - now.minutes }));
  const futureToday = todayRows.filter(row => row.due >= 0);

  let rows = futureToday;
  if (rows.length < count) {
    const tomorrowTimes = BUS_SCHEDULES[tomorrowKey].toCork;
    rows = rows.concat(tomorrowTimes.map(time => ({ time, due: minutesFromTime(time) + 1440 - now.minutes })));
  }

  return rows.slice(0, count).map(row => ({
    destination: 'Cork',
    due: row.due,
    departure: row.time
  }));
}

function renderBusTable(el, services) {
  const heading = '<div class="table-row table-head bus-row"><div>Destination</div><div>Due</div><div>Departure</div></div>';
  if (!services.length) {
    el.innerHTML = heading + '<div class="empty">No scheduled departures found.</div>';
    return;
  }

  el.innerHTML = heading + services.map(service => {
    const dueText = service.due >= 60 ? Math.floor(service.due / 60) + 'h ' + (service.due % 60) + 'm' : service.due + ' min';
    return `
      <div class="table-row bus-row">
        <div><div class="destination">${service.destination}</div><div class="subtext">Route 200</div></div>
        <div class="due">${dueText}</div>
        <div>${service.departure}</div>
      </div>
    `;
  }).join('');
}

function loadBusBoard() {
  const now = getDublinNow();
  const key = serviceDayKey(now.weekday);
  const schedule = BUS_SCHEDULES[key];

  renderBusTable(busToCorkTable, nextBusDepartures(schedule.toCork));
  busUpdated.textContent = 'Scheduled';
}

async function loadBoard() {
  try {
    const response = await fetch(DATA_URL + '?t=' + Date.now(), { cache: 'no-store' });
    if (!response.ok) throw new Error('Could not load train data');
    const data = await response.json();

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
