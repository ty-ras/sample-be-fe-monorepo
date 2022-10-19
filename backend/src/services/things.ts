import type * as db from "postgres";
import * as t from "io-ts";
import { function as F, task as T } from "fp-ts";
import * as internal from "./internal";

export const getThings = internal.createDBService(
  (returnValueValidation) =>
    F.flow(
      // Side-effect - log username to console
      (username: string, db: db.Sql) => {
        // eslint-disable-next-line no-console
        console.info(`Things queried by "${username}".`);
        // For the remainder, we only need DB.
        return db;
      },
      // Then return validated result rows, or throw if error
      internal.dbQueryWithoutParameters(
        "SELECT * FROM things",
        returnValueValidation,
      ),
    ),
  t.array(
    t.type(
      {
        id: t.string,
      },
      "Thing",
    ),
    "Things",
  ),
);

export const getThingsCount = internal.createDBService(
  () =>
    F.flow(
      internal.dbQueryWithoutParameters(
        // Notice ::int cast - by default count is BIGINT and results in string being returned instead of number
        "SELECT COUNT(*)::int AS total FROM things",
        internal.oneRowQuery(
          t.array(
            t.type({ total: t.number }, "ThingsCountRow"),
            "ThingsCountRows",
          ),
        ),
      ),
      T.map((totalRow) => totalRow.total),
    ),
  // Our final result type is different than the one of the DB query, since we do some post-transformation
  t.number,
);

export interface Thing {
  id: string;
}
