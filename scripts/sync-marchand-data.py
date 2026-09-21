#!/usr/bin/env python3

import argparse
import hashlib
import json
import re
from datetime import date, datetime
from pathlib import Path
from urllib.parse import parse_qs, urlparse

from openpyxl import load_workbook


ROOT = Path(__file__).resolve().parent.parent
DEFAULT_DATA = ROOT / "data/marchand-pucks.json"
CODE_PATTERN = re.compile(r"\b[A-Za-z]{1,3}\d{1,2}\b")
SOURCE_SHEETS = ("Goals & Games", "Milestones", "Road to History")
SOURCE_ID_HEADERS = {
    "Goals & Games": "ID",
    "Milestones": "ID #",
    "Road to History": "Inventory ID",
}
KEY_PREFIXES = {
    "Goals & Games": "goal",
    "Milestones": "milestone",
    "Road to History": "history",
}


def parse_args():
    parser = argparse.ArgumentParser(
        description="Synchronize the Marchand site database from the canonical workbook."
    )
    parser.add_argument("workbook", type=Path)
    parser.add_argument("--data", type=Path, default=DEFAULT_DATA)
    return parser.parse_args()


def blank_to_empty(value):
    return "" if value is None else value


def as_number(value):
    if value in (None, ""):
        return None
    if isinstance(value, (int, float)) and float(value).is_integer():
        return int(value)
    if isinstance(value, str) and re.fullmatch(r"-?\d+", value.strip()):
        return int(value)
    return value


def iso_date(value):
    if value in (None, ""):
        return ""
    if isinstance(value, (datetime, date)):
        return value.strftime("%Y-%m-%d")
    text = str(value).strip()
    for pattern in ("%B %d, %Y", "%B %-d, %Y", "%Y-%m-%d"):
        try:
            return datetime.strptime(text, pattern).strftime("%Y-%m-%d")
        except (ValueError, TypeError):
            continue
    raise ValueError(f"Unsupported date value: {value!r}")


def source_text(header, value):
    if header == "Date":
        return iso_date(value)
    if value is None:
        return ""
    if isinstance(value, (datetime, date)):
        return value.strftime("%Y-%m-%d")
    if isinstance(value, float) and value.is_integer():
        return str(int(value))
    return str(value)


def player_codes(*values):
    result = []
    for value in values:
        for code in CODE_PATTERN.findall(str(value or "")):
            if code.lower() == "ot":
                continue
            if code not in result:
                result.append(code)
    return result


def video_parts(url, previous):
    if not url:
        return "", ""
    if (
        url == previous.get("videoUrl")
        and previous.get("videoProvider")
        and previous.get("videoId")
    ):
        return previous.get("videoProvider", ""), previous.get("videoId", "")
    parsed = urlparse(url)
    host = parsed.netloc.lower()
    if "youtube.com" in host:
        return "youtube", parse_qs(parsed.query).get("v", [""])[0]
    if "youtu.be" in host:
        return "youtube", parsed.path.strip("/").split("/")[0]
    if "nhl.com" in host:
        return "nhl", parsed.path.rstrip("/").split("/")[-1]
    raise ValueError(f"Unsupported video URL: {url}")


def source_data(sheet_values, sheet_formulas, row):
    fields = []
    for column in range(1, sheet_values.max_column + 1):
        header = sheet_values.cell(1, column).value
        value = sheet_values.cell(row, column).value
        formula_cell = sheet_formulas.cell(row, column)
        url = formula_cell.hyperlink.target if formula_cell.hyperlink else ""
        fields.append({"label": header, "value": source_text(header, value), "url": url})
    return fields


def field_map(fields):
    return {field["label"]: field["value"] for field in fields}


def synchronize_record(record, workbook_values, workbook_formulas):
    sheet_name = record["sourceSheet"]
    row = record["sourceRow"]
    values_sheet = workbook_values[sheet_name]
    formulas_sheet = workbook_formulas[sheet_name]
    fields = source_data(values_sheet, formulas_sheet, row)
    values = field_map(fields)

    record["sourceData"] = fields
    if sheet_name == "Goals & Games":
        record.update(
            inventoryId=int(values["ID"]),
            homeRoad=values["Home/Road"],
            team=values["Marchand Team"],
            category=values["Category"],
            careerStat=as_number(values["Career Stat"]),
            seasonStat=as_number(values["Season Stat"]),
            description="",
            date=values["Date"],
            arena=values["Arena"],
            opponent=values["Opponent"],
            period=values["Period"],
            time=values["Time"],
            goalType=values["Goal Type"],
            primaryAssist=values["Primary Assist"],
            secondaryAssist=values["Secondary Assist"],
            score=values["Score"],
            puckType=values["Puck Type"],
            notes=values["Notes"],
            goalieScoredAgainst=values["Goalie Scored Against"],
            playerCodes=player_codes(values["Primary Assist"], values["Secondary Assist"]),
        )
        canonical_url = next(field["url"] for field in fields if field["label"] == "Goal Video")
        canonical_label = values["Goal Video"]
        record["videoLabel"] = canonical_label
        record["videoUrl"] = canonical_url
        record["videoProvider"], record["videoId"] = video_parts(canonical_url, record)
    elif sheet_name == "Milestones":
        record.update(
            inventoryId=int(values["ID #"]),
            homeRoad="",
            team=values["Marchand Team"],
            category=values["Category"],
            careerStat=None,
            seasonStat=None,
            description=values["Description"],
            date=values["Date"],
            arena=values["Arena"],
            opponent=values["Opponent"],
            period="",
            time="",
            goalType="",
            primaryAssist="",
            secondaryAssist="",
            score="",
            puckType=values["Puck Type"],
            notes=values["Notes"],
            game=None,
            wins=None,
            losses=None,
            points=None,
            goalieScoredAgainst="",
            playerCodes=player_codes(values["Description"], values["Notes"]),
        )
    elif sheet_name == "Road to History":
        wins = as_number(values["W"])
        losses = as_number(values["L"])
        overtime_losses = as_number(values["OTL"])
        record.update(
            inventoryId=int(values["Inventory ID"]),
            homeRoad=values["Home/Road"],
            team=values["Marchand Team"],
            category=values["Category"],
            careerStat=None,
            seasonStat=None,
            description=values["Description"],
            date=values["Date"],
            arena=values["Arena"],
            opponent=values["Opponent"],
            period="",
            time="",
            goalType="",
            primaryAssist="",
            secondaryAssist="",
            score=values["Score"],
            puckType=values["Puck Type"],
            notes=values["Notes"],
            game=as_number(values["Game"]),
            wins=wins,
            losses=losses,
            overtimeLosses=overtime_losses,
            seasonRecord=f"{wins}-{losses}-{overtime_losses}",
            points=as_number(values["Pts"]),
            goalieScoredAgainst="",
            playerCodes=player_codes(values["Description"], values["Notes"]),
        )
    else:
        raise ValueError(f"Unsupported source sheet: {sheet_name}")


def discover_source_records(payload, workbook_values):
    """Add newly populated canonical rows without disturbing established records."""
    def row_is_populated(sheet_name, row):
        sheet = workbook_values[sheet_name]
        if row < 2 or row > sheet.max_row:
            return False
        headers = {
            sheet.cell(1, column).value: column
            for column in range(1, sheet.max_column + 1)
        }
        required = (SOURCE_ID_HEADERS[sheet_name], "Marchand Team", "Category", "Date")
        return all(sheet.cell(row, headers[header]).value not in (None, "") for header in required)

    payload["records"] = [
        record
        for record in payload["records"]
        if record.get("sourceSheet") not in SOURCE_SHEETS
        or row_is_populated(record["sourceSheet"], record["sourceRow"])
    ]
    records = payload["records"]
    existing_sources = {
        (record["sourceSheet"], record["sourceRow"])
        for record in records
    }
    existing_keys = {record["key"] for record in records}

    for sheet_name in SOURCE_SHEETS:
        sheet = workbook_values[sheet_name]
        headers = {
            sheet.cell(1, column).value: column
            for column in range(1, sheet.max_column + 1)
        }
        id_column = headers[SOURCE_ID_HEADERS[sheet_name]]
        for row in range(2, sheet.max_row + 1):
            if not row_is_populated(sheet_name, row):
                continue
            source_key = (sheet_name, row)
            if source_key in existing_sources:
                continue
            inventory_id = as_number(sheet.cell(row, id_column).value)
            if inventory_id in (None, ""):
                continue
            record_key = f"{KEY_PREFIXES[sheet_name]}-{inventory_id}"
            if record_key in existing_keys:
                raise ValueError(
                    f"New canonical row {sheet_name}!{row} duplicates key {record_key}"
                )
            records.append(
                {
                    "key": record_key,
                    "sourceSheet": sheet_name,
                    "sourceRow": row,
                    "game": None,
                    "wins": None,
                    "losses": None,
                    "points": None,
                }
            )
            existing_sources.add(source_key)
            existing_keys.add(record_key)


def main():
    args = parse_args()
    workbook_path = args.workbook.resolve()
    data_path = args.data.resolve()
    payload = json.loads(data_path.read_text(encoding="utf-8"))

    workbook_values = load_workbook(workbook_path, data_only=True, read_only=False)
    workbook_formulas = load_workbook(workbook_path, data_only=False, read_only=False)
    discover_source_records(payload, workbook_values)
    for record in payload["records"]:
        synchronize_record(record, workbook_values, workbook_formulas)

    counts = {
        sheet: sum(record["sourceSheet"] == sheet for record in payload["records"])
        for sheet in SOURCE_SHEETS
    }
    record_count = len(payload["records"])
    payload["meta"].update(
        source=workbook_path.name,
        sourceSha256=hashlib.sha256(workbook_path.read_bytes()).hexdigest(),
        records=record_count,
        goalsAndGames=counts["Goals & Games"],
        milestones=counts["Milestones"],
        roadToHistory=counts["Road to History"],
        videos=sum(bool(record.get("videoUrl")) for record in payload["records"]),
        sourceSheets=counts,
    )

    data_path.write_text(json.dumps(payload, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print(
        json.dumps(
            {
                "data": str(data_path),
                "records": record_count,
                "videos": payload["meta"]["videos"],
                "sourceSha256": payload["meta"]["sourceSha256"],
            },
            indent=2,
        )
    )


if __name__ == "__main__":
    main()
