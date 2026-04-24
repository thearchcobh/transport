const DATA_URL = 'data/cobh-trains.json';

const departuresTable = document.getElementById('departuresTable');
const arrivalsTable = document.getElementById('arrivalsTable');
const departureCount = document.getElementById('departureCount');
const arrivalCount = document.getElementById('arrivalCount');
const statusText = document.getElementById('statusText');
const statusDot = document.getElementById('statusDot');
const lastUpdated = document.getElementById('lastUpdated');

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
}

loadBoard();
setInterval(loadBoard, 60000);
