"""Preserve generatedAt when the generated content has not changed."""
import json


def preserve_timestamp(path, payload):
    if path.is_file():
        previous = json.loads(path.read_text(encoding="utf-8"))
        old = {k: v for k, v in previous.items() if k != "generatedAt"}
        new = {k: v for k, v in payload.items() if k != "generatedAt"}
        if old == new and previous.get("generatedAt"):
            payload["generatedAt"] = previous["generatedAt"]
    return payload
