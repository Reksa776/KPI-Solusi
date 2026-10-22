import { randomBytes, scrypt as scryptCallback } from "node:crypto";
import { promisify } from "node:util";
import { PrismaClient } from "@prisma/client";
import dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

const scrypt = promisify(scryptCallback);
const roles = new Set(["superadmin"]);

function readOption(name) {
  const index = process.argv.indexOf(name);
  return index === -1 ? "" : process.argv[index + 1] ?? "";
}

function askForPassword() {
  const stdin = process.stdin;
  if (!stdin.isTTY || typeof stdin.setRawMode !== "function") {
    return Promise.reject(new Error("Jalankan script dari terminal interaktif agar password bisa dimasukkan dengan aman."));
  }

  return new Promise((resolve, reject) => {
    let password = "";
    process.stdout.write("Password baru (tepat 8 karakter, input disembunyikan): ");
    stdin.setRawMode(true);
    stdin.resume();
    stdin.setEncoding("utf8");

    const finish = (error) => {
      stdin.setRawMode(false);
      stdin.pause();
      stdin.removeListener("data", onData);
      process.stdout.write("\n");
      if (error) reject(error);
      else resolve(password);
    };

    const onData = (chunk) => {
      for (const character of chunk) {
        if (character === "\u0003") return finish(new Error("Dibatalkan."));
        if (character === "\r" || character === "\n") return finish();
        if (character === "\u0008" || character === "\u007f") password = password.slice(0, -1);
        else if (character >= " ") password += character;
      }
    };

    stdin.on("data", onData);
  });
}

const email = readOption("--email").trim().toLowerCase();
const name = readOption("--name").trim();
const role = readOption("--role") || "superadmin";

if (!email || !name || !roles.has(role)) {
  console.error("Cara pakai: npm run create-user -- --email admin@contoh.id --name \"Nama Admin\"");
  console.error("Script bootstrap hanya membuat superadmin. Role lain dibuat oleh superadmin di dashboard.");
  process.exit(1);
}

if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL belum disetel. Isi .env.local atau export variabel tersebut sebelum menjalankan script.");
  process.exit(1);
}

const password = await askForPassword();
if (password.length !== 8) {
  console.error("Password harus tepat 8 karakter.");
  process.exit(1);
}

const salt = randomBytes(16).toString("hex");
const derivedKey = await scrypt(password, salt, 64);
const passwordHash = `scrypt$${salt}$${Buffer.from(derivedKey).toString("hex")}`;
const db = new PrismaClient();

try {
  await db.$executeRawUnsafe(
    "INSERT INTO users (full_name, email, password_hash, role, status) VALUES (?, ?, ?, ?, 'active')",
    name, email, passwordHash, role,
  );
  console.log(`User ${email} berhasil dibuat dengan role ${role}.`);
} catch (error) {
  if (error?.code === "P2002" || error?.code === "P2010" && /Duplicate entry/i.test(error?.message ?? "")) {
    console.error(`Email ${email} sudah terdaftar.`);
    process.exitCode = 1;
  } else if (error?.code === "P2010" && /doesn't exist|does not exist/i.test(error?.message ?? "")) {
    console.error("Tabel users belum tersedia. Jalankan database/schema.sql terlebih dahulu.");
    process.exitCode = 1;
  } else {
    console.error("Gagal membuat user:", error.message);
    process.exitCode = 1;
  }
} finally {
  await db.$disconnect();
}
