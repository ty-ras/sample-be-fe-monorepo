import * as t from "io-ts";
import * as common from "./common";
import * as internal from "./internal";
import * as data from "@ty-ras/data-io-ts";
import { function as F, taskEither as TE } from "fp-ts";

// Runtime validation for rows of 'things' table.
const nonEmptyString = t.refinement(
  t.string,
  (s) => s.length > 0,
  "NonEmptyString",
);
// This is RFC-adhering UUID regex. Relax if needed.
// Taken from https://stackoverflow.com/questions/7905929/how-to-test-valid-uuid-guid
export const thingIDRegex =
  /[0-9a-f]{8}-[0-9a-f]{4}-[0-5][0-9a-f]{3}-[089ab][0-9a-f]{3}-[0-9a-f]{12}/i;

// TODO once this is in use throughout BE, check if using branded type causes compilation errors.
// const idInBody = t.brand(
//   t.string,
//   (str): str is t.Branded<string, { readonly ID: unique symbol }> =>
//     idRegex.test(str),
//   "ID",
// );
export const thingID = t.refinement(
  t.string,
  (str) => thingIDRegex.test(str),
  "ThingID",
);
// We could also use 'exact' here and just use 'RETURNING *' in SQLs.
// However, that would be just excess traffic between BE and DB, and also would cause construction of new object on every row.
// Therefore, we use vasic 'type' validation + construct the correct column list to use it in queries
export const thingValidation = t.type({
  id: thingID,
  payload: t.string,
  created_at: data.instanceOf(Date, "Date"),
  updated_at: data.instanceOf(Date, "Date"),
  created_by: nonEmptyString,
  updated_by: nonEmptyString,
});

// Will be: "id, payload, created_at, created_by, updated_at, updated_by"
const thingColumnListString = internal.rawSQL(
  internal.createSQLColumnList<Thing>({
    id: undefined,
    payload: undefined,
    created_at: undefined,
    created_by: undefined,
    updated_at: undefined,
    updated_by: undefined,
  }),
);

// CRUD
export const createThing = internal
  .createSimpleDBService(
    internal.withSQL`INSERT INTO things(id, payload, created_by) VALUES (COALESCE(${"id"}, gen_random_uuid()), ${"payload"}, ${"username"}) RETURNING ${thingColumnListString}`.validateRow(
      thingValidation,
    ),
  )
  .createFlow<CreateThingInput>(({ username, thing: { id, payload } }) => ({
    username,
    id,
    payload,
  }));

export const getThing = internal
  .createSimpleDBService(
    internal.withSQL`SELECT * FROM things WHERE is_deleted IS FALSE AND id = ${"id"}`.validateRow(
      thingValidation,
    ),
  )
  .createFlow<GetThingInput>(({ thing }) => thing);

export const updateThing = internal
  .createSimpleDBService(
    internal.withSQL`UPDATE things t SET updated_by = ${"username"}, payload = CASE WHEN ${"payloadPresent"} IS TRUE THEN ${"payload"} ELSE t.payload END WHERE is_deleted IS FALSE AND id = ${"id"} RETURNING ${thingColumnListString}`.validateRow(
      thingValidation,
    ),
  )
  .createFlow<UpdateThingInput>(({ username, thing: { id, payload } }) => ({
    username,
    id,
    payload,
    payloadPresent: payload !== undefined,
  }));

export const deleteThing = internal
  .createSimpleDBService(
    internal.withSQL`UPDATE things SET deleted_by = ${"username"}, is_deleted = TRUE WHERE is_deleted IS FALSE AND id = ${"id"} RETURNING ${thingColumnListString}`.validateRow(
      thingValidation,
    ),
  )
  .createFlow<DeleteThingInput>(({ username, thing }) => ({
    username,
    ...thing,
  }));

// Getting more than one thing at a time
export const getThings = internal
  .createSimpleDBService(
    internal.withSQL`SELECT ${thingColumnListString} FROM things WHERE is_deleted IS FALSE`.validateRows(
      thingValidation,
    ),
  )
  .createFlow<common.AuthenticatedInput>(({ username }) => {
    // eslint-disable-next-line no-console
    console.info(`Things queried by "${username}".`);
  });

// Things statistics
export const getThingsCount = internal
  .createSimpleDBService({
    validation: t.number,
    task: F.flow(
      internal
        .withSQL(
          // Notice ::int cast - by default count is BIGINT and results in string being returned instead of number
          // Also notice: this returns also rows marked as deleted!
          `SELECT things_quick_count()::int AS estimate`,
        )
        .validateRow(t.type({ estimate: t.number }, "ThingsCountRow")).task,
      TE.map(({ estimate }) => estimate),
    ),
  })
  .createFlow<common.UnauthenticatedInput>(() => {});

// Types
export type Thing = t.TypeOf<typeof thingValidation>;
export type ThingPayload = Omit<
  Thing,
  "id" | "created_at" | "updated_at" | "created_by" | "updated_by"
>;
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
