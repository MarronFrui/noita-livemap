// Wang Lab dashboard worker — runs the search engine off the UI thread.
import { LabSearch } from "../mapgen/lib/lab-search.mjs";

let search = null;

self.onmessage = (e) => {
  const msg = e.data;
  if (msg.type === "start") {
    if (search && search.state === "running") return;
    search = new LabSearch({
      grids: msg.grids,
      seed: msg.seed,
      area: { x0: -16896, y0: 11264 },
      dims: { W: 256, H: 102 },
      config: msg.config,
    });
    search.on((evt) => self.postMessage(evt));
    search.run();
  } else if (msg.type === "pause") search?.pause();
  else if (msg.type === "resume") search?.resume();
  else if (msg.type === "stop") search?.stop();
};
