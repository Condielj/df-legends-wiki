import sax from "./vendor/sax.mjs";

const sections = {
  historical_figures: "figures",
  sites: "sites",
  entities: "entities",
  artifacts: "artifacts",
  historical_events: "events",
  historical_eras: "eras",
  historical_event_collections: "collections",
  regions: "regions",
};

const labels = {
  figures: "Historical figure",
  sites: "Site",
  entities: "Entity",
  artifacts: "Artifact",
  events: "Event",
  collections: "Event collection",
  eras: "Era",
  regions: "Region",
};

const cp437High =
  "ÇüéâäàåçêëèïîìÄÅÉæÆôöòûùÿÖÜ¢£¥₧ƒáíóúñÑªº¿⌐¬½¼¡«»░▒▓│┤╡╢╖╕╣║╗╝╜╛┐└┴┬├─┼╞╟╚╔╩╦╠═╬╧╨╤╥╙╘╒╓╫╪┘┌█▄▌▐▀αßΓπΣσµτΦΘΩδ∞φε∩≡±≥≤⌠⌡÷≈°∙·√ⁿ²■ ";

async function decoderFor(file) {
  const bytes = new Uint8Array(await file.slice(0, 512).arrayBuffer());
  if (bytes[0] === 0xff && bytes[1] === 0xfe)
    return new TextDecoder("utf-16le");
  if (bytes[0] === 0xfe && bytes[1] === 0xff)
    return new TextDecoder("utf-16be");
  const declaration = new TextDecoder()
    .decode(bytes)
    .match(/^\s*<\?xml\s+[^?]*?encoding\s*=\s*['"]([^'"]+)/i);
  const encoding = declaration?.[1] || "utf-8";
  if (/^(?:cp|ibm|dos[-_]?)437$/i.test(encoding)) {
    // Browsers do not provide an IBM CP437 TextDecoder.
    return {
      decode(chunk = []) {
        let text = "";
        for (const byte of chunk)
          text +=
            byte < 128 ? String.fromCharCode(byte) : cp437High[byte - 128];
        return text;
      },
    };
  }
  return new TextDecoder(encoding, { fatal: true });
}

function addField(fields, key, value) {
  if (!Object.hasOwn(fields, key)) fields[key] = value;
  else if (Array.isArray(fields[key])) fields[key].push(value);
  else fields[key] = [fields[key], value];
}

function taggedParser(emitRecord, emitMeta) {
  const parser = sax.parser(true, { strictEntities: true });
  const stack = [];
  let sawRoot = false;
  parser.onerror = (error) => {
    throw error;
  };
  parser.ondoctype = () => {
    throw new Error(
      "Legends exports must not contain a document type declaration.",
    );
  };
  parser.onopentag = ({ name }) => {
    if (!stack.length) {
      if (name !== "df_world" || sawRoot)
        throw new Error("Expected one Dwarf Fortress df_world XML document.");
      sawRoot = true;
    }
    stack.push({ name, text: "", children: null });
  };
  parser.ontext = parser.oncdata = (text) => {
    const top = stack.at(-1);
    if (
      stack.length > 2 ||
      (stack.length === 2 && ["name", "altname"].includes(top.name))
    )
      top.text += text;
  };
  parser.onclosetag = () => {
    const { name, text, children } = stack.pop();
    const value = children || text.trim();
    if (stack.length === 1) {
      if (name === "name" || name === "altname") emitMeta(name, value);
    } else if (stack.length === 2) {
      if (children) emitRecord(stack[1].name, children);
    } else if (stack.length > 2) {
      const parent = stack.at(-1);
      parent.children ||= Object.create(null);
      addField(parent.children, name, value);
    }
  };
  return parser;
}

function referenceKind(key) {
  if (
    /(^|_)(hfid|histfig_id|hist_figure_id|histfig|hf_id)(?:_?\d+|_target)?$/.test(
      key,
    )
  )
    return "figures";
  if (/(^|_)(site_id|site)(?:_?\d+)?$/.test(key)) return "sites";
  if (/(^|_)(civ_id|entity_id|enid|civ|entity)(?:_?\d+)?$/.test(key))
    return "entities";
  if (/(^|_)(artifact_id|artifact)$/.test(key)) return "artifacts";
  if (key === "subregion_id" || key === "region_id") return "regions";
  if (key === "eventcol") return "collections";
  if (key === "event") return "events";
}

function references(fields) {
  const refs = [];
  function visit(key, value) {
    if (Array.isArray(value))
      return value.forEach((entry) => visit(key, entry));
    if (value && typeof value === "object")
      return Object.entries(value).forEach(([k, v]) => visit(k, v));
    if (!/^\d+$/.test(value)) return;
    const kind = referenceKind(key);
    if (kind) refs.push({ kind, id: value, role: key });
  }
  for (const [key, value] of Object.entries(fields)) visit(key, value);
  return refs;
}

// The extension can repeat record fields. Retain distinct repeated values,
// augment nested fields, and prefer the extension's descriptive scalars.
function mergeValues(base, extra) {
  if (base === undefined || base === extra) return extra;
  if (Array.isArray(base) || Array.isArray(extra)) {
    const merged = new Map();
    for (const value of [base, extra].flat())
      merged.set(JSON.stringify(value), value);
    return [...merged.values()];
  }
  if (base && extra && typeof base === "object" && typeof extra === "object") {
    for (const [key, value] of Object.entries(extra))
      base[key] = mergeValues(base[key], value);
    return base;
  }
  return extra || base;
}

function normalize(kind, id, fields) {
  const scalar = (...values) =>
    values.find((value) => typeof value === "string" && value.trim());
  const type = scalar(
    fields.type,
    fields.race,
    fields.item_type,
    labels[kind],
    kind,
  );
  const name = scalar(
    fields.name,
    fields.name2,
    fields.title,
    fields.name_singular,
    kind === "events" ? type : null,
    (labels[kind] || kind) + " " + id,
  );
  const yearText = scalar(fields.year, fields.start_year, fields.birth_year);
  const record = { id, name, type, fields, refs: references(fields) };
  if (yearText && /^-?\d+$/.test(yearText)) record.year = Number(yearText);
  return record;
}

export async function parseWorld(files, progress = () => {}) {
  if (!files.length) throw new Error("Choose a Legends XML export.");
  const tables = new Map();
  const world = {
    name: "",
    alternateName: "",
    files: [],
    other: Object.create(null),
  };
  for (const kind of Object.values(sections)) world[kind] = [];
  const totalBytes = files.reduce((sum, f) => sum + f.size, 0);
  let loadedBytes = 0;
  for (const file of files) {
    const parser = taggedParser(
      (section, fields) => {
        if (!tables.has(section)) tables.set(section, new Map());
        const table = tables.get(section);
        const id =
          fields.id ??
          (section === "historical_eras" ? fields.start_year : null) ??
          "row-" + table.size;
        if (typeof id !== "string")
          throw new Error("Invalid record identifier in " + section);
        table.set(id, mergeValues(table.get(id), fields));
      },
      (tag, value) => {
        if (typeof value === "string" && value)
          world[tag === "altname" ? "alternateName" : "name"] = value;
      },
    );
    try {
      const decoder = await decoderFor(file);
      const reader = file.stream().getReader();
      try {
        while (true) {
          const { value, done } = await reader.read();
          if (done) break;
          parser.write(decoder.decode(value, { stream: true }));
          loadedBytes += value.byteLength;
          progress({
            percent: Math.floor((98 * loadedBytes) / totalBytes),
            file: file.name,
          });
        }
      } finally {
        reader.releaseLock();
      }
      parser.write(decoder.decode());
      if (!parser.sawRoot) throw new Error("The XML document is empty.");
      parser.close();
    } catch (error) {
      throw new Error(file.name + " — " + error.message);
    }
    world.files.push(file.name);
  }
  for (const [section, table] of tables) {
    const kind = Object.hasOwn(sections, section) ? sections[section] : section;
    const records = Array.from(table, ([id, fields]) =>
      normalize(kind, id, fields),
    );
    if (Object.hasOwn(sections, section)) world[kind] = records;
    else world.other[section] = records;
    table.clear();
  }
  world.name ||=
    world.alternateName ||
    files[0].name.replace(/(?:-legends(?:_plus)?)?\.xml$/i, "");
  progress({ percent: 100, file: files.at(-1).name });
  return world;
}

if (
  typeof WorkerGlobalScope !== "undefined" &&
  self instanceof WorkerGlobalScope
) {
  self.onmessage = async ({ data }) => {
    try {
      let last = -1;
      let lastFile = "";
      const world = await parseWorld(data, (progress) => {
        if (progress.percent !== last || progress.file !== lastFile) {
          self.postMessage({ type: "progress", progress });
          last = progress.percent;
          lastFile = progress.file;
        }
      });
      self.postMessage({ type: "complete", world });
    } catch (error) {
      self.postMessage({ type: "error", message: error.message });
    }
  };
}
