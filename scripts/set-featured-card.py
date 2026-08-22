#!/usr/bin/env python3

import json
import sys
from pathlib import Path


ROOT = Path(__file__).resolve().parent.parent
CONFIG_PATH = ROOT / "data" / "featured-cards.json"
SITE_DATA_PATH = ROOT / "data" / "generated" / "site-data.json"


def load_json(path):
    if not path.exists():
        raise FileNotFoundError(f"Missing required file: {path}")
    with path.open("r", encoding="utf-8") as handle:
        return json.load(handle)


def resolve_player(players, requested):
    normalized = str(requested or "").strip().lower()
    matches = [
        player for player in players
        if normalized in {
            str(player.get("slug") or "").strip().lower(),
            str(player.get("name") or "").strip().lower()
        }
    ]

    if len(matches) == 1:
        return matches[0]

    valid_players = ", ".join(
        player.get("slug", "")
        for player in sorted(players, key=lambda item: item.get("slug", ""))
    )
    raise ValueError(
        f"Unknown or ambiguous player '{requested}'. Valid player slugs: {valid_players}"
    )


def set_featured_card(player_input, edition_input):
    data = load_json(SITE_DATA_PATH)
    config = load_json(CONFIG_PATH)
    players = data.get("players") or []
    player = resolve_player(players, player_input)
    slug = player["slug"]
    edition = str(edition_input or "").strip().lower()

    earned_cards = player.get("cardCollection") or []
    earned_ids = [
        str(card.get("id"))
        for card in earned_cards
        if card.get("id")
    ]
    valid_editions = {"auto", "base", *earned_ids}

    if edition not in valid_editions:
        valid_label = ", ".join(["auto", "base", *earned_ids])
        raise ValueError(
            f"'{edition_input}' is not an earned edition for {player['name']}. "
            f"Valid choices: {valid_label}"
        )

    featured_cards = config.setdefault("featuredCards", {})
    if not isinstance(featured_cards, dict):
        raise ValueError("featured-cards.json featuredCards must be an object")

    if edition == "auto":
        featured_cards.pop(slug, None)
        automatic = earned_ids[0] if earned_ids else "base"
        result = f"Automatic prestige selection ({automatic})"
    else:
        featured_cards[slug] = edition
        result = "Base Edition" if edition == "base" else edition

    config["featuredCards"] = dict(sorted(featured_cards.items()))
    with CONFIG_PATH.open("w", encoding="utf-8") as handle:
        json.dump(config, handle, indent=2, ensure_ascii=False)
        handle.write("\n")

    try:
        displayed_path = CONFIG_PATH.relative_to(ROOT)
    except ValueError:
        displayed_path = CONFIG_PATH

    print(f"✔ Player: {player['name']} ({slug})")
    print(f"✔ Featured Crew card: {result}")
    print(f"✔ Updated: {displayed_path}")


def main():
    if len(sys.argv) != 3:
        raise SystemExit(
            "Usage: python scripts/set-featured-card.py PLAYER_SLUG EDITION_ID"
        )

    try:
        set_featured_card(sys.argv[1], sys.argv[2])
    except (FileNotFoundError, ValueError, json.JSONDecodeError) as error:
        print(f"::error::{error}")
        raise SystemExit(2) from error


if __name__ == "__main__":
    main()
