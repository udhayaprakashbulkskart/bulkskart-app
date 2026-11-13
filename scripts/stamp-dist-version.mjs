import fs from "node:fs";

const sha = process.env.GITHUB_SHA;
if (!sha) {
  console.error("GITHUB_SHA is required");
  process.exit(1);
}

const baked = JSON.parse(fs.readFileSync("src/version.json", "utf8"));
const servedPath = "dist/version.json";
const served = JSON.parse(fs.readFileSync(servedPath, "utf8"));

if (!baked.version || !baked.buildTime) {
  console.error("src/version.json is missing version or buildTime");
  process.exit(1);
}
if (served.version !== baked.version || served.buildTime !== baked.buildTime) {
  console.error("dist/version.json does not match the version baked into the client bundle");
  console.error("baked", baked);
  console.error("served", served);
  process.exit(1);
}

const stamped = {
  version: baked.version,
  buildTime: baked.buildTime,
  gitCommit: sha,
};
fs.writeFileSync(servedPath, `${JSON.stringify(stamped, null, 2)}\n`);
console.log(JSON.stringify(stamped));
