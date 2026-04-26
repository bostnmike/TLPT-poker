#!/usr/bin/env python3

import json
import re
from datetime import datetime
from html import unescape
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DATA_DIR = ROOT / "data"
RAW_EVENTS_DIR = DATA_DIR / "raw" / "events"
PARSED_EVENTS_DIR = DATA_DIR / "parsed" / "events"
METADATA_PATH = DATA_DIR / "player-metadata.json"
CONFIG_PATH = DATA_DIR / "league-config.json"

TIMESTAMP_RE = r'(\d{1,2}:\d{2}:\d{2}\s+[ap]m\s+\d{2}/\d{2}/\d{4})'

# -------------------------------------------------------------------
# HARD-CODED LEAGUE OVERRIDES
# -------------------------------------------------------------------
# These are the known edge-case events that must override imperfect TD text.
#
# Rules encoded here:
# - Only one credited hitman per elimination
# - Chops create NO final bust-out and NO final hit
# - Specific known source-text ambiguities are normalized here
# -------------------------------------------------------------------
EVENT_OVERRIDES = {
    "2025-06-28": {
        "force_single_killer": {
            # victim_slug: killer_slug
            "gilmore": "nasa-al",
        },
        "chop_finalists": []
    },
    "2026-01-24": {
        "force_single_killer": {},
        "chop_finalists": ["bostnmike", "red"]
    },
    "2026-01-30": {
        "force_single_killer": {},
        "chop_finalists": ["bostnmike", "wild-bill"]
    },
    "2026-02-21": {
        "force_single_killer": {},
        "chop_finalists": ["ahmed", "bostnmike"]
    },
    "2026-03-07": {
        "force_single_killer": {},
        "chop_finalists": ["cougar", "providencemike", "nasa-al"]
    },
    "2026-03-28": {
        # This event is intentionally left alone.
        "force_single_killer": {},
        "chop_finalists": []
    },
    "2026-04-17": {
        "force_single_killer": {},
        "chop_finalists": ["ahmed", "hiro"]
    }
}


def load_json(path: Path):
    with path.open("r", encoding="utf-8") as f:
        return json.load(f)


def normalize(value):
    return str(value or "").strip().lower()


def slugify_name(name):
    return (
        str(name or "")
        .strip()
        .lower()
        .replace("&", "and")
        .replace(".", "")
        .replace("'", "")
        .replace('"', "")
        .replace("-", "")
        .replace(" ", "")
    )


def safe_int(value, default=0):
    if value is None:
        return default
    text = str(value).strip().replace(",", "").replace("$", "").replace("%", "")
    if not text:
        return default
    try:
        return int(round(float(text)))
    except ValueError:
        return default


def parse_currency_to_int(text):
    return safe_int(text, 0)


def build_alias_map(metadata_players):
    alias_map = {}
    for player in metadata_players:
        alias_map[normalize(player["name"])] = player
        alias_map[normalize(player["slug"])] = player
        for alias in player.get("aliases", []):
            alias_map[normalize(alias)] = player
    return alias_map


def canonicalize_player_name(raw_name, alias_map):
    cleaned = normalize(unescape(raw_name).replace("\xa0", " "))
    cleaned = re.sub(r"\s+", " ", cleaned).strip()

    player = alias_map.get(cleaned)
    if player:
        return player["name"], player["slug"]

    cleaned_loose = slugify_name(cleaned)
    for key, value in alias_map.items():
        if slugify_name(key) == cleaned_loose:
            return value["name"], value["slug"]

    raise RuntimeError(f"Could not map player name from event report: {raw_name}")


def split_killer_names(raw_killer_text):
    text = str(raw_killer_text or "").strip()
    if not text:
        return []

    text = re.sub(r"\s+\band\b\s+", ",", text, flags=re.IGNORECASE)
    return [part.strip() for part in text.split(",") if part.strip()]


def strip_tags(html_fragment):
    text = re.sub(r"<br\s*/?>", "\n", html_fragment, flags=re.IGNORECASE)
    text = re.sub(r"<[^>]+>", "", text)
    return unescape(text).replace("\r", "").strip()


def extract_title(html):
    patterns = [
        r"<title>(.*?)</title>",
        r'<div class="eventname">(.*?)</div>',
    ]
    for pattern in patterns:
        m = re.search(pattern, html, flags=re.IGNORECASE | re.DOTALL)
        if m:
            return unescape(strip_tags(m.group(1))).strip()
    return "Untitled Event"


def extract_action_lines(html):
    m = re.search(
        r'<td class="text">(.*?)</td>',
        html,
        flags=re.IGNORECASE | re.DOTALL
    )
    if not m:
        return []
    raw = strip_tags(m.group(1))
    return [line.strip() for line in raw.split("\n") if line.strip()]


def extract_fieldvalue_after_label(html, label):
    pattern = (
        rf'<td class="fieldname">\s*{re.escape(label)}\s*</td>\s*'
        rf'<td class="fieldvalue[^"]*">\s*(.*?)\s*</td>'
    )
    m = re.search(pattern, html, flags=re.IGNORECASE | re.DOTALL)
    return strip_tags(m.group(1)) if m else ""


def extract_takein_count(html, label):
    pattern = (
        rf'<td class="fieldname">\s*{re.escape(label)}\s*</td>\s*'
        rf'<td class="fieldvalue">\s*\$?([^<]*)\s*</td>\s*'
        rf'<td class="fieldvalue">\s*\((\d+)\)\s*</td>'
    )
    m = re.search(pattern, html, flags=re.IGNORECASE | re.DOTALL)
    if not m:
        return 0
    return safe_int(m.group(2), 0)


def extract_total_pot(html):
    m = re.search(
        r"Total pot:\s*\$([0-9,]+(?:\.\d{2})?)",
        html,
        flags=re.IGNORECASE
    )
    if m:
        return parse_currency_to_int(m.group(1))

    matches = re.findall(
        r'<td class="fieldname">Total:</td>\s*<td class="fieldvalue">\s*\$([0-9,]+(?:\.\d{2})?)\s*</td>',
        html,
        flags=re.IGNORECASE | re.DOTALL
    )
    if matches:
        return parse_currency_to_int(matches[-1])

    return 0


def extract_paid_spots(html):
    pattern = (
        r'<td class="fieldname">Percentage:</td>\s*'
        r'<td class="fieldvalue">\s*\$[^<]*</td>\s*'
        r'<td class="fieldvalue">\s*\((\d+)\)\s*</td>'
    )
    m = re.search(pattern, html, flags=re.IGNORECASE | re.DOTALL)
    if m:
        return safe_int(m.group(1), 0)
    return 0


def parse_datetime_from_summary(text):
    text = str(text or "").strip()
    if not text:
        return ""
    try:
        cleaned = re.sub(r"\b(am|pm)\b", lambda m: m.group(1).upper(), text, flags=re.IGNORECASE)
        dt = datetime.strptime(cleaned, "%I:%M:%S %p %m/%d/%Y")
        return dt.isoformat()
    except ValueError:
        return text


def parse_payout_line(line, alias_map):
    m = re.match(
        rf'^{TIMESTAMP_RE}:\s*(.*?)\s+ranked\s+(\d+)(?:st|nd|rd|th),\s+received\s+\$([0-9,]+(?:\.\d{{2}})?)\s*$',
        line,
        flags=re.IGNORECASE
    )
    if not m:
        return None

    timestamp = m.group(1).strip()
    raw_name = m.group(2).strip()
    rank = safe_int(m.group(3))
    payout = parse_currency_to_int(m.group(4))
    name, slug = canonicalize_player_name(raw_name, alias_map)

    return {
        "type": "payout",
        "time_raw": timestamp,
        "player": name,
        "slug": slug,
        "rank": rank,
        "payout": payout
    }


def parse_action_line(line, alias_map):
    payout = parse_payout_line(line, alias_map)
    if payout:
        return payout

    m = re.match(rf'^{TIMESTAMP_RE}:\s*Tournament started\s*$', line, flags=re.IGNORECASE)
    if m:
        return {"type": "tournament_started", "time_raw": m.group(1).strip()}

    m = re.match(rf'^{TIMESTAMP_RE}:\s*Tournament ended\s*$', line, flags=re.IGNORECASE)
    if m:
        return {"type": "tournament_ended", "time_raw": m.group(1).strip()}

    m = re.match(rf'^{TIMESTAMP_RE}:\s*Total pot:\s*\$([0-9,]+(?:\.\d{{2}})?)\s*$', line, flags=re.IGNORECASE)
    if m:
        return {
            "type": "total_pot",
            "time_raw": m.group(1).strip(),
            "totalPot": parse_currency_to_int(m.group(2))
        }

    m = re.match(rf'^{TIMESTAMP_RE}:\s*(.*?)\s+bought-in\s*$', line, flags=re.IGNORECASE)
    if m:
        name, slug = canonicalize_player_name(m.group(2).strip(), alias_map)
        return {
            "type": "buyin",
            "time_raw": m.group(1).strip(),
            "player": name,
            "slug": slug
        }

    m = re.match(rf'^{TIMESTAMP_RE}:\s*(.*?)\s+rebought\s*$', line, flags=re.IGNORECASE)
    if m:
        name, slug = canonicalize_player_name(m.group(2).strip(), alias_map)
        return {
            "type": "rebuy",
            "time_raw": m.group(1).strip(),
            "player": name,
            "slug": slug
        }

    m = re.match(rf'^{TIMESTAMP_RE}:\s*(.*?)\s+was busted out by\s+(.*?)\s*$', line, flags=re.IGNORECASE)
    if m:
        busted_name, busted_slug = canonicalize_player_name(m.group(2).strip(), alias_map)

        killer_names_raw = split_killer_names(m.group(3).strip())
        if not killer_names_raw:
            raise RuntimeError(f"Could not parse killer name(s) from event report line: {line}")

        # HARD RULE: only one credited hitman, always first listed
        chosen_raw_killer = killer_names_raw[0]
        killer_name, killer_slug = canonicalize_player_name(chosen_raw_killer, alias_map)

        return {
            "type": "bustout",
            "time_raw": m.group(1).strip(),
            "player": busted_name,
            "slug": busted_slug,
            "by": killer_name,
            "bySlug": killer_slug,
            "rawKillerText": m.group(3).strip(),
            "sharedKillerSource": len(killer_names_raw) > 1
        }

    m = re.match(rf'^{TIMESTAMP_RE}:\s*(.*?)\s+busted out\s*$', line, flags=re.IGNORECASE)
    if m:
        name, slug = canonicalize_player_name(m.group(2).strip(), alias_map)
        return {
            "type": "bustout_uncredited",
            "time_raw": m.group(1).strip(),
            "player": name,
            "slug": slug
        }

    return {
        "type": "unparsed",
        "raw": line
    }


def apply_event_specific_overrides(event_date, parsed_actions, payouts):
    warnings = []
    overrides = EVENT_OVERRIDES.get(event_date, {})
    force_single_killer = overrides.get("force_single_killer", {})
    chop_finalists = set(overrides.get("chop_finalists", []))

    cleaned_actions = list(parsed_actions)

    # Force known victim->killer corrections
    if force_single_killer:
        for action in cleaned_actions:
            if action.get("type") != "bustout":
                continue

            victim_slug = action.get("slug")
            if victim_slug in force_single_killer:
                forced_killer_slug = force_single_killer[victim_slug]
                action["bySlug"] = forced_killer_slug
                action["by"] = forced_killer_slug
                warnings.append(
                    f"{event_date}: forced credited killer for victim {victim_slug} -> {forced_killer_slug}"
                )

    # Enforce explicit chop finalists for known dates
    if chop_finalists:
        for idx, action in enumerate(cleaned_actions):
            if action is None:
                continue
            if action.get("type") not in {"bustout", "bustout_uncredited"}:
                continue
            if action.get("slug") in chop_finalists:
                cleaned_actions[idx] = None
                warnings.append(
                    f"{event_date}: removed bustout for chopped finalist {action.get('slug')} at {action.get('time_raw', 'unknown time')}"
                )

        cleaned_actions = [action for action in cleaned_actions if action is not None]
        return cleaned_actions, warnings

    # Generic chop handling fallback:
    # if multiple players are ranked 1st, remove the terminal bustout for those players
    first_place_slugs = [p["slug"] for p in payouts if p.get("rank") == 1]
    if len(first_place_slugs) >= 2:
        for chopped_slug in first_place_slugs:
            last_reentry_idx = -1
            last_bust_idx = -1

            for idx, action in enumerate(cleaned_actions):
                if not action or action.get("slug") != chopped_slug:
                    continue

                if action.get("type") in {"buyin", "rebuy"}:
                    last_reentry_idx = idx

                if action.get("type") in {"bustout", "bustout_uncredited"}:
                    last_bust_idx = idx

            if last_bust_idx > last_reentry_idx >= -1:
                removed = cleaned_actions[last_bust_idx]
                cleaned_actions[last_bust_idx] = None
                warnings.append(
                    f"{event_date}: generic chop handling removed terminal bustout for {chopped_slug} at {removed.get('time_raw', 'unknown time')}"
                )

        cleaned_actions = [action for action in cleaned_actions if action is not None]

    return cleaned_actions, warnings


def build_empty_player_record(meta_player):
    return {
        "name": meta_player["name"],
        "slug": meta_player["slug"],
        "buyIns": 0,
        "rebuys": 0,
        "entries": 0,
        "hits": 0,
        "timesPlaced": 0,
        "bubbles": 0,
        "totalCost": 0,
        "totalWinnings": 0,
        "profit": 0
    }


def derive_event_player_stats(metadata_players, parsed_actions, payouts, buy_in_amount):
    player_map = {p["slug"]: build_empty_player_record(p) for p in metadata_players}

    for action in parsed_actions:
        action_type = action["type"]

        if action_type == "buyin":
            player_map[action["slug"]]["buyIns"] += 1
        elif action_type == "rebuy":
            player_map[action["slug"]]["rebuys"] += 1
        elif action_type == "bustout":
            if action.get("bySlug"):
                player_map[action["bySlug"]]["hits"] += 1

    paid_slugs = set()
    for payout in payouts:
        slug = payout["slug"]
        player_map[slug]["timesPlaced"] += 1
        player_map[slug]["totalWinnings"] += payout["payout"]
        paid_slugs.add(slug)

    for record in player_map.values():
        record["entries"] = record["buyIns"] + record["rebuys"]
        record["totalCost"] = record["entries"] * buy_in_amount
        record["profit"] = record["totalWinnings"] - record["totalCost"]

    bustout_actions = [
        a for a in parsed_actions
        if a["type"] in {"bustout", "bustout_uncredited"}
    ]

    last_reentry_index = {}
    for idx, action in enumerate(parsed_actions):
        if action["type"] in {"buyin", "rebuy"}:
            last_reentry_index[action["slug"]] = idx

    last_bustout_index = {}
    for idx, action in enumerate(parsed_actions):
        if action["type"] in {"bustout", "bustout_uncredited"}:
            last_bustout_index[action["slug"]] = idx

    permanent_out_noncashers = []
    for slug, bust_idx in last_bustout_index.items():
        if slug in paid_slugs:
            continue
        if bust_idx > last_reentry_index.get(slug, -1):
            permanent_out_noncashers.append((bust_idx, slug))

    permanent_out_noncashers.sort(key=lambda x: x[0])

    if permanent_out_noncashers:
        bubble_slug = permanent_out_noncashers[-1][1]
        if bubble_slug in player_map:
            player_map[bubble_slug]["bubbles"] = 1

    return player_map, paid_slugs, permanent_out_noncashers


def parse_report_file(path: Path, alias_map, metadata_players, buy_in_amount):
    html = path.read_text(encoding="utf-8", errors="ignore")

    title = extract_title(html)
    action_lines = extract_action_lines(html)
    parsed_actions = [parse_action_line(line, alias_map) for line in action_lines]

    summary_start = extract_fieldvalue_after_label(html, "Tournament start time:")
    summary_end = extract_fieldvalue_after_label(html, "Tournament end time:")
    first_out = extract_fieldvalue_after_label(html, "First player out:")
    first_perm_out = extract_fieldvalue_after_label(html, "First player permanently out:")
    winner_text = extract_fieldvalue_after_label(html, "Winner:")

    buyins_count = extract_takein_count(html, "Buy-ins:")
    rebuys_count = extract_takein_count(html, "Rebuys:")
    entries_count = buyins_count + rebuys_count
    total_pot = extract_total_pot(html)
    paid_spots = extract_paid_spots(html)

    payouts = [a for a in parsed_actions if a["type"] == "payout"]

    iso_start = parse_datetime_from_summary(summary_start)
    if iso_start and "T" in iso_start:
        event_date = iso_start.split("T")[0]
    elif re.match(r"\d{4}-\d{2}-\d{2}", path.stem):
        event_date = path.stem
    else:
        event_date = path.stem

    shared_killer_warnings = []
    for action in parsed_actions:
        if action.get("type") == "bustout" and action.get("sharedKillerSource"):
            shared_killer_warnings.append(
                f"{event_date}: shared killer source reduced to first listed killer only: {action.get('rawKillerText', '')}"
            )

    parsed_actions, override_warnings = apply_event_specific_overrides(event_date, parsed_actions, payouts)

    player_stats, paid_slugs, permanent_out_noncashers = derive_event_player_stats(
        metadata_players=metadata_players,
        parsed_actions=parsed_actions,
        payouts=payouts,
        buy_in_amount=buy_in_amount
    )

    warnings = []
    warnings.extend(shared_killer_warnings)
    warnings.extend(override_warnings)

    action_buyins = sum(1 for a in parsed_actions if a["type"] == "buyin")
    action_rebuys = sum(1 for a in parsed_actions if a["type"] == "rebuy")
    if action_buyins != buyins_count:
        warnings.append(f"{event_date}: buy-in count mismatch: summary={buyins_count}, actions={action_buyins}")
    if action_rebuys != rebuys_count:
        warnings.append(f"{event_date}: rebuy count mismatch: summary={rebuys_count}, actions={action_rebuys}")
    if paid_spots and len(payouts) != paid_spots:
        warnings.append(f"{event_date}: paid spots mismatch: summary={paid_spots}, payouts={len(payouts)}")

    event = {
        "eventId": event_date,
        "sourceFile": path.name,
        "title": title,
        "date": event_date,
        "summary": {
            "startTimeRaw": summary_start,
            "startTimeIso": iso_start,
            "endTimeRaw": summary_end,
            "endTimeIso": parse_datetime_from_summary(summary_end),
            "firstOut": first_out,
            "firstPermanentOut": first_perm_out,
            "winner": winner_text,
            "buyIns": buyins_count,
            "rebuys": rebuys_count,
            "entries": entries_count,
            "totalPot": total_pot,
            "paidSpots": paid_spots
        },
        "winners": [
            {
                "name": p["player"],
                "slug": p["slug"],
                "rank": p["rank"],
                "payout": p["payout"]
            }
            for p in payouts
        ],
        "actions": parsed_actions,
        "players": sorted(player_stats.values(), key=lambda p: p["name"].lower()),
        "warnings": warnings
    }

    return event


def main():
    metadata = load_json(METADATA_PATH)
    config = load_json(CONFIG_PATH)

    metadata_players = metadata["players"]
    alias_map = build_alias_map(metadata_players)
    buy_in_amount = safe_int(config.get("buy_in_amount", 30), 30)

    if not RAW_EVENTS_DIR.exists():
        raise RuntimeError(f"Raw events directory does not exist: {RAW_EVENTS_DIR}")

    html_files = sorted(RAW_EVENTS_DIR.glob("*.html"))
    if not html_files:
        raise RuntimeError(f"No event HTML files found in: {RAW_EVENTS_DIR}")

    PARSED_EVENTS_DIR.mkdir(parents=True, exist_ok=True)

    parsed_count = 0
    for html_file in html_files:
        event = parse_report_file(
            path=html_file,
            alias_map=alias_map,
            metadata_players=metadata_players,
            buy_in_amount=buy_in_amount
        )

        out_name = f"{event['eventId']}.json"
        out_path = PARSED_EVENTS_DIR / out_name
        with out_path.open("w", encoding="utf-8") as f:
            json.dump(event, f, indent=2, ensure_ascii=False)

        parsed_count += 1
        print(f"Wrote {out_path}")

    print(f"Parsed {parsed_count} event report(s).")


if __name__ == "__main__":
    main()
