import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

const repoRoot = process.cwd();
const feltWhispersDir = path.join(repoRoot, "images", "fw");
const outFile = path.join(feltWhispersDir, "gallery-manifest.json");
const posterPattern = /^fw(\d{2})-(\d{2})-(\d{2})\.(?:jpg|png)$/i;

function getMttPoster() {
  const schedule = JSON.parse(fs.readFileSync(path.join(repoRoot, "data", "events.json"), "utf8"));
  const event = schedule.events.find(entry => entry.slot === "mtt" && entry.galleryPoster);
  if (!event) return null;

  const { title, file } = event.galleryPoster;
  if (typeof title !== "string" || !title.trim() || !/^[a-z0-9]+(?:-[a-z0-9]+)*\.jpg$/.test(file)) {
    throw new Error("Invalid MTT gallery poster metadata");
  }
  const thumbnail = file.replace(/\.jpg$/, "-thumb.jpg");
  for (const image of [file, thumbnail]) {
    if (!fs.statSync(path.join(feltWhispersDir, "mtt", image), { throwIfNoEntry: false })?.isFile()) {
      throw new Error(`Missing MTT gallery image: ${image}`);
    }
  }

  const date = /^(?:date )?tbd$/i.test(event.date.trim())
    ? null
    : new Date(`${event.date} UTC`).toISOString().slice(0, 10);
  return { title, file, thumbnail, date };
}

if (!fs.existsSync(feltWhispersDir)) {
  throw new Error(`Directory not found: ${feltWhispersDir}`);
}

const directoryFiles = fs
  .readdirSync(feltWhispersDir, { withFileTypes: true })
  .filter(entry => entry.isFile())
  .map(entry => entry.name);
const unexpectedFiles = directoryFiles.filter(
  name => name !== "gallery-manifest.json" && !posterPattern.test(name)
);

if (unexpectedFiles.length) {
  throw new Error(`Unexpected file(s) in Felt Whispers gallery: ${unexpectedFiles.join(", ")}`);
}

const files = directoryFiles
  .filter(name => posterPattern.test(name))
  .sort((a, b) => {
    const toStamp = (file) => {
      const m = file.match(posterPattern);
      const yy = Number(m[1]);
      const yyyy = yy >= 70 ? 1900 + yy : 2000 + yy;
      return `${yyyy}-${m[2]}-${m[3]}`;
    };
    return toStamp(b).localeCompare(toStamp(a));
  });

if (!files.length) {
  throw new Error("No Felt Whispers posters found.");
}

const payload = {
  folder: "images/fw",
  thumbnailFolder: "images/fw/thumbs",
  files,
  versions: Object.fromEntries(files.map(file => {
    const image = crypto.createHash("sha256").update(fs.readFileSync(path.join(feltWhispersDir, file))).digest("hex").slice(0, 16);
    const thumbnailPath = path.join(feltWhispersDir, "thumbs", file);
    const thumbnail = fs.existsSync(thumbnailPath)
      ? crypto.createHash("sha256").update(fs.readFileSync(thumbnailPath)).digest("hex").slice(0, 16)
      : undefined;
    return [file, { image, thumbnail }];
  }))
};
const mttPoster = getMttPoster();
if (mttPoster) payload.mttPoster = mttPoster;

const nextContent = JSON.stringify(payload, null, 2) + "\n";
const prevContent = fs.existsSync(outFile) ? fs.readFileSync(outFile, "utf8") : "";

if (prevContent === nextContent) {
  console.log(`No manifest changes needed. ${files.length} poster(s).`);
} else {
  fs.writeFileSync(outFile, nextContent, "utf8");
  console.log(`Wrote ${outFile} with ${files.length} poster(s).`);
}
