# Legends Wiki

A local-first encyclopedia for Dwarf Fortress Legends exports. Start with an illustrated example world, or load your own and follow links between historical figures, sites, entities, artifacts, and the events they appear in.

[Open the live viewer](https://condielj.github.io/df-legends-wiki/)

## Run locally

With Node.js 22 or newer, run `npm start` and open the local URL printed in the terminal. The viewer has no install or build step.

To open a specific export and discover its companions automatically:

```sh
npm start -- "/path/to/region1-00250-01-01-legends.xml"
```

The launcher reads the selected file's directory and includes the matching `-legends.xml` and `-legends_plus.xml` files for that save and export date. It works when either member of the pair is given first. Other snapshots stay separate.

## Import from the browser

1. Select **Import world → Choose export folder**.
2. Choose the folder with your Legends or DFHack Legends Plus export. If it contains several world snapshots, select one.
3. Open an article, follow a linked record, or use **/** to search. **Timeline** lists events in reverse chronological order. **Statistics** charts historical activity and record types.

You can also select individual XML files. Browsers need folder access to discover siblings of a single selected file. The viewer offers to find companions or open that file alone.

## Data and performance

XML is decoded and parsed incrementally in a background worker. Base and extension records merge by section and ID. Unknown structured sections remain browsable under **More records**. Names, IDs, source fields, and recognized links are available in articles. Files stay on your device. The last imported world is stored in this browser's IndexedDB when space allows. Large exports must fit in browser memory.

The example world is fictional. Its charts and counts use the same code as imported worlds.

## Development

Run `npm test` for the import regression suite. The static frontend also works on a standard web server. The optional Node launcher supplies local file discovery. The SAX parser is vendored under its upstream license in `vendor/`.
