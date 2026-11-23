// DFHack exportlegends writes the civilized census, then site blocks keyed by
// XML site ID, then two wildlife sections. Site blocks can include animals.
export const censusSuffix = /(?:^|-)world_sites_and_pops\.txt$/i;

export function censusDate(name) {
  const m = /^(.+)-(\d+)-(\d{2})-(\d{2})-world_sites_and_pops\.txt$/i.exec(
    name,
  );
  return m && { save: m[1], date: m.slice(2, 5).join("-"), year: Number(m[2]) };
}

export function parseCensus(text, name) {
  const sites = Object.create(null),
    civilized = Object.create(null),
    names = Object.create(null);
  let section = "",
    rows = null,
    sawSites = false;
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (/^Civilized World Population$/i.test(line)) {
      section = "world";
      rows = civilized;
      continue;
    }
    if (/^Sites$/i.test(line)) {
      section = "sites";
      rows = null;
      sawSites = true;
      continue;
    }
    if (/^(Outdoor|Underground) Animal Populations/i.test(line)) break;
    if (section === "sites") {
      const start = /^(\d+):\s*(.*)/.exec(line);
      if (start) {
        names[start[1]] = start[2].trim().toLowerCase();
        rows = sites[start[1]] = Object.create(null);
        continue;
      }
    }
    const match = /^([\d,]+|Unnumbered)\s+(.+)$/i.exec(line);
    if (rows && match) {
      const species = match[2].trim().toLowerCase(),
        count = Number(match[1].replaceAll(",", ""));
      rows[species] =
        Number.isSafeInteger(count) && rows[species] !== null
          ? (rows[species] || 0) + count
          : null;
    }
  }
  if (!sawSites)
    throw new Error(name + " is missing the Sites census section.");
  return { name, ...censusDate(name), sites, civilized, names };
}

export function population(rows, species = "") {
  if (!rows) return null;
  if (species) return Object.hasOwn(rows, species) ? rows[species] : 0;
  const values = Object.values(rows);
  return values.includes(null) ? null : values.reduce((a, b) => a + b, 0);
}
