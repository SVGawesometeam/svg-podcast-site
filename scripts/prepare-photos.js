#!/usr/bin/env node
// Resize the photos the team shares (public/photos/<set>/) to a web size and
// write content/photos.json with each image's dimensions and alt text, so
// the pages can reserve space before images load. Originals are replaced
// by the resized file (max 1600 px on the long side, JPEG quality 82).
// Needs Python with Pillow, which the build environment has; the output
// file is committed, so a machine without Pillow can still build.
//
//   node scripts/prepare-photos.js
const { execFileSync } = require("child_process");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const py = `
import json, os, sys
from PIL import Image
root = sys.argv[1]
sets = {"covers": "Magazine cover featuring Marina Mogilko", "speaker": "Marina Mogilko speaking on stage", "influencer": "Marina Mogilko"}
out = {}
for key, alt in sets.items():
    d = os.path.join(root, "public", "photos", key)
    if not os.path.isdir(d): continue
    items = []
    for name in sorted(os.listdir(d)):
        p = os.path.join(d, name)
        if not name.lower().endswith((".jpg", ".jpeg", ".png", ".webp")): continue
        im = Image.open(p)
        im = im.convert("RGB")
        w, h = im.size
        if max(w, h) > 1600:
            s = 1600 / max(w, h); im = im.resize((round(w*s), round(h*s)), Image.LANCZOS)
        base = os.path.splitext(name)[0]
        dest = os.path.join(d, base + ".jpg")
        im.save(dest, "JPEG", quality=82, optimize=True, progressive=True)
        if dest != p: os.remove(p)
        items.append({"src": f"/photos/{key}/{base}.jpg", "width": im.size[0], "height": im.size[1], "alt": alt})
    out[key] = items
json.dump(out, open(os.path.join(root, "content", "photos.json"), "w"), indent=2)
print({k: len(v) for k, v in out.items()})
`;
console.log(execFileSync("python3", ["-c", py, ROOT], { encoding: "utf8" }));
