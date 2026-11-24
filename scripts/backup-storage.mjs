import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { createClient } from '@supabase/supabase-js';

function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return;
  const content = fs.readFileSync(filePath, 'utf8');
  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const eqIndex = line.indexOf('=');
    if (eqIndex <= 0) continue;
    const key = line.slice(0, eqIndex).trim();
    let value = line.slice(eqIndex + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (!process.env[key]) {
      process.env[key] = value;
    }
  }
}

loadEnvFile(path.resolve(process.cwd(), '.env.local'));
loadEnvFile(path.resolve(process.cwd(), '.env'));

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const bucketName = process.env.STORAGE_BUCKET_NAME || 'site-photos';
const outputDir = path.resolve(process.argv[2] || './backups/storage-tmp');

if (!supabaseUrl || !serviceRoleKey) {
  console.error(
    'Errore: imposta SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY per eseguire il backup dello Storage.'
  );
  process.exit(1);
}

const adminClient = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function listAllPaths(prefix = '') {
  const paths = [];
  let offset = 0;
  const limit = 100;

  while (true) {
    const { data, error } = await adminClient.storage
      .from(bucketName)
      .list(prefix, { limit, offset, sortBy: { column: 'name', order: 'asc' } });

    if (error) throw error;
    if (!data || data.length === 0) break;

    for (const item of data) {
      const fullPath = prefix ? `${prefix}/${item.name}` : item.name;
      if (item.id === null) {
        const nested = await listAllPaths(fullPath);
        paths.push(...nested);
      } else {
        paths.push(fullPath);
      }
    }

    if (data.length < limit) break;
    offset += limit;
  }

  return paths;
}

async function main() {
  fs.mkdirSync(outputDir, { recursive: true });
  const objectPaths = await listAllPaths('');
  const manifest = [];

  if (objectPaths.length === 0) {
    fs.writeFileSync(
      path.join(outputDir, 'manifest.json'),
      JSON.stringify({ bucket: bucketName, exportedAt: new Date().toISOString(), files: [] }, null, 2)
    );
    console.log(`Bucket "${bucketName}" vuoto: manifest generato con 0 file.`);
    return;
  }

  for (const objectPath of objectPaths) {
    const { data, error } = await adminClient.storage
      .from(bucketName)
      .download(objectPath);

    if (error || !data) {
      throw error || new Error(`Impossibile scaricare ${objectPath}`);
    }

    const buffer = Buffer.from(await data.arrayBuffer());
    const targetPath = path.join(outputDir, objectPath);
    fs.mkdirSync(path.dirname(targetPath), { recursive: true });
    fs.writeFileSync(targetPath, buffer);

    const sha256 = crypto.createHash('sha256').update(buffer).digest('hex');
    manifest.push({ path: objectPath, size: buffer.length, sha256 });
  }

  fs.writeFileSync(
    path.join(outputDir, 'manifest.json'),
    JSON.stringify(
      {
        bucket: bucketName,
        exportedAt: new Date().toISOString(),
        filesCount: manifest.length,
        files: manifest,
      },
      null,
      2
    )
  );

  console.log(
    `Esportati ${manifest.length} file dal bucket "${bucketName}" in ${outputDir}.`
  );
}

main().catch((err) => {
  console.error('Errore durante backup Storage:', err);
  process.exit(1);
});
