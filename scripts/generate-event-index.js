const fs = require("fs");
const path = require("path");

const EVENTS_DIR = path.join(process.cwd(), "data/parsed/events");
const OUTPUT_FILE = path.join(EVENTS_DIR, "index.json");
const HISTORY_OUTPUT_FILE = path.join(process.cwd(), "data/generated/event-history.json");

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

    const events = eventFiles.map(file => {
      const eventPath = path.join(EVENTS_DIR, file);
      const event = JSON.parse(fs.readFileSync(eventPath, "utf8"));
      const expectedEventId = file.replace(/\.json$/, "");
      const actualEventId = String(event.date || event.eventId || "");

      if (actualEventId !== expectedEventId) {
        throw new Error(`Event payload does not match index file: ${file}`);
      }

      return event;
    });

    const historyBundle = {
      generatedAt: eventFiles.length
        ? eventFiles[eventFiles.length - 1].replace(/\.json$/, "")
        : null,
      eventCount: events.length,
      events
    };

    fs.mkdirSync(path.dirname(HISTORY_OUTPUT_FILE), { recursive: true });
    fs.writeFileSync(
      HISTORY_OUTPUT_FILE,
      `${JSON.stringify(historyBundle, null, 2)}\n`
    );

    console.log(`✅ event-history.json rebuilt with ${events.length} events`);

  } catch (err) {
    console.error("❌ Error generating index:", err);
    process.exitCode = 1;
  }
}

generateIndex();
