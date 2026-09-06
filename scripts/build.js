import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import * as esbuild from "esbuild";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const srcDir = path.join(__dirname, "../src");
const distDir = path.join(__dirname, "../dist");

if (fs.existsSync(distDir)) {
  fs.rmSync(distDir, { recursive: true });
}
fs.mkdirSync(distDir, { recursive: true });

fs.copyFileSync(
  path.join(srcDir, "index.html"),
  path.join(distDir, "index.html"),
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
  target: "es2020",
});

function copyRecursive(src, dest) {
  if (!fs.existsSync(dest)) {
    fs.mkdirSync(dest, { recursive: true });
  }

  const files = fs.readdirSync(src);

  files.forEach((file) => {
    const srcPath = path.join(src, file);
    const destPath = path.join(dest, file);

    if (fs.statSync(srcPath).isDirectory()) {
      copyRecursive(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  });
}

copyRecursive(path.join(srcDir, "vendor"), path.join(distDir, "vendor"));
copyRecursive(path.join(srcDir, "data"), path.join(distDir, "data"));