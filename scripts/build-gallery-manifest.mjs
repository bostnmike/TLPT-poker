import fs from "node:fs";
import path from "node:path";

const repoRoot = process.cwd();
const feltWhispersDir = path.join(repoRoot, "images", "fw");
const outFile = path.join(feltWhispersDir, "gallery-manifest.json");
const posterPattern = /^fw\d{2}-\d{2}-\d{2}\.jpg$/i;

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
      const m = file.match(/^fw(\d{2})-(\d{2})-(\d{2})\.jpg$/i);
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
  files
};

const nextContent = JSON.stringify(payload, null, 2) + "\n";
const prevContent = fs.existsSync(outFile) ? fs.readFileSync(outFile, "utf8") : "";

if (prevContent === nextContent) {
  console.log(`No manifest changes needed. ${files.length} poster(s).`);
} else {
  fs.writeFileSync(outFile, nextContent, "utf8");
  console.log(`Wrote ${outFile} with ${files.length} poster(s).`);
}
