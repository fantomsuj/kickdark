import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "@playwright/test";

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(scriptDirectory, "..");
const sourcePath = path.join(projectRoot, "kickfinance_logo.jpeg");
const outputDirectory = path.join(projectRoot, "icons");
const sizes = [16, 32, 48, 128];

if (!fs.existsSync(sourcePath)) {
  throw new Error(`Missing icon source: ${sourcePath}`);
}

const source = fs.readFileSync(sourcePath).toString("base64");
const browser = await chromium.launch({ channel: "chrome" });

try {
  const page = await browser.newPage();
  const icons = await page.evaluate(
    async ({ encodedSource, targetSizes }) => {
      const image = new Image();
      image.src = `data:image/jpeg;base64,${encodedSource}`;
      await image.decode();

      if (image.naturalWidth !== image.naturalHeight) {
        throw new Error(
          `Icon source must be square; received ${image.naturalWidth}x${image.naturalHeight}`
        );
      }

      return targetSizes.map((size) => {
        const canvas = document.createElement("canvas");
        canvas.width = size;
        canvas.height = size;

        const context = canvas.getContext("2d");
        context.imageSmoothingEnabled = true;
        context.imageSmoothingQuality = "high";
        context.drawImage(image, 0, 0, size, size);

        return {
          size,
          png: canvas.toDataURL("image/png").split(",", 2)[1]
        };
      });
    },
    { encodedSource: source, targetSizes: sizes }
  );

  fs.mkdirSync(outputDirectory, { recursive: true });
  for (const { size, png } of icons) {
    fs.writeFileSync(
      path.join(outputDirectory, `icon-${size}.png`),
      Buffer.from(png, "base64")
    );
  }
} finally {
  await browser.close();
}

console.log(
  `Generated Chrome icons from kickfinance_logo.jpeg: ${sizes.join(", ")}`
);
