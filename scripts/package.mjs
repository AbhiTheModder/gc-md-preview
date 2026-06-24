import { createWriteStream, existsSync, mkdirSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, dirname, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { deflateRawSync } from "node:zlib";
import { readFileSync as readJson } from "node:fs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");

// Minimal cross-platform zip writer (no external deps).
// Uses stored + deflate compression; produces a valid .zip that both
// chrome://extensions "Load unpacked" rejects but "Pack extension" accepts
// the unzipped dir, and that Firefox AMO / Chrome Web Store accept.

const ZIP_CENTRAL_HEADER = 0x02014b50;
const ZIP_LOCAL_HEADER = 0x04034b50;
const ZIP_END = 0x06054b50;

function crc32(buf) {
  let c = ~crc32.table;
  for (let i = 0; i < buf.length; i++) {
    c = crc32.table[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  }
  return ~c >>> 0;
}
crc32.table = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    t[n] = c >>> 0;
  }
  return t;
})();

function deflateRawSyncLocal(buf) {
  return deflateRawSync(buf);
}

function u16(n) {
  return Buffer.from([n & 0xff, (n >>> 8) & 0xff]);
}
function u32(n) {
  return Buffer.from([
    n & 0xff,
    (n >>> 8) & 0xff,
    (n >>> 16) & 0xff,
    (n >>> 24) & 0xff,
  ]);
}

function walkDir(dir, base = dir) {
  const out = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const st = statSync(full);
    if (st.isDirectory()) {
      out.push(...walkDir(full, base));
    } else {
      out.push({ path: relative(base, full).replace(/\\/g, "/"), full });
    }
  }
  return out;
}

function zipDir(srcDir, outFile) {
  const files = walkDir(srcDir);
  const central = [];
  const out = createWriteStream(outFile);

  return new Promise((resolve, reject) => {
    let offset = 0;
    const writeQueue = [];

    for (const f of files) {
      const data = readFileSync(f.full);
      const compressed = deflateRawSync(data);
      const crc = crc32(data);
      const nameBuf = Buffer.from(f.path, "utf8");
      const useDeflate = compressed.length < data.length;
      const stored = useDeflate ? compressed : data;
      const method = useDeflate ? 8 : 0;

      const local = Buffer.concat([
        u32(ZIP_LOCAL_HEADER),
        u16(20), // version
        u16(0), // flags
        u16(method),
        u16(0), u16(0), // time, date
        u32(crc),
        u32(stored.length),
        u32(data.length),
        u16(nameBuf.length),
        u16(0), // extra
        nameBuf,
        stored,
      ]);

      central.push({
        header: Buffer.concat([
          u32(ZIP_CENTRAL_HEADER),
          u16(20), u16(20), // version made, needed
          u16(0), // flags
          u16(method),
          u16(0), u16(0), // time, date
          u32(crc),
          u32(stored.length),
          u32(data.length),
          u16(nameBuf.length),
          u16(0), // extra
          u16(0), u16(0), // comment len, disk
          u16(0), // internal attrs
          u32(0), // external attrs
          u32(offset),
          nameBuf,
        ]),
      });

      offset += local.length;
      writeQueue.push(local);
    }

    const centralStart = offset;
    let centralSize = 0;
    for (const c of central) centralSize += c.header.length;

    const end = Buffer.concat([
      u32(ZIP_END),
      u16(0), u16(0), // disk
      u16(files.length), u16(files.length),
      u32(centralSize),
      u32(centralStart),
      u16(0), // comment
    ]);

    for (const buf of writeQueue) out.write(buf);
    for (const c of central) out.write(c.header);
    out.write(end);
    out.end(resolve);
  });
}

async function main() {
  const target = process.argv[2];
  const outDir = join(root, "dist-zip");
  if (!existsSync(outDir)) mkdirSync(outDir, { recursive: true });

  const browsers = target ? [target] : ["chrome", "firefox"];
  for (const b of browsers) {
    const src = join(root, `dist/${b}`);
    if (!existsSync(src)) {
      console.error(`✗ dist/${b} does not exist. Run 'aube run build' first.`);
      process.exit(1);
    }
    const version = JSON.parse(readFileSync(join(root, "package.json"), "utf8")).version;
    const outFile = join(outDir, `gc-md-preview-${b}-v${version}.zip`);
    await zipDir(src, outFile);
    const size = (statSync(outFile).size / 1024).toFixed(1);
    console.log(`✓ ${b}: ${outFile} (${size} KB)`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});