import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const SEARCH_ROOTS = ["apps/ui"];
const FILE_EXTENSIONS = new Set([".tsx"]);

const walk = (dir: string): string[] => {
  const results: string[] = [];
  const entries = readdirSync(dir);
  for (const entry of entries) {
    const fullPath = path.join(dir, entry);
    const stats = statSync(fullPath);
    if (stats.isDirectory()) {
      results.push(...walk(fullPath));
      continue;
    }
    if (FILE_EXTENSIONS.has(path.extname(fullPath))) {
      results.push(fullPath);
    }
  }
  return results;
};

const componentExportRegex =
  /(?:export\s+default\s+function|export\s+function|export\s+const)\s+([A-Z][A-Za-z0-9_]*)\b/g;

const violations: Array<{ file: string; components: string[] }> = [];

for (const relativeRoot of SEARCH_ROOTS) {
  const absoluteRoot = path.join(ROOT, relativeRoot);
  for (const filePath of walk(absoluteRoot)) {
    const source = readFileSync(filePath, "utf8");
    const names = Array.from(source.matchAll(componentExportRegex)).map((match) => match[1]);
    if (names.length > 1) {
      violations.push({
        file: path.relative(ROOT, filePath),
        components: names
      });
    }
  }
}

if (violations.length > 0) {
  // eslint-disable-next-line no-console
  console.error("Found files with more than one exported component:");
  violations.forEach((violation) => {
    // eslint-disable-next-line no-console
    console.error(`- ${violation.file}: ${violation.components.join(", ")}`);
  });
  process.exit(1);
}

// eslint-disable-next-line no-console
console.log("Single-component-per-file check passed.");
