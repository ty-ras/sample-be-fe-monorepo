import type * as config from "./config";
import * as api from "./api";
import * as pg from "postgres";

export const createDBPool = ({
  dbName,
  ...database
}: config.Config["database"]) =>
  new api.Database(
    pg.default({
      ...database,
      database: dbName,
    }),
  );
