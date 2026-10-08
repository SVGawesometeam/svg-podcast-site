// The site's address and the one identifier per entity that every page's
// JSON-LD reuses, so a machine reading any page can tell that the same
// person, show and publisher are meant.
const SITE_URL = "https://marinamogilko.co";

const IDS = {
  person: `${SITE_URL}/#marina`,
  podcast: `${SITE_URL}/#podcast`,
  org: `${SITE_URL}/#org`,
  website: `${SITE_URL}/#website`,
};

module.exports = { SITE_URL, IDS };
