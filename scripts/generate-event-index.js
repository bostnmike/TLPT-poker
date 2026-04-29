const fs = require("fs");
const path = require("path");

const EVENTS_DIR = path.join(process.cwd(), "data/parsed/events");
const OUTPUT_FILE = path.join(EVENTS_DIR, "index.json");

function generateIndex() {
  try {
    const files = fs.readdirSync(EVENTS_DIR);

    const eventFiles = files
      .filter(file =>
        file.endsWith(".json") &&
        file !== "index.json"
      )
      .sort();

    console.log("📁 Files detected:");
    console.log(eventFiles);

    fs.writeFileSync(
      OUTPUT_FILE,
      JSON.stringify(eventFiles, null, 2)
    );

    console.log(`✅ index.json rebuilt with ${eventFiles.length} events`);

  } catch (err) {
    console.error("❌ Error generating index:", err);
  }
}

generateIndex();
