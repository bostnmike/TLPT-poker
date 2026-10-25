#!/usr/bin/env python3
"""Compact, auditable factual-stat source; never changes career awards or ratings."""
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent


def build():
    read = lambda path: json.loads((ROOT / path).read_text())
    formats = read('data/event-formats.json')['events']
    history = read('data/generated/event-history.json')['events']
    archive = read('knockout-events-full.json')
    financials = read('data/event-financials.json')['events']
    events = []
    for event in history:
        event_id = event['eventId']
        format_key = formats.get(event_id)
        if format_key not in ('single', 'mtt'):
            raise ValueError(f'{event_id}: set single or mtt in data/event-formats.json')
        # Count actual players, never entries (which include rebuys).
        if format_key == 'single' and event['summary']['buyIns'] > 9:
            raise ValueError(f'{event_id}: single-table classification exceeds nine players')
        bounty = bool(financials.get(event_id, {}).get('bounty', {}).get('amount', 0))
        if bounty != bool(event['summary'].get('bounty', {}).get('amount', 0)):
            raise ValueError(f'{event_id}: bounty classification disagrees with audited summary')
        events.append(dict(eventId=event_id, format=format_key, bounty=bounty,
                           players=event['players'], knockouts=archive[event_id]))
    output = ROOT / 'data/generated/stat-events.json'
    output.write_text(json.dumps({'version': 1, 'events': events}, separators=(',', ':')) + '\n')
    print(f'Wrote {output}: {len(events)} classified events')


if __name__ == '__main__':
    build()
