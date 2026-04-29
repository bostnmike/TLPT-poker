const fs = require("fs");
const path = require("path");

const EVENTS_DIR = path.join(__dirname, "../data/parsed/events");
const OUTPUT_FILE = path.join(EVENTS_DIR, "index.json");

function generateIndex() {
  const files = fs.readdirSync(EVENTS_DIR);

  const eventFiles = files
    .filter(file =>
      file.endsWith(".json") &&
      file !== "index.json"
    )
    .sort();

  fs.writeFileSync(
    OUTPUT_FILE,
    JSON.stringify(eventFiles, null, 2)
  );

  console.log(`✅ Indexed ${eventFiles.length} events`);
}

generateIndex();
