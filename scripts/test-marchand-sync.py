"""Read-only importer regression tests; the canonical workbook is never written."""
import importlib.util
import json
from copy import deepcopy
from pathlib import Path
from openpyxl import Workbook

root = Path(__file__).resolve().parent.parent
spec = importlib.util.spec_from_file_location("sync", root / "scripts/sync-marchand-data.py")
sync = importlib.util.module_from_spec(spec)
spec.loader.exec_module(sync)
payload = json.loads((root / "data/marchand-pucks.json").read_text())
workbook = Workbook()
workbook.remove(workbook.active)
for name in sync.SOURCE_SHEETS:
    workbook.create_sheet(name)
for record in payload["records"]:
    sheet = workbook[record["sourceSheet"]]
    for column, field in enumerate(record["sourceData"], 1):
        sheet.cell(1, column, field["label"])
        cell = sheet.cell(record["sourceRow"], column, field["value"])
        if field.get("url"):
            cell.hyperlink = field["url"]
for record in payload["records"]:
    rebuilt = deepcopy(record)
    sync.synchronize_record(rebuilt, workbook, workbook)
    assert rebuilt == record, (record["inventoryId"], "round-trip drift")
reordered = deepcopy(payload)
for record in reordered["records"]:
    record["sourceRow"] = 999
sync.discover_source_records(reordered, workbook)
assert reordered == payload, "row sorting changed artifact identities"
by_id = {record["inventoryId"]: record for record in payload["records"]}
assert by_id[324]["category"] == "Milestone"
assert by_id[324]["period"] == "2" and by_id[324]["time"] == "4:21"
assert by_id[324]["goalType"] == "ESG / GWG"
assert by_id[324]["goalieScoredAgainst"] == "Jeremy Swayman"
assert "Palmieri" in by_id[324]["description"]
assert by_id[9]["description"] and by_id[510]["playerCodes"] == ["BM63"]
for number in (10, 12, 32, 67, 77):
    assert by_id[number]["authenticationType"] == "Digital COA / Hologram"
    assert by_id[number]["authenticationEvidence"]
print(f"PASS: all {len(by_id)} artifacts round-trip across six sheets; stable IDs, scoring details, titles, video labels and holograms preserved.")
