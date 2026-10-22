import { createReadStream } from "node:fs";
import { realpath } from "node:fs/promises";
import { spawn, spawnSync } from "node:child_process";
import path from "node:path";
import dotenv from "dotenv";

dotenv.config({ path: ".env.local" });
if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL belum disetel.");
if (!process.argv.includes("--confirm")) throw new Error("Pemulihan mengganti isi database. Ulangi dengan --confirm setelah memastikan target database benar.");
const arg = (name) => { const index = process.argv.indexOf(name); return index < 0 ? "" : process.argv[index + 1] ?? ""; };
const backupRoot = await realpath(path.join(process.cwd(), "backups"));
const sqlPath = await realpath(path.resolve(arg("--sql")));
if (!sqlPath.startsWith(`${backupRoot}${path.sep}`) || !sqlPath.endsWith(".sql")) throw new Error("File SQL harus berasal dari folder backups proyek.");
const brandingArg = arg("--branding");
let archivePath = "";
if (brandingArg) {
  archivePath = await realpath(path.resolve(brandingArg));
  if (!archivePath.startsWith(`${backupRoot}${path.sep}`) || !archivePath.endsWith(".tar.gz")) throw new Error("Arsip branding harus berasal dari folder backups proyek.");
}

const url = new URL(process.env.DATABASE_URL);
const child = spawn("mysql", ["--host", url.hostname, "--port", url.port || "3306", "--user", decodeURIComponent(url.username)], { env: { ...process.env, MYSQL_PWD: decodeURIComponent(url.password) }, stdio: ["pipe", "inherit", "inherit"] });
createReadStream(sqlPath).pipe(child.stdin);
const status = await new Promise((resolve, reject) => { child.on("error", reject); child.on("close", resolve); });
if (status !== 0) throw new Error(`mysql restore gagal dengan kode ${status}.`);

if (brandingArg) {
  const target = path.join(process.cwd(), "data");
  const result = spawnSync("tar", ["-xzf", archivePath, "-C", target, "--overwrite"], { stdio: "inherit" });
  if (result.error || result.status !== 0) throw new Error(result.error?.message ?? "Pemulihan branding gagal.");
}
console.log("Pemulihan selesai. Periksa login, paket, dan branding sebelum membuka website ke publik.");
