import csv
import json
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent

INPUT_CSV = BASE_DIR / "data" / "player-meta.csv"
OUTPUT_JSON = BASE_DIR / "data" / "generated" / "player-meta.json"

def main():
    players = []

    with open(INPUT_CSV, newline="", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        for row in reader:
            players.append({
                "name": row["name"],
                "slug": row["slug"],
                "image": f"images/players/{row['image']}",
                "notes": row["notes"],
                "active": row["active"].lower() == "true"
            })

    OUTPUT_JSON.parent.mkdir(parents=True, exist_ok=True)

    with open(OUTPUT_JSON, "w", encoding="utf-8") as f:
        json.dump({"players": players}, f, indent=2)

    print("✅ player-meta.json built")

if __name__ == "__main__":
    main()
