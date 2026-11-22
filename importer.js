// A group represents one export snapshot. Save names can contain dashes and two
// directories may contain different worlds with identical save names.
export function groupExports(files) {
  const groups = new Map();
  const list = Array.from(files);
  for (const file of list) {
    const path = file.webkitRelativePath || file.name;
    const directory = path.slice(0, path.lastIndexOf("/") + 1);
    const match = /^(?:(.+)-)?legends(_plus)?\.xml$/i.exec(file.name);
    if (!match && !(list.length === 1 && /\.xml$/i.test(file.name))) continue;
    const prefix = match
      ? match[1] || "legends"
      : file.name.replace(/\.xml$/i, "");
    const key = directory + prefix;
    if (!groups.has(key)) groups.set(key, { key, label: key, files: [] });
    groups.get(key).files.push(file);
  }
  for (const group of groups.values()) {
    group.files.sort(
      (a, b) =>
        Number(/_plus\.xml$/i.test(a.name)) -
        Number(/_plus\.xml$/i.test(b.name)),
    );
  }
  return [...groups.values()];
}

export function importWorld(files, onProgress = () => {}) {
  return new Promise((resolve, reject) => {
    const worker = new Worker(new URL("./worker.js", import.meta.url), {
      type: "module",
    });
    worker.onmessage = ({ data }) => {
      if (data.type === "progress") return onProgress(data.progress);
      worker.terminate();
      if (data.type === "error") reject(new Error(data.message));
      else resolve(data.world);
    };
    worker.onerror = (event) => {
      worker.terminate();
      reject(
        new Error(
          event.message || "The import worker could not read the export.",
        ),
      );
    };
    worker.postMessage(Array.from(files));
  });
}
