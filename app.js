const DATA_URL = 'data/cobh-trains.json';

const departuresTable = document.getElementById('departuresTable');
const arrivalsTable = document.getElementById('arrivalsTable');
const departureCount = document.getElementById('departureCount');
const arrivalCount = document.getElementById('arrivalCount');
const statusText = document.getElementById('statusText');
const statusDot = document.getElementById('statusDot');
const lastUpdated = document.getElementById('lastUpdated');
const busToCorkTable = document.getElementById('busToCorkTable');
const busToCobhTable = document.getElementById('busToCobhTable');
const busUpdated = document.getElementById('busUpdated');

const BUS_SCHEDULES = {
  weekday: {
    toCork: ['05:50','06:20','06:50','07:20','07:50','08:20','08:50','09:20','09:50','10:20','10:50','11:20','11:50','12:20','12:50','13:20','13:50','14:20','14:50','15:20','15:50','16:20','16:50','17:20','17:50','18:20','18:50','19:20','19:50','20:20','20:50','21:20','21:50','22:20','22:50','23:20','23:35'],
    toCobh: ['06:55','07:25','07:55','08:25','08:55','09:25','09:55','10:25','10:55','11:25','11:55','12:25','12:55','13:25','13:55','14:25','14:55','15:25','15:55','16:25','16:55','17:25','17:55','18:25','18:55','19:25','19:55','20:25','20:55','21:25','21:55','22:25','22:55','23:25','23:55']
  },
  saturday: {
    toCork: ['07:50','08:20','08:50','09:20','09:50','10:20','10:50','11:20','11:50','12:20','12:50','13:20','13:50','14:20','14:50','15:20','15:50','16:20','16:50','17:20','17:50','18:20','18:50','19:20','19:50','20:20','20:50','21:20','21:50','22:20','22:50','23:20','23:35'],
    toCobh: ['08:55','09:25','09:55','10:25','10:55','11:25','11:55','12:25','12:55','13:25','13:55','14:25','14:55','15:25','15:55','16:25','16:55','17:25','17:55','18:25','18:55','19:25','19:55','20:25','20:55','21:25','21:55','22:25','22:55','23:25','23:55']
  },
  sunday: {
    toCork: ['07:50','08:50','09:50','10:50','11:50','12:50','13:50','14:50','15:50','16:50','17:50','18:50','19:50','20:50','21:50','22:35'],
    toCobh: ['08:55','09:55','10:55','11:55','12:55','13:55','14:55','15:55','16:55','17:55','18:55','19:55','20:55','21:55','22:55','23:40']
  }
};

function rowHtml(train, type) {
  const place = type === 'departure' ? train.destination : train.origin;
  const labelClass = type === 'departure' ? 'destination' : 'origin';
  const due = train.due_in !== null && train.due_in !== undefined ? train.due_in + ' min' : '-';
  const expected = type === 'departure' ? train.expected_departure : train.expected_arrival;
  const scheduled = type === 'departure' ? train.scheduled_departure : train.scheduled_arrival;
  const late = Number(train.late || 0);
  const status = late > 0 ? '+' + late + ' min' : 'On time';
  const statusClass = late > 0 ? 'late' : 'on-time';

  return `
    <div class="table-row">
      <div>
        <div class="${labelClass}">${place || '-'}</div>
        <div class="subtext">Scheduled: ${scheduled || '-'}</div>
      </div>
      <div class="due">${due}</div>
      <div>${expected || '-'}</div>
      <div class="status ${statusClass}">${status}</div>
    </div>
  `;
}

function renderTable(el, trains, type) {
  const heading = type === 'departure'
    ? '<div class="table-row table-head"><div>Destination</div><div>Due</div><div>Expected</div><div>Status</div></div>'
    : '<div class="table-row table-head"><div>Origin</div><div>Due</div><div>Expected</div><div>Status</div></div>';

  if (!trains.length) {
    el.innerHTML = heading + '<div class="empty">No upcoming services found.</div>';
    return;
  }

  el.innerHTML = heading + trains.slice(0, 6).map(train => rowHtml(train, type)).join('');
}

function formatUpdatedAt(value) {
  if (!value) return 'Last updated: -';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Last updated: ' + value;
  return 'Last updated: ' + date.toLocaleTimeString('en-IE', { hour: '2-digit', minute: '2-digit' });
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

function nextBusDepartures(times, destination, count = 4) {
  const now = getDublinNow();
  const todayKey = serviceDayKey(now.weekday);
  const tomorrowKey = todayKey === 'weekday' ? 'weekday' : (todayKey === 'saturday' ? 'sunday' : 'weekday');
  const todayRows = times.map(time => ({ time, due: minutesFromTime(time) - now.minutes }));
  const futureToday = todayRows.filter(row => row.due >= 0);

  let rows = futureToday;
  if (rows.length < count) {
    const tomorrowTimes = BUS_SCHEDULES[tomorrowKey][destination === 'Cork' ? 'toCork' : 'toCobh'];
    rows = rows.concat(tomorrowTimes.map(time => ({ time, due: minutesFromTime(time) + 1440 - now.minutes })));
  }

  return rows.slice(0, count).map(row => ({
    destination,
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

  renderBusTable(busToCorkTable, nextBusDepartures(schedule.toCork, 'Cork'));
  renderBusTable(busToCobhTable, nextBusDepartures(schedule.toCobh, 'Cobh'));
  busUpdated.textContent = 'Scheduled';
}

async function loadBoard() {
  try {
    const response = await fetch(DATA_URL + '?t=' + Date.now(), { cache: 'no-store' });
    if (!response.ok) throw new Error('Could not load train data');
    const data = await response.json();

    const departures = data.departures || [];
    const arrivals = data.arrivals || [];

    renderTable(departuresTable, departures, 'departure');
    renderTable(arrivalsTable, arrivals, 'arrival');

    departureCount.textContent = departures.length + ' found';
    arrivalCount.textContent = arrivals.length + ' found';
    lastUpdated.textContent = formatUpdatedAt(data.updated_at);

    if (data.ok === false) {
      statusText.textContent = 'Train updates are temporarily unavailable.';
      statusDot.className = 'status-dot error';
    } else {
      statusText.textContent = 'Showing latest available Cobh station data.';
      statusDot.className = 'status-dot ok';
    }
  } catch (error) {
    renderTable(departuresTable, [], 'departure');
    renderTable(arrivalsTable, [], 'arrival');
    departureCount.textContent = '-';
    arrivalCount.textContent = '-';
    statusText.textContent = 'Train updates are temporarily unavailable.';
    statusDot.className = 'status-dot error';
    lastUpdated.textContent = 'Last updated: -';
  }

  loadBusBoard();
}

loadBoard();
setInterval(loadBoard, 60000);
