import { spawnSync } from "node:child_process";
import { chmod, mkdir, readdir, rm, stat } from "node:fs/promises";
import path from "node:path";
import dotenv from "dotenv";

dotenv.config({ path: ".env.local" });
if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL belum disetel.");

const database = new URL(process.env.DATABASE_URL);
const name = decodeURIComponent(database.pathname.slice(1));
const date = new Date().toISOString().replaceAll(":", "-").replaceAll(".", "-");
const root = path.join(process.cwd(), "backups", date);
await mkdir(root, { recursive: true });
const sqlFile = path.join(root, `${name}.sql`);
const dump = spawnSync("mysqldump", ["--single-transaction", "--routines", "--triggers", "--result-file", sqlFile, "--host", database.hostname, "--port", database.port || "3306", "--user", decodeURIComponent(database.username), "--databases", name], {
  env: { ...process.env, MYSQL_PWD: decodeURIComponent(database.password) },
});
if (dump.error) throw new Error(`mysqldump gagal dijalankan: ${dump.error.message}`);
if (dump.status !== 0) throw new Error(`mysqldump gagal dengan kode ${dump.status}.`);
await chmod(sqlFile, 0o600);

const branding = path.join(process.cwd(), "data", "branding");
try {
  await stat(branding);
  const archive = spawnSync("tar", ["-czf", path.join(root, "branding.tar.gz"), "-C", path.join(process.cwd(), "data"), "branding"], { encoding: "utf8" });
  if (archive.error || archive.status !== 0) throw new Error(archive.error?.message ?? archive.stderr.trim());
} catch (error) {
  if (error?.code !== "ENOENT") throw error;
  console.log("Folder branding belum ada; hanya backup database dibuat.");
}

const directories = (await readdir(path.join(process.cwd(), "backups"), { withFileTypes: true })).filter((entry) => entry.isDirectory()).sort((a,b)=>b.name.localeCompare(a.name));
for (const old of directories.slice(30)) await rm(path.join(process.cwd(), "backups", old.name), { recursive: true, force: true });
console.log(`Backup dibuat: ${path.relative(process.cwd(), root)} (retensi 30 backup terakhir).`);
