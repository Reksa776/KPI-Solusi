import type { RowDataPacket } from "mysql2";
import { getDb } from "@/lib/db";
import { defaultPackages, type PackageItem } from "@/lib/package-data";

type PackageRow = PackageItem & RowDataPacket & { features: string | string[] };

function normalize(row: PackageRow): PackageItem {
  let features: string[] = [];
  try {
    features = Array.isArray(row.features) ? row.features : JSON.parse(row.features || "[]");
  } catch {
    features = [];
  }
  return { ...row, features };
}

export async function getPublicPackages(): Promise<PackageItem[]> {
  try {
    const [rows] = await getDb().query<PackageRow[]>(
      "SELECT id, name, slug, tagline, description, price, features, highlighted, is_published, sort_order FROM packages WHERE is_published = 1 ORDER BY sort_order ASC, id ASC",
    );
    return rows.map(normalize);
  } catch {
    return defaultPackages;
  }
}

export async function getAdminPackages(): Promise<PackageItem[]> {
  const [rows] = await getDb().query<PackageRow[]>(
    "SELECT id, name, slug, tagline, description, price, features, highlighted, is_published, sort_order FROM packages ORDER BY sort_order ASC, id ASC",
  );
  return rows.map(normalize);
}

export async function getPackageById(id: number): Promise<PackageItem | null> {
  const [rows] = await getDb().execute<PackageRow[]>(
    "SELECT id, name, slug, tagline, description, price, features, highlighted, is_published, sort_order FROM packages WHERE id = ? LIMIT 1",
    [id],
  );
  return rows[0] ? normalize(rows[0]) : null;
}
