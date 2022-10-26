import * as t from "io-ts";
import { function as F, task as T } from "fp-ts";
import * as common from "./common";
import * as internal from "./internal";
import * as data from "@ty-ras/data-io-ts";

// Runtime validation for rows of 'things' table.
export const thingValidation = t.type({
  id: t.string,
  payload: t.string,
  created_at: data.instanceOf(Date, "Date"),
  updated_at: data.instanceOf(Date, "Date"),
});

// CRUD
export const createThing = internal.createDBServiceForSingleRow(
  (queryValidation) => {
    const queryWithoutID = F.pipe(
      internal.dbQueryWithParameters(
        queryValidation,
      )`INSERT INTO things(payload) VALUES (${"payload"}) RETURNING *`,
      internal.usePool,
    );
    const queryWithID = F.pipe(
      internal.dbQueryWithParameters(
        queryValidation,
      )`INSERT INTO things(id, payload) VALUES (${"id"}, ${"payload"}) RETURNING *`,
      internal.usePool,
    );

    return F.flow(({ db, thing: { payload, id } }: CreateThingInput) =>
      typeof id === "string"
        ? queryWithID(db, { id, payload })
        : queryWithoutID(db, { payload }),
    );
  },
  thingValidation,
);

export const getThing = internal.createDBServiceForSingleRow(
  (queryValidation) => {
    const query = F.pipe(
      internal.dbQueryWithParameters(
        queryValidation,
      )`SELECT * FROM things WHERE is_deleted IS FALSE AND id = ${"id"}`,
      internal.usePool,
    );
    return F.flow(({ db, thing: { id } }: GetThingInput) => query(db, { id }));
  },
  thingValidation,
);

export const updateThing = internal.createDBServiceForSingleRow(
  (queryValidation) => {
    const query = F.pipe(
      internal.dbQueryWithParameters(
        queryValidation,
      )`UPDATE things t SET payload = CASE WHEN ${"payloadPresent"} IS TRUE THEN ${"payload"} ELSE t.payload WHERE is_deleted IS FALSE AND id = ${"id"} RETURNING *`,
      internal.usePool,
    );
    return F.flow(({ db, thing: { id, payload } }: UpdateThingInput) =>
      query(db, { id, payload, payloadPresent: typeof payload === "string" }),
    );
  },
  thingValidation,
);

export const deleteThing = internal.createDBServiceForSingleRow(
  (queryValidation) => {
    const query = F.pipe(
      internal.dbQueryWithParameters(
        queryValidation,
      )`UPDATE things SET is_deleted = TRUE WHERE is_deleted IS FALSE AND id = ${"id"} RETURNING *`,
      internal.usePool,
    );
    return F.flow(({ db, thing: { id } }: DeleteThingInput) =>
      query(db, { id }),
    );
  },
  thingValidation,
);

// Getting more than one thing at a time
export const getThings = internal.createDBService((returnValueValidation) => {
  const query = F.pipe(
    internal.dbQueryWithoutParameters(
      "SELECT * FROM things WHERE is_deleted IS FALSE",
      returnValueValidation,
    ),
    internal.usePool,
  );
  return F.flow(
    // Side-effect - log username to console
    ({ username, db }: common.AuthenticatedInput) => {
      // eslint-disable-next-line no-console
      console.info(`Things queried by "${username}".`);
      // For the remainder, we only need DB.
      return db;
    },
    // Then return validated result rows, or throw if error
    query,
  );
}, t.array(thingValidation));

// Things statistics
export const getThingsCount = internal.createDBService(
  () => {
    const query = F.pipe(
      internal.dbQueryWithoutParameters(
        // Notice ::int cast - by default count is BIGINT and results in string being returned instead of number
        "SELECT COUNT(*)::int AS total FROM things",
        internal.arrayOfOneElement(
          t.type({ total: t.number }, "ThingsCountRow"),
        ),
      ),
      internal.usePool,
    );
    return F.flow(
      ({ db }: common.UnauthenticatedInput) => db,
      query,
      T.map((totalRow) => totalRow.total),
    );
  },
  // Our final result type is different than the one of the DB query, since we do some post-transformation
  t.number,
);

// Types
export type Thing = t.TypeOf<typeof thingValidation>;
export type ThingPayload = Omit<Thing, "id" | "created_at" | "updated_at">;
export type ThingID = Pick<Thing, "id">;
export type ThingInput<T> = { thing: T };

export type SpecificThingInput<TThingID = ThingID> = common.AuthenticatedInput &
  ThingInput<TThingID>;
export type CreateThingInput = SpecificThingInput<Partial<ThingID>> &
  ThingInput<ThingPayload>;
export type GetThingInput = SpecificThingInput & { includeDeleted?: boolean };
export type UpdateThingInput = SpecificThingInput &
  // Notice that Partial<ThingPayload> does not work super-well with this example of only one payload column
  ThingInput<Partial<ThingPayload>>;
export type DeleteThingInput = SpecificThingInput;
