import type * as db from "postgres";
import * as t from "io-ts";
import { function as F } from "fp-ts";

export const getThings = async (username: string, db: db.Sql) => {
  // eslint-disable-next-line no-console
  console.info(`Things queried by "${username}".`);
  return thingsFlow(await db`SELECT * FROM things`);
};

export const getThingsCount = async (db: db.Sql) =>
  // Notice ::int cast - by default count is BIGINT and results in string being returned instead of number
  countFlow(await db`SELECT COUNT(*)::int AS total FROM things`)[0].total;

export interface Thing {
  id: string;
}

const thing = t.type(
  {
    id: t.string,
  },
  "Thing",
);

const things = t.array(thing, "Things");

const makeFlow = <T>(decoder: t.Decoder<unknown, T>) =>
  F.flow(decoder.decode, (result) => {
    if (result._tag === "Left") {
      throw new Error("");
    }
    return result.right;
  });

const thingsFlow = makeFlow(things);

const countFlow = makeFlow(t.array(t.type({ total: t.number })));
