// Lightweight row/result types used by the legacy-shaped query results returned
// through Prisma's parameterized raw-query adapter in lib/db.ts.
export type RowDataPacket = Record<string, any>;
export type ResultSetHeader = { insertId: number; affectedRows: number };
