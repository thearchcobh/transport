const IRISH_RAIL_URL = 'https://api.irishrail.ie/realtime/realtime.asmx/getStationDataByNameXML_withNumMins?StationDesc=Cobh&NumMins=90';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Cache-Control': 'public, max-age=60'
};

function textFromXml(parent, tagName) {
  const match = parent.match(new RegExp(`<${tagName}>(.*?)</${tagName}>`, 's'));
  return match ? match[1].trim() : null;
}

function asInt(value) {
  const number = Number(value);
  return Number.isNaN(number) ? null : number;
}

function decodeXml(value) {
  if (!value) return value;
  return value
    .replaceAll('&amp;', '&')
    .replaceAll('&lt;', '<')
    .replaceAll('&gt;', '>')
    .replaceAll('&quot;', '"')
    .replaceAll('&apos;', "'");
}

function trainFromXml(item) {
  return {
    train_code: decodeXml(textFromXml(item, 'Traincode')),
    origin: decodeXml(textFromXml(item, 'Origin')),
    destination: decodeXml(textFromXml(item, 'Destination')),
    due_in: asInt(textFromXml(item, 'Duein')),
    late: asInt(textFromXml(item, 'Late')) || 0,
    expected_arrival: decodeXml(textFromXml(item, 'Exparrival')),
    expected_departure: decodeXml(textFromXml(item, 'Expdepart')),
    scheduled_arrival: decodeXml(textFromXml(item, 'Scharrival')),
    scheduled_departure: decodeXml(textFromXml(item, 'Schdepart')),
    direction: decodeXml(textFromXml(item, 'Direction')),
    location_type: decodeXml(textFromXml(item, 'Locationtype'))
  };
}

function parseIrishRailXml(xml) {
  const items = xml.match(/<objStationData>[\s\S]*?<\/objStationData>/g) || [];

  const departures = items
    .map(trainFromXml)
    .filter(train => {
      const origin = (train.origin || '').toLowerCase();
      const destination = (train.destination || '').toLowerCase();
      const locationType = (train.location_type || '').toLowerCase();
      return origin === 'cobh' || locationType === 'o' || destination !== 'cobh';
    })
    .sort((a, b) => (a.due_in ?? 999) - (b.due_in ?? 999));

  return {
    ok: true,
    station: 'Cobh',
    source: 'Irish Rail via Cloudflare Worker',
    updated_at: new Date().toISOString(),
    message: 'Latest available station data.',
    departures
  };
}

function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data, null, 2), {
    status,
    headers: {
      ...CORS_HEADERS,
      'Content-Type': 'application/json; charset=utf-8'
    }
  });
}

export default {
  async fetch(request) {
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: CORS_HEADERS });
    }

    try {
      const response = await fetch(IRISH_RAIL_URL, {
        headers: {
          'User-Agent': 'thearchcobh-transport-board/1.0'
        }
      });

      if (!response.ok) {
        throw new Error(`Irish Rail request failed with ${response.status}`);
      }

      const xml = await response.text();
      return jsonResponse(parseIrishRailXml(xml));
    } catch (error) {
      return jsonResponse({
        ok: false,
        station: 'Cobh',
        source: 'Irish Rail via Cloudflare Worker',
        updated_at: new Date().toISOString(),
        message: `Failed to fetch train data: ${error.message}`,
        departures: []
      }, 502);
    }
  }
};
