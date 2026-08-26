import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

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

fs.copyFileSync(
    path.join(srcDir, "style.css"),
    path.join(distDir, "style.css"),
);

["map-viewer.js", "modal.js"].forEach((file) => {
    fs.copyFileSync(path.join(srcDir, file), path.join(distDir, file));
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

copyRecursive(
    path.join(srcDir, "vendor"),
    path.join(distDir, "vendor")
);

copyRecursive(
    path.join(srcDir, "data"),
    path.join(distDir, "data")
);