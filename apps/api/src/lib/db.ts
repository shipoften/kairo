import {
  createDb,
  type Database,
} from "@xs-share/db";

let database: Database | null = null;

export function getDb(): Database {
  if (!database) {
    database = createDb();
  }
  return database;
}

export function setDbForTests(testDatabase: Database | null) {
  database = testDatabase;
}
