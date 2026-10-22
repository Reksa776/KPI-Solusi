import { PrismaClient, type Prisma } from "@prisma/client";

type QueryResult = { insertId: number; affectedRows: number };
type DbExecutor = {
  execute<T = QueryResult>(sql: string, values?: readonly unknown[]): Promise<[T, unknown]>;
  query<T = Record<string, unknown>[]>(sql: string, values?: readonly unknown[]): Promise<[T, unknown]>;
};
type Db = DbExecutor & {
  transaction<T>(callback: (tx: DbExecutor) => Promise<T>): Promise<T>;
};

const globalForPrisma = globalThis as typeof globalThis & { prisma?: PrismaClient; db?: Db };

function placeholders(sql: string) {
  // Existing queries use positional `?` placeholders. Validate the binding count
  // while ignoring question marks inside quoted text; MySQL Prisma uses `?` too.
  let out = "", quote = "", index = 1;
  for (let i = 0; i < sql.length; i++) {
    const ch = sql[i];
    if (quote) {
      out += ch;
      if (ch === quote && sql[i - 1] !== "\\") quote = "";
    } else if (ch === "'" || ch === '"' || ch === "`") { quote = ch; out += ch; }
    else if (ch === "?") { out += `?`; index++; }
    else out += ch;
  }
  return { sql: out, count: index - 1 };
}

function bind(sql: string, values: readonly unknown[] = []) {
  const converted = placeholders(sql);
  if (converted.count !== values.length) throw new Error(`SQL placeholder count mismatch (${converted.count}/${values.length}).`);
  return { sql: converted.sql, values: values as any[] };
}

function executor(client: Prisma.TransactionClient | PrismaClient): DbExecutor {
  return {
    async execute<T = QueryResult>(sql: string, values: readonly unknown[] = []) {
      const statement = bind(sql, values);
      if (/^\s*(SELECT|WITH|SHOW|DESCRIBE|EXPLAIN)\b/i.test(sql)) {
        const rows = await client.$queryRawUnsafe<T>(statement.sql, ...statement.values);
        return [rows, undefined] as [T, unknown];
      }
      const write = async (connection: Prisma.TransactionClient | PrismaClient) => {
        const affectedRows = await connection.$executeRawUnsafe(statement.sql, ...statement.values);
        let insertId = 0;
        if (/^\s*INSERT\b/i.test(sql)) {
          const [{ insertId: id }] = await connection.$queryRawUnsafe<Array<{ insertId: bigint | number }>>("SELECT LAST_INSERT_ID() AS insertId");
          insertId = Number(id ?? 0);
        }
        return [{ insertId, affectedRows } as T, undefined] as [T, unknown];
      };
      // LAST_INSERT_ID() must run on the same connection as INSERT. Prisma's
      // interactive transaction guarantees that for standalone inserts.
      if (/^\s*INSERT\b/i.test(sql) && client instanceof PrismaClient) return client.$transaction(write);
      return write(client);
    },
    async query<T = Record<string, unknown>[]>(sql: string, values: readonly unknown[] = []) {
      const statement = bind(sql, values);
      const rows = await client.$queryRawUnsafe<T>(statement.sql, ...statement.values);
      return [rows, undefined] as [T, unknown];
    },
  };
}

export function getDb(): Db {
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL belum disetel.");
  if (!globalForPrisma.prisma) globalForPrisma.prisma = new PrismaClient();
  if (!globalForPrisma.db) {
    const client = globalForPrisma.prisma;
    const queries = executor(client);
    globalForPrisma.db = {
      ...queries,
      async transaction<T>(callback: (tx: DbExecutor) => Promise<T>) {
        return client.$transaction(tx => callback(executor(tx)), { maxWait: 10_000, timeout: 30_000 });
      },
    };
  }
  return globalForPrisma.db;
}
