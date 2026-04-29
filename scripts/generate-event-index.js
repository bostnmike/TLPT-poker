const fs = require("fs");
const path = require("path");

const EVENTS_DIR = path.join(__dirname, "../data/parsed/events");
const OUTPUT_FILE = path.join(EVENTS_DIR, "index.json");

function generateIndex() {
  try {
    const files = fs.readdirSync(EVENTS_DIR);

    const eventFiles = files
      .filter(file =>
        file.endsWith(".json") &&
        file !== "index.json"
      )
      .sort(); // YYYY-MM-DD sorts correctly

    fs.writeFileSync(
      OUTPUT_FILE,
      JSON.stringify(eventFiles, null, 2)
    );

    console.log("✅ index.json generated successfully");
    console.log(eventFiles.length, "events indexed");

  } catch (err) {
    console.error("❌ Failed to generate index:", err);
  }
}

generateIndex();
