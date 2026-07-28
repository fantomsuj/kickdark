const path = require("node:path");

const auditManifestPath = path.join(
  __dirname,
  "..",
  "..",
  "docs",
  "audits",
  "2026-07-28-kick-dark-mode",
  "case-manifest.json"
);
const auditManifest = require(auditManifestPath);
const fixtureCases = auditManifest.cases.filter(
  (auditCase) => auditCase.fixture
);
const fixtureNames = [
  ...new Set(
    fixtureCases
      .map((auditCase) => auditCase.fixture)
      .filter(Boolean)
  )
];

module.exports = {
  auditManifest,
  auditManifestPath,
  fixtureCases,
  fixtureNames
};
