// Deterministic fictional world. Every statistic and chart is calculated from these records.
const words = (s) => s.split(" ");
const combine = (i, a, b, glue = "") =>
  a[i % a.length] + glue + b[Math.floor(i / a.length) % b.length];
const first = words(
  "Urist Domas Atis Kogan Stukos Erith Datan Tulon Iden Kadol Inod Vabok Momuz Tekkud Rakust Thob",
);
const metals = words(
  "Copper Iron Silver Bronze Flint Amber Slate Marble Granite Onyx Jade Cobalt",
);
const trades = words("hammer beard ward anvil shield helm hand song");
const places = words(
  "vault halls gate bridge delve tower forge hearth hold cavern",
);
const records = (n, fn) =>
  Array.from({ length: n }, (_, i) => ({
    id: String(i),
    fields: {},
    ...fn(i),
  }));
export function exampleWorld() {
  const figures = records(1248, (i) => ({
    name: first[i % 16] + " " + combine(Math.floor(i / 16), metals, trades),
    type: ["Dwarf", "Dwarf", "Dwarf", "Human", "Elf", "Goblin"][i % 6],
  }));
  const sites = records(84, (i) => ({
    name: combine(i, metals, places),
    type: ["Mountain hall", "Hillocks", "Fortress", "Town", "Forest retreat"][
      i % 5
    ],
  }));
  const entities = records(18, (i) => ({
    name:
      "The " +
      combine(
        i,
        words("Gilded Silent Brazen Verdant Ivory Silver"),
        words("Picks Banners Towers"),
        " ",
      ),
    type: "Civilization",
  }));
  const artifacts = records(56, (i) => ({
    name:
      "The " +
      combine(i, metals, words("Chalice Crown Lyre Scepter Seal"), " "),
    type: ["Treasure", "Heirloom", "Instrument"][i % 3],
  }));
  const weights = Array.from(
    { length: 250 },
    (_, y) => 8 + y / 15 + 6 * Math.sin(y / 8) + 4 * Math.cos(y / 4),
  );
  const total = weights.reduce((a, b) => a + b, 0);
  let running = 0;
  const years = weights.map((w) => (running += w) / total);
  const events = records(3682, (i) => {
    const year = 1 + years.findIndex((end) => end >= (i + 0.5) / 3682);
    const f = figures[(i * 137) % figures.length],
      s = sites[(i * 23) % sites.length],
      e = entities[i % 18],
      a = artifacts[i % 56];
    const choices = [
      [
        "Settlement founded",
        s.name + " was founded",
        [
          ["sites", s],
          ["entities", e],
        ],
      ],
      [
        "Journey",
        f.name + " arrived at " + s.name,
        [
          ["figures", f],
          ["sites", s],
        ],
      ],
      [
        "Artifact created",
        f.name + " crafted " + a.name,
        [
          ["figures", f],
          ["artifacts", a],
        ],
      ],
      [
        "Appointment",
        f.name + " joined " + e.name,
        [
          ["figures", f],
          ["entities", e],
        ],
      ],
    ];
    const [type, name, links] = choices[i % 4];
    return {
      year,
      type,
      name,
      refs: links.map(([kind, r]) => ({ kind, id: r.id, role: kind })),
    };
  });
  return {
    name: "The Amber Realms",
    alternateName: "Amug Adil",
    figures,
    sites,
    entities,
    artifacts,
    events,
    files: [],
    collections: [],
    eras: [],
    regions: [],
    other: {},
    demo: true,
  };
}
