// Escaping for text placed into HTML, and the exact inverse for text read back
// out of pages the templates produced. Both templates and the data layer use
// these, so a value survives a round trip without gaining an &amp;.

function esc(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// &#39; and &#x27; are decoded too: the backend escapes apostrophes that way,
// and esc() above never needs to re-encode an apostrophe, so a page round
// trips to a plain ' rather than to &amp;#39;.
function unesc(str) {
  return String(str)
    .replace(/&quot;/g, '"')
    .replace(/&gt;/g, ">")
    .replace(/&lt;/g, "<")
    .replace(/&#39;/g, "'")
    .replace(/&#x27;/g, "'")
    .replace(/&amp;/g, "&");
}

// JSON placed inside a <script> block. JSON.stringify leaves "<" alone, so a
// value containing "</script>" would end the block early; "\u003c" is the
// same character to a JSON parser and inert to the HTML parser.
function jsonForScript(value) {
  return JSON.stringify(value).replace(/</g, "\\u003c").replace(/\u2028/g, "\\u2028").replace(/\u2029/g, "\\u2029");
}

module.exports = { esc, unesc, jsonForScript };
