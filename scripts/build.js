import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { spawnSync } from "child_process";
import * as esbuild from "esbuild";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const srcDir = path.join(__dirname, "../src");
const distDir = path.join(__dirname, "../dist");

function runTests() {
  const result = spawnSync(
    "node",
    [
      "--test",
      "--experimental-test-coverage",
      path.join(__dirname, "../tests/*.test.js"),
    ],
    {
      stdio: "inherit",
    },
  );
  if (result.status !== 0) {
    console.error("Tests failed — aborting build.");
    process.exit(result.status ?? 1);
  }
}

runTests();

if (fs.existsSync(distDir)) {
  fs.rmSync(distDir, { recursive: true });
}
fs.mkdirSync(distDir, { recursive: true });

fs.copyFileSync(
  path.join(srcDir, "index.html"),
  path.join(distDir, "index.html"),
);
fs.copyFileSync(
  path.join(srcDir, "robots.txt"),
  path.join(distDir, "robots.txt"),
);
fs.copyFileSync(
  path.join(srcDir, "sitemap.xml"),
  path.join(distDir, "sitemap.xml"),
);
fs.cpSync(path.join(srcDir, "assets"), path.join(distDir, "assets"), {
  recursive: true,
});
fs.copyFileSync(
  path.join(srcDir, "sitemap.xml"),
  path.join(distDir, "sitemap.xml"),
);

await esbuild.build({
  entryPoints: [path.join(srcDir, "style.css")],
  outfile: path.join(distDir, "style.css"),
  minify: true,
  loader: { ".css": "css" },
});

await esbuild.build({
  entryPoints: [path.join(srcDir, "js/main.js")],
  outfile: path.join(distDir, "js/main.js"),
  bundle: true,
  minify: true,
  format: "esm",
  target: "es2022",
});

function copyRecursive(src, dest, { minifyJson = false, exclude = [] } = {}) {
  if (!fs.existsSync(dest)) {
    fs.mkdirSync(dest, { recursive: true });
  }

  const files = fs.readdirSync(src);

  files.forEach((file) => {
    if (exclude.includes(file)) return;

    const srcPath = path.join(src, file);
    const destPath = path.join(dest, file);

    if (fs.statSync(srcPath).isDirectory()) {
      copyRecursive(srcPath, destPath, { minifyJson, exclude });
    } else if (minifyJson && /\.(json|geojson)$/i.test(file)) {
      minifyJsonFile(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  });
}

function minifyJsonFile(srcPath, destPath) {
  try {
    const raw = fs.readFileSync(srcPath, "utf8");
    const parsed = JSON.parse(raw);
    fs.writeFileSync(destPath, JSON.stringify(parsed));

    const before = Buffer.byteLength(raw, "utf8");
    const after = fs.statSync(destPath).size;
    const saved = (((before - after) / before) * 100).toFixed(1);
    console.log(
      `  minified ${path.basename(srcPath)}: ${before}B -> ${after}B (-${saved}%)`,
    );
  } catch (err) {
    console.error(`Failed to minify ${srcPath}, copying as-is:`, err.message);
    fs.copyFileSync(srcPath, destPath);
  }
}

copyRecursive(path.join(srcDir, "vendor"), path.join(distDir, "vendor"));
copyRecursive(path.join(srcDir, "data"), path.join(distDir, "data"), {
  minifyJson: true,
  // Master archive source, the app consumes archive.json + addresses.geojson.
  exclude: ["archive-master.json"],
});
