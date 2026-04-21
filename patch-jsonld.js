const fs = require("fs");
const path = require("path");

const EPISODES_DIR = path.join(__dirname, "public", "episode");

const dirs = fs.readdirSync(EPISODES_DIR).filter(d =>
  fs.statSync(path.join(EPISODES_DIR, d)).isDirectory()
);

let patched = 0, skipped = 0, errors = 0;

for (const videoId of dirs) {
  const filePath = path.join(EPISODES_DIR, videoId, "index.html");
  if (!fs.existsSync(filePath)) { skipped++; continue; }

  let html = fs.readFileSync(filePath, "utf8");

  // Extract JSON-LD block
  const scriptMatch = html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/);
  if (!scriptMatch) { console.log(`No JSON-LD found: ${videoId}`); skipped++; continue; }

  let schema;
  try {
    schema = JSON.parse(scriptMatch[1]);
  } catch (e) {
    console.log(`JSON parse error: ${videoId}`);
    errors++;
    continue;
  }

  if (!schema.associatedMedia) { console.log(`No associatedMedia: ${videoId}`); skipped++; continue; }

  // Extract uploadDate from datePublished
  const uploadDate = schema.datePublished
    ? new Date(schema.datePublished).toISOString().split("T")[0]
    : null;

  // Extract description (first 200 chars of episode description)
  const description = schema.description
    ? schema.description.slice(0, 200)
    : "";

  // Patch the associatedMedia
  schema.associatedMedia = {
    "@type": "VideoObject",
    name: schema.name || videoId,
    description,
    uploadDate,
    embedUrl: schema.associatedMedia.embedUrl,
    thumbnailUrl: schema.associatedMedia.thumbnailUrl,
  };

  const newScript = `<script type="application/ld+json">${JSON.stringify(schema)}</script>`;
  const patchedHtml = html.replace(
    /<script type="application\/ld\+json">[\s\S]*?<\/script>/,
    newScript
  );

  fs.writeFileSync(filePath, patchedHtml);
  patched++;
}

console.log(`\nPatched: ${patched}  Skipped: ${skipped}  Errors: ${errors}  Total: ${dirs.length}`);
