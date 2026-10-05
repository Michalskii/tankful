const { execFile, execFileSync } = require("child_process");
const fs = require("fs");
const os = require("os");
const path = require("path");
const zlib = require("zlib");

const CHROME = [
  process.env.CHROME,
  "C:/Program Files/Google/Chrome/Application/chrome.exe",
  "C:/Program Files (x86)/Google/Chrome/Application/chrome.exe",
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  "/usr/bin/google-chrome",
].find((p) => p && fs.existsSync(p));

function screenshotArgs(htmlFile, width, height, out, profile, { transparent = false, waitMs = 0 } = {}) {
  return [
    "--headless=new",
    "--disable-gpu",
    ...(process.platform === "linux" ? ["--no-sandbox"] : []),
    "--hide-scrollbars",
    "--force-device-scale-factor=1",
    ...(transparent ? ["--default-background-color=00000000"] : []),
    ...(waitMs ? [`--virtual-time-budget=${waitMs}`] : []),
    `--user-data-dir=${profile}`,
    `--window-size=${width},${height}`,
    `--screenshot=${path.resolve(out)}`,
    `file:///${path.resolve(htmlFile).replace(/\\/g, "/")}`,
  ];
}

function screenshot(htmlFile, width, height, out, options) {
  if (!CHROME) throw new Error("Chrome not found – set the CHROME environment variable");
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), "tankful-chrome-"));
  try {
    execFileSync(CHROME, screenshotArgs(htmlFile, width, height, out, profile, options), { stdio: "ignore" });
  } finally {
    fs.rmSync(profile, { recursive: true, force: true });
  }
}

function screenshotAsync(htmlFile, width, height, out, options) {
  if (!CHROME) return Promise.reject(new Error("Chrome not found – set the CHROME environment variable"));
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), "tankful-chrome-"));
  return new Promise((resolve, reject) => {
    execFile(CHROME, screenshotArgs(htmlFile, width, height, out, profile, options), (err) => {
      fs.rmSync(profile, { recursive: true, force: true });
      if (err) reject(err);
      else if (!fs.existsSync(out)) reject(new Error(`${out}: Chrome wrote no screenshot`));
      else resolve();
    });
  });
}

function dumpDom(url, { waitMs = 5000, timeZone } = {}) {
  if (!CHROME) return Promise.reject(new Error("Chrome not found – set the CHROME environment variable"));
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), "tankful-chrome-"));
  const args = [
    "--headless=new",
    "--disable-gpu",
    ...(process.platform === "linux" ? ["--no-sandbox"] : []),
    `--user-data-dir=${profile}`,
    `--virtual-time-budget=${waitMs}`,
    "--dump-dom",
    url,
  ];
  const env = timeZone ? { ...process.env, TZ: timeZone } : process.env;
  return new Promise((resolve, reject) => {
    execFile(CHROME, args, { env, maxBuffer: 32 * 1024 * 1024 }, (err, stdout) => {
      fs.rmSync(profile, { recursive: true, force: true });
      if (err) reject(err);
      else resolve(stdout);
    });
  });
}

const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});

function crc32(buf) {
  let c = 0xffffffff;
  for (const b of buf) c = CRC_TABLE[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const out = Buffer.alloc(12 + data.length);
  out.writeUInt32BE(data.length, 0);
  out.write(type, 4, "ascii");
  data.copy(out, 8);
  out.writeUInt32BE(crc32(out.slice(4, 8 + data.length)), 8 + data.length);
  return out;
}

function unfilter(raw, width, height, bpp) {
  const stride = width * bpp;
  const pixels = Buffer.alloc(stride * height);
  for (let y = 0; y < height; y++) {
    const type = raw[y * (stride + 1)];
    const line = raw.slice(y * (stride + 1) + 1, (y + 1) * (stride + 1));
    for (let x = 0; x < stride; x++) {
      const a = x >= bpp ? pixels[y * stride + x - bpp] : 0;
      const b = y > 0 ? pixels[(y - 1) * stride + x] : 0;
      const c = x >= bpp && y > 0 ? pixels[(y - 1) * stride + x - bpp] : 0;
      let v = line[x];
      if (type === 1) v += a;
      else if (type === 2) v += b;
      else if (type === 3) v += (a + b) >> 1;
      else if (type === 4) {
        const p = a + b - c;
        const pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c);
        v += pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
      }
      pixels[y * stride + x] = v & 0xff;
    }
  }
  return pixels;
}

function flattenPng(file, background = [255, 255, 255]) {
  const png = fs.readFileSync(file);
  let p = 8;
  let ihdr = null;
  const idat = [];
  while (p < png.length) {
    const len = png.readUInt32BE(p);
    const type = png.toString("ascii", p + 4, p + 8);
    if (type === "IHDR") ihdr = png.slice(p + 8, p + 8 + len);
    if (type === "IDAT") idat.push(png.slice(p + 8, p + 8 + len));
    p += 12 + len;
  }
  const width = ihdr.readUInt32BE(0);
  const height = ihdr.readUInt32BE(4);
  if (ihdr[8] !== 8 || ihdr[12] !== 0) throw new Error(`${file}: only 8-bit non-interlaced PNG is supported`);
  const colorType = ihdr[9];
  if (colorType === 2) return;
  if (colorType !== 6) throw new Error(`${file}: unsupported colour type ${colorType}`);

  const rgba = unfilter(zlib.inflateSync(Buffer.concat(idat)), width, height, 4);
  const rows = Buffer.alloc((width * 3 + 1) * height);
  for (let y = 0; y < height; y++) {
    rows[y * (width * 3 + 1)] = 0;
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      const o = y * (width * 3 + 1) + 1 + x * 3;
      const alpha = rgba[i + 3] / 255;
      for (let k = 0; k < 3; k++) rows[o + k] = Math.round(rgba[i + k] * alpha + background[k] * (1 - alpha));
    }
  }
  const header = Buffer.from(ihdr);
  header[9] = 2;
  fs.writeFileSync(file, Buffer.concat([
    png.slice(0, 8),
    chunk("IHDR", header),
    chunk("IDAT", zlib.deflateSync(rows, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]));
}

module.exports = { screenshot, screenshotAsync, dumpDom, flattenPng, crc32 };
