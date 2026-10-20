import { defineConfig, type Plugin } from 'vite';
import fs from 'node:fs';
import path from 'node:path';

const SOUND_DIR = path.resolve(__dirname, 'public/sounds');
const MANIFEST = path.join(SOUND_DIR, 'manifest.json');

function writeManifest() {
  const names = fs
    .readdirSync(SOUND_DIR)
    .filter((f) => f.endsWith('.wav'))
    .map((f) => f.slice(0, -4))
    .sort();
  fs.writeFileSync(MANIFEST, JSON.stringify(names, null, 2) + '\n');
  return names;
}

/**
 * Nur im Dev-Server: Endpunkt fürs Sound-Studio (recorder.html).
 *   GET    /__sounds         → Liste der aufgenommenen Sounds
 *   POST   /__sounds/<name>  → WAV speichern unter public/sounds/<name>.wav
 *   DELETE /__sounds/<name>  → Aufnahme löschen (Spiel nutzt wieder den Synth-Sound)
 */
function soundStudio(): Plugin {
  return {
    name: 'sound-studio',
    apply: 'serve',
    configureServer(server) {
      fs.mkdirSync(SOUND_DIR, { recursive: true });
      server.middlewares.use('/__sounds', (req, res) => {
        const name = decodeURIComponent((req.url ?? '/').replace(/^\//, '').split('?')[0]);
        const send = (code: number, body: unknown) => {
          res.statusCode = code;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify(body));
        };
        if (req.method === 'GET' && !name) return send(200, writeManifest());
        // nur einfache Namen, damit niemand aus dem Ordner ausbrechen kann
        if (!/^[a-z0-9_-]{1,32}$/.test(name)) return send(400, { error: 'ungültiger Name' });
        const file = path.join(SOUND_DIR, `${name}.wav`);
        if (req.method === 'DELETE') {
          if (fs.existsSync(file)) fs.unlinkSync(file);
          return send(200, writeManifest());
        }
        if (req.method === 'POST') {
          const chunks: Buffer[] = [];
          let size = 0;
          req.on('data', (c: Buffer) => {
            size += c.length;
            if (size > 5 * 1024 * 1024) req.destroy(); // max. 5 MB
            else chunks.push(c);
          });
          req.on('end', () => {
            const buf = Buffer.concat(chunks);
            if (buf.subarray(0, 4).toString() !== 'RIFF') return send(400, { error: 'keine WAV-Datei' });
            fs.writeFileSync(file, buf);
            send(200, writeManifest());
          });
          return;
        }
        send(405, { error: 'Methode nicht erlaubt' });
      });
    },
  };
}

const MAP_DIR = path.resolve(__dirname, 'src/maps');
const BACKUP_DIR = path.join(MAP_DIR, 'backups');

/**
 * Nur im Dev-Server: Endpunkt für den Map-Editor (editor.html). Schreibt ausschließlich in src/maps.
 *   GET  /__maps                    → { maps: [...], backups: [...] }
 *   GET  /__maps/<name>             → src/maps/<name>.json
 *   GET  /__maps/backups/<datei>    → Sicherung
 *   POST /__maps/<name>             → speichern; die alte Datei wird vorher nach src/maps/backups gesichert
 */
function mapEditor(): Plugin {
  return {
    name: 'map-editor',
    apply: 'serve',
    configureServer(server) {
      fs.mkdirSync(BACKUP_DIR, { recursive: true });
      server.middlewares.use('/__maps', (req, res) => {
        const url = decodeURIComponent((req.url ?? '/').replace(/^\//, '').split('?')[0]);
        const send = (code: number, body: unknown) => {
          res.statusCode = code;
          res.setHeader('Content-Type', 'application/json');
          res.end(typeof body === 'string' ? body : JSON.stringify(body));
        };
        const jsonFiles = (dir: string) => fs.readdirSync(dir).filter((f) => f.endsWith('.json')).sort();
        if (req.method === 'GET' && !url) return send(200, { maps: jsonFiles(MAP_DIR).map((f) => f.slice(0, -5)), backups: jsonFiles(BACKUP_DIR).reverse() });
        if (req.method === 'GET' && url.startsWith('backups/')) {
          const f = url.slice(8);
          if (!/^[a-z0-9_.-]{1,80}\.json$/.test(f) || !fs.existsSync(path.join(BACKUP_DIR, f))) return send(404, { error: 'nicht gefunden' });
          return send(200, fs.readFileSync(path.join(BACKUP_DIR, f), 'utf8'));
        }
        if (!/^[a-z0-9_-]{1,32}$/.test(url)) return send(400, { error: 'ungültiger Name' });
        const file = path.join(MAP_DIR, `${url}.json`);
        if (req.method === 'GET') return fs.existsSync(file) ? send(200, fs.readFileSync(file, 'utf8')) : send(404, { error: 'nicht gefunden' });
        if (req.method === 'POST') {
          const chunks: Buffer[] = [];
          let size = 0;
          req.on('data', (c: Buffer) => {
            size += c.length;
            if (size > 5 * 1024 * 1024) req.destroy();
            else chunks.push(c);
          });
          req.on('end', () => {
            let data: { rows?: unknown };
            try {
              data = JSON.parse(Buffer.concat(chunks).toString('utf8'));
            } catch {
              return send(400, { error: 'kein gültiges JSON' });
            }
            if (url !== 'prefabs' && !Array.isArray(data.rows)) return send(400, { error: 'keine Kartendaten' });
            let backup: string | null = null;
            if (fs.existsSync(file)) {
              const stamp = new Date().toISOString().replace(/[:T]/g, '-').slice(0, 19);
              backup = `${url}-${stamp}.json`;
              fs.copyFileSync(file, path.join(BACKUP_DIR, backup));
            }
            fs.writeFileSync(file, JSON.stringify(data, null, 2) + '\n');
            send(200, { ok: true, backup });
          });
          return;
        }
        send(405, { error: 'Methode nicht erlaubt' });
      });
    },
  };
}

export default defineConfig({
  // relative Pfade: der dist-Ordner läuft so in jedem Unterordner eines Webspace
  base: './',
  // preserveSymlinks: verhindert, dass Vite den (virtualisierten) Windows-Pfad auflöst
  resolve: { preserveSymlinks: true },
  build: { chunkSizeWarningLimit: 2000 },
  plugins: [soundStudio(), mapEditor()],
});
