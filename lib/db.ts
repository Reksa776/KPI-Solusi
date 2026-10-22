import mysql, { type Pool } from "mysql2/promise";

const globalForMysql = globalThis as typeof globalThis & { mysqlPool?: Pool };

export function getDb() {
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL belum disetel.");
  if (!globalForMysql.mysqlPool) {
    const connection = new URL(process.env.DATABASE_URL);
    globalForMysql.mysqlPool = mysql.createPool({
      host: connection.hostname,
      port: connection.port ? Number(connection.port) : 3306,
      user: decodeURIComponent(connection.username),
      password: decodeURIComponent(connection.password),
      database: decodeURIComponent(connection.pathname.slice(1)),
      waitForConnections: true,
      connectionLimit: 10,
      maxIdle: 5,
      idleTimeout: 60_000,
      enableKeepAlive: true,
    });
  }
  return globalForMysql.mysqlPool;
}
