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

module.exports = { esc, unesc };
