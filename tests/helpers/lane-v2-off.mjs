// Side-effect import: select the detached SURFACE_V3 lane (SURFACE_V2=0) for
// the importing test file. noise-terrain.mjs reads its lane flags at module
// load, so import this BEFORE anything that imports noise-terrain. Each test
// file runs in its own fork, so the setting does not leak to other files.
process.env.SURFACE_V2 = "0";
