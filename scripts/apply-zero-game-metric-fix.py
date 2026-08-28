#!/usr/bin/env python3
# One-time surgical patch for TLPT zero-game career metrics.

from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
BUILD = ROOT / 'scripts' / 'build-site-data.py'
AUDIT = ROOT / 'scripts' / 'audit-site-integrity.py'


def replace_once(text: str, old: str, new: str, label: str) -> str:
    count = text.count(old)
    if count != 1:
        raise RuntimeError(f'{label}: expected exactly one match, found {count}')
    return text.replace(old, new, 1)


def patch_build_site_data() -> None:
    text = BUILD.read_text(encoding='utf-8')

    normalize_block = '''def normalize_stat(players, key):
    values = [float(p.get(key, 0)) for p in players]
    min_val = min(values)
    max_val = max(values)

    if max_val == min_val:
        for p in players:
            p[f"{key}_norm"] = 50.0
        return

    for p in players:
        p[f"{key}_norm"] = 100 * (float(p[key]) - min_val) / (max_val - min_val)


'''
    career_helper = normalize_block + '''def finalize_career_metrics(players):
    # Calculate career metrics without letting zero-game metadata affect the league.
    active_players = [
        player for player in players
        if int(player.get("buyIns", 0) or 0) > 0
    ]
    inactive_players = [
        player for player in players
        if int(player.get("buyIns", 0) or 0) <= 0
    ]

    for player in inactive_players:
        for key in (
            "roi", "cashRate", "bubbleRate", "hitRate",
            "expectedProfit", "luckIndex",
            "clutchRaw", "aggressionRaw", "survivorRaw",
            "tiltScoreDirect", "tiltIndex", "trueSkillScore",
            "roi_norm", "luckIndex_norm", "clutchRaw_norm",
            "aggressionRaw_norm", "survivorRaw_norm",
            "clutchIndex", "aggressionIndex", "survivorIndex",
        ):
            player[key] = 0.0
        player["tier"] = "C"

    if not active_players:
        return players

    for player in active_players:
        cost = float(player["totalCost"])
        buyins = float(player["buyIns"])
        entries = float(player["entries"])

        player["roi"] = (player["profit"] / cost) if cost else 0.0
        player["cashRate"] = (player["timesPlaced"] / buyins) if buyins else 0.0
        player["bubbleRate"] = (player["bubbles"] / buyins) if buyins else 0.0
        player["hitRate"] = (player["hits"] / entries) if entries else 0.0
        player["luckProxy"] = (
            (0.40 * player["cashRate"])
            + (0.20 * player["hitRate"])
            + (0.40 * (1 - player["bubbleRate"]))
        )

    league_avg_proxy = (
        math.fsum(player["luckProxy"] for player in active_players)
        / len(active_players)
    )

    for player in active_players:
        proxy_delta = player["luckProxy"] - league_avg_proxy
        expected_roi = max(-0.75, min(1.50, proxy_delta * 2.5))
        player["expectedProfit"] = round(player["totalCost"] * expected_roi, 1)
        player["luckIndex"] = round(player["profit"] - player["expectedProfit"], 1)

        cash_rate = player["cashRate"]
        bubble_rate = player["bubbleRate"]
        hit_rate = player["hitRate"]
        buy_ins = max(player["buyIns"], 1)
        rebuy_rate = player["rebuys"] / buy_ins

        player["clutchRaw"] = player["timesPlaced"] / buy_ins
        player["aggressionRaw"] = player["hits"] / max(player["entries"], 1)
        player["survivorRaw"] = (
            (0.55 * cash_rate)
            + (0.25 * (1 - bubble_rate))
            + (0.20 * hit_rate)
        )

        base_composure = 100 * (
            1 - ((0.70 * rebuy_rate) + (0.30 * bubble_rate))
        )
        sample_factor = min(player["buyIns"], 8) / 8.0
        composure_score = 50 + ((base_composure - 50) * sample_factor)
        player["tiltScoreDirect"] = max(0.0, min(100.0, composure_score))

    for key in ("roi", "luckIndex", "clutchRaw", "aggressionRaw", "survivorRaw"):
        normalize_stat(active_players, key)

    for player in active_players:
        player["clutchIndex"] = player["clutchRaw_norm"]
        player["aggressionIndex"] = player["aggressionRaw_norm"]
        player["survivorIndex"] = player["survivorRaw_norm"]
        player["tiltIndex"] = round(player["tiltScoreDirect"], 1)

        sample_bonus = min(10, player["buyIns"])
        player["trueSkillScore"] = (
            (player["roi_norm"] * 1.4)
            + (player["clutchIndex"] * 1.2)
            + player["aggressionIndex"]
            + player["survivorIndex"]
            + (player["luckIndex_norm"] * 0.5)
            + (player["tiltIndex"] * 0.8)
            + sample_bonus
        )
        player.pop("luckProxy", None)

    ranked = sorted(active_players, key=lambda player: -player["trueSkillScore"])
    total_ranked = len(ranked)
    for index, player in enumerate(ranked):
        percentile = index / max(total_ranked - 1, 1)
        if percentile <= 0.15:
            player["tier"] = "S"
        elif percentile <= 0.35:
            player["tier"] = "A"
        elif percentile <= 0.65:
            player["tier"] = "B"
        else:
            player["tier"] = "C"

    return players


'''
    text = replace_once(text, normalize_block, career_helper, 'build-site-data.py career helper insertion')

    old_career = '''    players = list(players_by_slug.values())

    for p in players:
        cost = float(p["totalCost"])
        buyins = float(p["buyIns"])
        entries = float(p["entries"])

        p["roi"] = (p["profit"] / cost) if cost else 0.0
        p["cashRate"] = (p["timesPlaced"] / buyins) if buyins else 0.0
        p["bubbleRate"] = (p["bubbles"] / buyins) if buyins else 0.0
        p["hitRate"] = (p["hits"] / entries) if entries else 0.0

    for p in players:
        p["luckProxy"] = (
            (0.40 * p["cashRate"])
            + (0.20 * p["hitRate"])
            + (0.40 * (1 - p["bubbleRate"]))
        )

    league_avg_proxy = math.fsum(
        p["luckProxy"] for p in players
    ) / max(len(players), 1)

    for p in players:
        proxy_delta = p["luckProxy"] - league_avg_proxy
        expected_roi = max(-0.75, min(1.50, proxy_delta * 2.5))
        p["expectedProfit"] = round(p["totalCost"] * expected_roi, 1)
        p["luckIndex"] = round(p["profit"] - p["expectedProfit"], 1)

    for p in players:
        cash_rate = p["cashRate"]
        bubble_rate = p["bubbleRate"]
        hit_rate = p["hitRate"]

        buy_ins = max(p["buyIns"], 1)
        rebuy_rate = p["rebuys"] / buy_ins

        p["clutchRaw"] = p["timesPlaced"] / buy_ins
        p["aggressionRaw"] = p["hits"] / max(p["entries"], 1)
        p["survivorRaw"] = (
            (0.55 * cash_rate)
            + (0.25 * (1 - bubble_rate))
            + (0.20 * hit_rate)
        )

        base_composure = 100 * (1 - ((0.70 * rebuy_rate) + (0.30 * bubble_rate)))
        sample_factor = min(p["buyIns"], 8) / 8.0
        composure_score = 50 + ((base_composure - 50) * sample_factor)
        p["tiltScoreDirect"] = max(0.0, min(100.0, composure_score))

    normalize_stat(players, "roi")
    normalize_stat(players, "luckIndex")
    normalize_stat(players, "clutchRaw")
    normalize_stat(players, "aggressionRaw")
    normalize_stat(players, "survivorRaw")

    for p in players:
        p["clutchIndex"] = p["clutchRaw_norm"]
        p["aggressionIndex"] = p["aggressionRaw_norm"]
        p["survivorIndex"] = p["survivorRaw_norm"]
        p["tiltIndex"] = round(p["tiltScoreDirect"], 1)

        sample_bonus = min(10, p["buyIns"])

        p["trueSkillScore"] = (
            (p["roi_norm"] * 1.4)
            + (p["clutchIndex"] * 1.2)
            + (p["aggressionIndex"] * 1.0)
            + (p["survivorIndex"] * 1.0)
            + (p["luckIndex_norm"] * 0.5)
            + (p["tiltIndex"] * 0.8)
            + sample_bonus
        )

    sorted_by_skill = sorted(players, key=lambda p: -p["trueSkillScore"])
    total_players = len(sorted_by_skill)

    for idx, p in enumerate(sorted_by_skill):
        percentile = idx / max(total_players - 1, 1)

        if percentile <= 0.15:
            tier = "S"
        elif percentile <= 0.35:
            tier = "A"
        elif percentile <= 0.65:
            tier = "B"
        else:
            tier = "C"

        p["tier"] = tier
'''
    new_career = '''    players = list(players_by_slug.values())
    finalize_career_metrics(players)
'''
    text = replace_once(text, old_career, new_career, 'build-site-data.py career calculation replacement')

    old_records = '''    records = []
    for rule in config["records"]:
        leader = sort_players(players, rule["key"], rule["direction"])[0]
        records.append({
            "label": rule["label"],
            "name": leader["name"],
            "value": str(round(leader[rule["key"]], 2))
        })

    for p in players:
        p.pop("luckProxy", None)
'''
    new_records = '''    records = []
    record_pool = [
        player for player in players
        if int(player.get("buyIns", 0) or 0) > 0
    ]
    for rule in config["records"]:
        leader = sort_players(record_pool, rule["key"], rule["direction"])[0]
        records.append({
            "label": rule["label"],
            "name": leader["name"],
            "value": str(round(leader[rule["key"]], 2))
        })

    for p in players:
        p.pop("luckProxy", None)
'''
    text = replace_once(text, old_records, new_records, 'build-site-data.py records pool replacement')

    BUILD.write_text(text, encoding='utf-8')


def patch_integrity_audit() -> None:
    text = AUDIT.read_text(encoding='utf-8')

    anchor = '''def tier_score(player):
'''
    helper = '''def finalize_career_metrics(records):
    # Independent career calculation excluding metadata-only zero-game players.
    active = [
        player for player in records
        if int(player.get("buyIns", 0) or 0) > 0
    ]
    inactive = [
        player for player in records
        if int(player.get("buyIns", 0) or 0) <= 0
    ]

    for player in inactive:
        for key in (
            "roi", "cashRate", "bubbleRate", "hitRate",
            "expectedProfit", "luckIndex",
            "clutchRaw", "aggressionRaw", "survivorRaw",
            "tiltScoreDirect", "tiltIndex", "trueSkillScore",
            "roi_norm", "luckIndex_norm", "clutchRaw_norm",
            "aggressionRaw_norm", "survivorRaw_norm",
            "clutchIndex", "aggressionIndex", "survivorIndex",
        ):
            player[key] = 0.0
        player["tier"] = "C"

    if not active:
        return records

    for player in active:
        cost = float(player["totalCost"])
        buy_in = float(player["buyIns"])
        entries = float(player["entries"])
        player["roi"] = player["profit"] / cost if cost else 0.0
        player["cashRate"] = player["timesPlaced"] / buy_in if buy_in else 0.0
        player["bubbleRate"] = player["bubbles"] / buy_in if buy_in else 0.0
        player["hitRate"] = player["hits"] / entries if entries else 0.0
        player["luckProxy"] = (
            0.40 * player["cashRate"]
            + 0.20 * player["hitRate"]
            + 0.40 * (1 - player["bubbleRate"])
        )

    league_proxy = math.fsum(player["luckProxy"] for player in active) / len(active)

    for player in active:
        proxy_delta = player["luckProxy"] - league_proxy
        expected_roi = max(-0.75, min(1.50, proxy_delta * 2.5))
        player["expectedProfit"] = round(player["totalCost"] * expected_roi, 1)
        player["luckIndex"] = round(player["profit"] - player["expectedProfit"], 1)

        buy_in = max(player["buyIns"], 1)
        rebuy_rate = player["rebuys"] / buy_in
        player["clutchRaw"] = player["timesPlaced"] / buy_in
        player["aggressionRaw"] = player["hits"] / max(player["entries"], 1)
        player["survivorRaw"] = (
            0.55 * player["cashRate"]
            + 0.25 * (1 - player["bubbleRate"])
            + 0.20 * player["hitRate"]
        )
        base_composure = 100 * (
            1 - (0.70 * rebuy_rate + 0.30 * player["bubbleRate"])
        )
        sample_factor = min(player["buyIns"], 8) / 8.0
        direct = 50 + (base_composure - 50) * sample_factor
        player["tiltScoreDirect"] = max(0.0, min(100.0, direct))
        player["tiltIndex"] = round(player["tiltScoreDirect"], 1)

    for key in NORMALIZED_KEYS:
        normalize(active, key)

    for player in active:
        player["clutchIndex"] = player["clutchRaw_norm"]
        player["aggressionIndex"] = player["aggressionRaw_norm"]
        player["survivorIndex"] = player["survivorRaw_norm"]
        player["trueSkillScore"] = (
            player["roi_norm"] * 1.4
            + player["clutchIndex"] * 1.2
            + player["aggressionIndex"]
            + player["survivorIndex"]
            + player["luckIndex_norm"] * 0.5
            + player["tiltIndex"] * 0.8
            + min(10, player["buyIns"])
        )
        player.pop("luckProxy", None)

    ranked = sorted(active, key=lambda player: -player["trueSkillScore"])
    for index, player in enumerate(ranked):
        percentile = index / max(len(ranked) - 1, 1)
        player["tier"] = (
            "S" if percentile <= 0.15
            else "A" if percentile <= 0.35
            else "B" if percentile <= 0.65
            else "C"
        )

    return records


'''
    text = replace_once(text, anchor, helper + anchor, 'audit-site-integrity.py career helper insertion')

    old_aggregate = '''    records = list(totals.values())
    finalize_metrics(records)
    ranked = sorted(records, key=lambda player: -player["trueSkillScore"])
    for index, player in enumerate(ranked):
        percentile = index / max(len(ranked) - 1, 1)
        player["tier"] = "S" if percentile <= 0.15 else "A" if percentile <= 0.35 else "B" if percentile <= 0.65 else "C"
    return records
'''
    new_aggregate = '''    records = list(totals.values())
    finalize_career_metrics(records)
    return records
'''
    text = replace_once(text, old_aggregate, new_aggregate, 'audit-site-integrity.py aggregate career replacement')

    old_player_loop = '''    for slug, expected in expected_by_slug.items():
        actual_player = actual_by_slug.get(slug, {})
        for key in numeric_keys:
            audit.check(deep_equal(actual_player.get(key), expected.get(key)), "playerAggregates", f"{slug}: {key} differs from independent recomputation")
        audit.check(actual_player.get("tier") == expected.get("tier"), "playerAggregates", f"{slug}: published tier differs from formula")
'''
    new_player_loop = '''    zero_game_derived_keys = (
        "roi", "cashRate", "bubbleRate", "hitRate",
        "expectedProfit", "luckIndex",
        "clutchRaw", "aggressionRaw", "survivorRaw",
        "tiltScoreDirect", "tiltIndex", "trueSkillScore",
        "roi_norm", "luckIndex_norm", "clutchRaw_norm",
        "aggressionRaw_norm", "survivorRaw_norm",
        "clutchIndex", "aggressionIndex", "survivorIndex",
    )
    for slug, expected in expected_by_slug.items():
        actual_player = actual_by_slug.get(slug, {})
        for key in numeric_keys:
            audit.check(deep_equal(actual_player.get(key), expected.get(key)), "playerAggregates", f"{slug}: {key} differs from independent recomputation")
        audit.check(actual_player.get("tier") == expected.get("tier"), "playerAggregates", f"{slug}: published tier differs from formula")
        if int(expected.get("buyIns", 0) or 0) == 0:
            for key in zero_game_derived_keys:
                audit.check(
                    deep_equal(actual_player.get(key), 0.0),
                    "zeroGamePlayers",
                    f"{slug}: zero-game player has nonzero {key}",
                )
'''
    text = replace_once(text, old_player_loop, new_player_loop, 'audit-site-integrity.py explicit zero-game assertions')

    old_records = '''    expected_records = [{"label": rule["label"], "name": leader(expected_players, rule["key"], rule["direction"])["name"], "value": str(round(leader(expected_players, rule["key"], rule["direction"])[rule["key"]], 2))} for rule in config["records"]]
'''
    new_records = '''    record_pool = [
        player for player in expected_players
        if int(player.get("buyIns", 0) or 0) > 0
    ]
    expected_records = [{"label": rule["label"], "name": leader(record_pool, rule["key"], rule["direction"])["name"], "value": str(round(leader(record_pool, rule["key"], rule["direction"])[rule["key"]], 2))} for rule in config["records"]]
'''
    text = replace_once(text, old_records, new_records, 'audit-site-integrity.py records pool replacement')

    AUDIT.write_text(text, encoding='utf-8')


def main() -> None:
    patch_build_site_data()
    patch_integrity_audit()
    print('PASS: applied zero-game career metric fix to build + integrity audit')


if __name__ == '__main__':
    main()
