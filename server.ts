import express from 'express';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer as createViteServer } from 'vite';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const CRC_TABLE = new Uint32Array(256);
for (let n = 0; n < 256; n++) {
  let c = n;
  for (let k = 0; k < 8; k++) {
    c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
  }
  CRC_TABLE[n] = c >>> 0;
}

function calcCrc32(buf: Buffer): number {
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    crc = CRC_TABLE[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

interface ZipEntry {
  relPath: string;
  data: Buffer;
}

function collectDirEntries(absBase: string, relPrefix: string, out: ZipEntry[]): void {
  if (!fs.existsSync(absBase)) return;
  const stat = fs.statSync(absBase);
  if (stat.isFile()) {
    out.push({ relPath: relPrefix.replace(/\\/g, '/'), data: fs.readFileSync(absBase) });
    return;
  }
  for (const item of fs.readdirSync(absBase)) {
    if (item === 'build' || item === '.gradle' || item === '.DS_Store') continue;
    collectDirEntries(path.join(absBase, item), `${relPrefix}/${item}`, out);
  }
}

function buildZipBuffer(entries: ZipEntry[]): Buffer {
  const localParts: Buffer[] = [];
  const centralParts: Buffer[] = [];
  let localOffset = 0;

  for (const entry of entries) {
    const nameBuf = Buffer.from(entry.relPath, 'utf8');
    // Método ZIP 0 (STORE = 0% compresión): entrega todos los archivos binarios WAV 32f, TTF y código sin comprimir
    const raw = entry.data;
    const crc = calcCrc32(raw);

    const lh = Buffer.alloc(30);
    lh.writeUInt32LE(0x04034b50, 0);
    lh.writeUInt16LE(20, 4);
    lh.writeUInt16LE(0x0800, 6);
    lh.writeUInt16LE(0, 8);
    lh.writeUInt16LE(0, 10);
    lh.writeUInt16LE(0x0021, 12);
    lh.writeUInt32LE(crc, 14);
    lh.writeUInt32LE(raw.length, 18);
    lh.writeUInt32LE(raw.length, 22);
    lh.writeUInt16LE(nameBuf.length, 26);
    lh.writeUInt16LE(0, 28);

    localParts.push(lh, nameBuf, raw);

    const ch = Buffer.alloc(46);
    ch.writeUInt32LE(0x02014b50, 0);
    ch.writeUInt16LE(20, 4);
    ch.writeUInt16LE(20, 6);
    ch.writeUInt16LE(0x0800, 8);
    ch.writeUInt16LE(0, 10);
    ch.writeUInt16LE(0, 12);
    ch.writeUInt16LE(0x0021, 14);
    ch.writeUInt32LE(crc, 16);
    ch.writeUInt32LE(raw.length, 20);
    ch.writeUInt32LE(raw.length, 24);
    ch.writeUInt16LE(nameBuf.length, 28);
    ch.writeUInt16LE(0, 30);
    ch.writeUInt16LE(0, 32);
    ch.writeUInt16LE(0, 34);
    ch.writeUInt16LE(0, 36);
    ch.writeUInt32LE(0, 38);
    ch.writeUInt32LE(localOffset, 42);

    centralParts.push(ch, nameBuf);
    localOffset += lh.length + nameBuf.length + raw.length;
  }

  const cdBuffer = Buffer.concat(centralParts);
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0);
  eocd.writeUInt16LE(0, 4);
  eocd.writeUInt16LE(0, 6);
  eocd.writeUInt16LE(entries.length, 8);
  eocd.writeUInt16LE(entries.length, 10);
  eocd.writeUInt32LE(cdBuffer.length, 12);
  eocd.writeUInt32LE(localOffset, 16);
  eocd.writeUInt16LE(0, 20);

  return Buffer.concat([...localParts, cdBuffer, eocd]);
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use((req, res, next) => {
    if (req.path === '/sw.js' || req.path === '/' || req.path === '/index.html') {
      res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');
    }
    next();
  });

  const buildEditionAndroidZip = (edition: 'pro' | 'classic'): Buffer => {
    const entries: ZipEntry[] = [];
    collectDirEntries(path.join(__dirname, '.github'), '.github', entries);
    collectDirEntries(path.join(__dirname, 'android'), 'android', entries);
    collectDirEntries(path.join(__dirname, 'LEEME-APK.md'), 'README.md', entries);

    for (const entry of entries) {
      if (entry.relPath === 'android/app/src/main/assets/index.html') {
        let html = entry.data.toString('utf8');
        const forcedScript = `<script>window.__FORCED_EDITION=${JSON.stringify(edition)};</script>`;
        if (html.includes('window.__FORCED_EDITION=')) {
          html = html.replace(/<script>window\.__FORCED_EDITION="[^"]+";<\/script>/g, forcedScript);
        } else {
          html = html.replace('<head>', `<head>\n${forcedScript}`);
        }
        entry.data = Buffer.from(html, 'utf8');
      } else if (edition === 'classic') {
        // IMPORTANTE: Incluso la edición directa libre usa un applicationId NUEVO e independiente
        // (com.jackfriedrich.masterconsole) para instalarse como OTRA APP aparte sin sobrescribir Estudio Master Hi-Res
        if (entry.relPath === 'android/app/build.gradle.kts') {
          const g = entry.data
            .toString('utf8')
            .replace('applicationId = "com.jackfriedrich.masterstudiopro"', 'applicationId = "com.jackfriedrich.masterconsole"')
            .replace('versionName = "2.0.0-beta"', 'versionName = "2.0.0"');
          entry.data = Buffer.from(g, 'utf8');
        } else if (entry.relPath === 'android/app/src/main/res/values/strings.xml') {
          const sx = entry.data
            .toString('utf8')
            .replace('>JF Master Studio PRO<', '>Master Console DVC<');
          entry.data = Buffer.from(sx, 'utf8');
        } else if (entry.relPath === '.github/workflows/build-apk.yml') {
          const wf = entry.data
            .toString('utf8')
            .replace(/JF-Master-Studio-PRO\.apk/g, 'Master-Console-DVC.apk')
            .replace(/JF-Master-Studio-PRO-APK/g, 'Master-Console-DVC-APK')
            .replace(/JF Master Studio PRO[^\n"]*/g, 'Master Console DVC v2.0.0 — App Independiente');
          entry.data = Buffer.from(wf, 'utf8');
        }
      }
    }
    return buildZipBuffer(entries);
  };

  app.get('/api/master-pro-jack-friedrich-android.zip', (_req, res) => {
    try {
      const zipBuf = buildEditionAndroidZip('pro');
      res.setHeader('Content-Type', 'application/zip');
      res.setHeader('Content-Disposition', 'attachment; filename="JF-Master-Studio-PRO-App-Independiente.zip"');
      res.setHeader('Content-Length', String(zipBuf.length));
      res.send(zipBuf);
    } catch (_err) {
      res.status(500).json({ error: 'No se pudo empaquetar el proyecto Android PRO.' });
    }
  });

  const sendClassicAndroidZip = (_req: express.Request, res: express.Response) => {
    try {
      const zipBuf = buildEditionAndroidZip('classic');
      res.setHeader('Content-Type', 'application/zip');
      res.setHeader('Content-Disposition', 'attachment; filename="Master-Console-DVC-App-Independiente.zip"');
      res.setHeader('Content-Length', String(zipBuf.length));
      res.send(zipBuf);
    } catch (_err) {
      res.status(500).json({ error: 'No se pudo empaquetar el proyecto Android.' });
    }
  };

  app.get('/api/estudio-master-hires-android.zip', sendClassicAndroidZip);
  app.get('/api/estudio-eq-android.zip', sendClassicAndroidZip);

  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
