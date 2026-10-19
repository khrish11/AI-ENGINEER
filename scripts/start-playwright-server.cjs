const fs = require("node:fs");
const path = require("node:path");

const root = process.cwd();
const standaloneRoot = path.join(root, ".next", "standalone");
const standaloneNext = path.join(standaloneRoot, ".next");

fs.cpSync(path.join(root, ".next", "static"), path.join(standaloneNext, "static"), {
  recursive: true,
  force: true,
});

const publicDir = path.join(root, "public");
if (fs.existsSync(publicDir)) {
  fs.cpSync(publicDir, path.join(standaloneRoot, "public"), {
    recursive: true,
    force: true,
  });
}

require(path.join(standaloneRoot, "server.js"));
