import fs from "node:fs";
import path from "node:path";

const repoRoot = process.cwd();
const twtwDir = path.join(repoRoot, "images", "twtw");
const outFile = path.join(twtwDir, "gallery-manifest.json");

if (!fs.existsSync(twtwDir)) {
  throw new Error(`Directory not found: ${twtwDir}`);
}

const files = fs
  .readdirSync(twtwDir)
  .filter(name => /^twtw\d{2}-\d{2}-\d{2}\.jpg$/i.test(name))
  .sort((a, b) => {
    const toStamp = (file) => {
      const m = file.match(/^twtw(\d{2})-(\d{2})-(\d{2})\.jpg$/i);
      const yy = Number(m[1]);
      const yyyy = yy >= 70 ? 1900 + yy : 2000 + yy;
      return `${yyyy}-${m[2]}-${m[3]}`;
    };
    return toStamp(b).localeCompare(toStamp(a));
  });

const payload = {
  generatedAt: new Date().toISOString(),
  folder: "images/twtw",
  files
};

fs.writeFileSync(outFile, JSON.stringify(payload, null, 2) + "\n", "utf8");

console.log(`Wrote ${outFile} with ${files.length} poster(s).`);
