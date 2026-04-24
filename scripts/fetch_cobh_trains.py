import json
import os
import urllib.request
import xml.etree.ElementTree as ET
from datetime import datetime, timezone

API_URL = 'https://api.irishrail.ie/realtime/realtime.asmx/getStationDataByNameXML_withNumMins?StationDesc=Cobh&NumMins=90'
OUTPUT_PATH = os.path.join('data', 'cobh-trains.json')
NS = {'ir': 'http://api.irishrail.ie/realtime/'}


def text(item, name):
    node = item.find(f'ir:{name}', NS)
    if node is None or node.text is None:
        return None
    return node.text.strip()


def as_int(value):
    try:
        return int(value)
    except (TypeError, ValueError):
        return None


def train_from_item(item):
    return {
        'train_code': text(item, 'Traincode'),
        'origin': text(item, 'Origin'),
        'destination': text(item, 'Destination'),
        'due_in': as_int(text(item, 'Duein')),
        'late': as_int(text(item, 'Late')) or 0,
        'expected_arrival': text(item, 'Exparrival'),
        'expected_departure': text(item, 'Expdepart'),
        'scheduled_arrival': text(item, 'Scharrival'),
        'scheduled_departure': text(item, 'Schdepart'),
        'direction': text(item, 'Direction'),
        'location_type': text(item, 'Locationtype'),
    }


def fetch_trains():
    request = urllib.request.Request(API_URL, headers={'User-Agent': 'thearchcobh-transport-board/1.0'})
    with urllib.request.urlopen(request, timeout=20) as response:
        xml_bytes = response.read()

    root = ET.fromstring(xml_bytes)
    trains = [train_from_item(item) for item in root.findall('ir:objStationData', NS)]

    departures = []
    arrivals = []

    for train in trains:
        destination = (train.get('destination') or '').strip().lower()
        origin = (train.get('origin') or '').strip().lower()
        location_type = (train.get('location_type') or '').strip().lower()

        if origin == 'cobh' or location_type == 'o':
            departures.append(train)
        elif destination == 'cobh' or location_type == 'd':
            arrivals.append(train)
        else:
            departures.append(train)

    departures.sort(key=lambda item: item.get('due_in') if item.get('due_in') is not None else 999)
    arrivals.sort(key=lambda item: item.get('due_in') if item.get('due_in') is not None else 999)

    return {
        'ok': True,
        'station': 'Cobh',
        'source': 'Irish Rail real-time API',
        'updated_at': datetime.now(timezone.utc).isoformat(),
        'message': 'Latest available station data.',
        'departures': departures,
        'arrivals': arrivals,
    }


def main():
    os.makedirs(os.path.dirname(OUTPUT_PATH), exist_ok=True)

    try:
        data = fetch_trains()
    except Exception as exc:
        data = {
            'ok': False,
            'station': 'Cobh',
            'source': 'Irish Rail real-time API',
            'updated_at': datetime.now(timezone.utc).isoformat(),
            'message': f'Failed to fetch train data: {exc}',
            'departures': [],
            'arrivals': [],
        }

    with open(OUTPUT_PATH, 'w', encoding='utf-8') as handle:
        json.dump(data, handle, ensure_ascii=False, indent=2)
        handle.write('\n')


if __name__ == '__main__':
    main()
