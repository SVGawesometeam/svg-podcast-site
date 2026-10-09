#!/usr/bin/env node
// The review pull request body for a new episode, from the report
// scripts/new-episode.js wrote. The checklist is section 10 of
// TRANSCRIPTS-WORKFLOW.md, in English, with what the run found on top.
const fs = require("fs");
const r = JSON.parse(fs.readFileSync(process.argv[2], "utf8"));

// Backticks keep names from being read as markdown or auto-linked.
const code = (s) => "`" + String(s).replace(/`/g, "'") + "`";
const attention = r.attention.length
  ? r.attention.map((a) => `- ⚠️ ${a.replace(/`/g, "'")}`).join("\n")
  : "- Nothing flagged by the checks. The checklist below still applies.";

console.log(`## New episode draft: ${r.title}

| | |
| --- | --- |
| Video | https://www.youtube.com/watch?v=${r.videoId} |
| Page on the preview | \`${r.page}\` (Vercel attaches the preview link to this pull request) |
| Format | ${r.format} |
| Guest | ${code(r.guestName)}, ${code(r.guestTitle)} |
| Published | ${r.publishedAt} |
| Length | ${r.duration}, ${r.transcriptBlocks} transcript paragraphs |
| Data file | \`${r.dataFile}\` |

**This is a draft from the backend. Nothing is live until this pull request is merged.** To change anything, edit the data file (not the HTML) and note what you changed in \`transcript-fixes/${r.videoId}.json\`; the pages rebuild from the data on the next commit. Ask Claude in a comment if you want the edit done for you.

### Needs a person's eye

${attention}

### Checklist before merging

- [ ] Speaker labels are only the real participants: no "Guest", "Speaker 2", nobody who was not in the recording.
- [ ] The host's questions are labelled Marina and the answers the guest; no question glued to the end of someone else's answer.
- [ ] One spelling of each name across the page.
- [ ] No wall paragraphs (over 2,500 characters); long monologues are split.
- [ ] Names of people, companies and products are not mangled by speech recognition (Claude as "cloud", ChatGPT as "Chad JPT", Sam Altman as "Chuck Alman").
- [ ] Title in house style; the role comes from \`guestTitle\`.
- [ ] Summary, key takeaways and chapters are present and read right; one to three topics are assigned.
- [ ] Meta description reads right (no "a special guest, ,").
- [ ] The related block at the bottom links real episodes.
- [ ] The transcript matches the published edit of the video, not a rough cut.
- [ ] \`transcript-fixes/${r.videoId}.json\` is written if anything was changed.

Merging publishes the page and regenerates the homepage, the directory, the topic hubs, the sitemap and llms.txt.
`);
