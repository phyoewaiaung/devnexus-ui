import sharp from "sharp";
import fs from "fs";

const input = "./src/assets/transparent.png";

async function run() {
    await sharp(input)
        .resize(192, 192)
        .png()
        .toFile("./public/pwa-192.png");

    await sharp(input)
        .resize(512, 512)
        .png()
        .toFile("./public/pwa-512.png");

    await sharp(input)
        .resize(512, 512)
        .png()
        .toFile("./public/pwa-512-maskable.png");

    await sharp(input)
        .resize(180, 180)
        .png()
        .toFile("./public/apple-touch-icon.png");

    console.log("✅ PWA icons generated in /public");
}

run();
