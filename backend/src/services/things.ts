import * as t from "io-ts";
import * as common from "./common";
import * as data from "@ty-ras/data-io-ts";
import { function as F } from "fp-ts";
import * as sql from "@ty-ras/typed-sql-io-ts";
import * as internal from "./internal";

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
const thingColumnListString = sql.raw(
  internal.createSQLColumnList<Thing>({
    id: undefined,
    payload: undefined,
    created_at: undefined,
    created_by: undefined,
    updated_at: undefined,
    updated_by: undefined,
  }),
);

const idParameter = sql.parameter("id", thingID);
const idOptParameter = sql.parameter("id", t.union([thingID, t.undefined]));
const usernameParameter = sql.parameter("username", nonEmptyString);
const payloadParameter = sql.parameter("payload", t.string);
const payloadOptParameter = sql.parameter(
  "payload",
  t.union([t.string, t.undefined]),
);

// CRUD
export const createThing = F.pipe(
  ({ username, thing: { id, payload } }: CreateThingInput) => ({
    username,
    id,
    payload,
  }),
  internal.CRUDEndpoint(
    sql.executeSQLQuery`INSERT INTO things(id, payload, created_by) VALUES (COALESCE(${idOptParameter}, gen_random_uuid()), ${payloadParameter}, ${usernameParameter}) RETURNING ${thingColumnListString}`,
    thingValidation,
  ),
);
export const getThing = F.pipe(
  ({ thing }: GetThingInput) => thing,
  internal.CRUDEndpoint(
    sql.executeSQLQuery`SELECT * FROM things WHERE is_deleted IS FALSE AND id = ${idParameter}`,
    thingValidation,
  ),
);

export const updateThing = F.pipe(
  ({ username, thing: { id, payload } }: UpdateThingInput) => ({
    username,
    id,
    payload,
    payloadPresent: payload !== undefined,
  }),
  internal.CRUDEndpoint(
    sql.executeSQLQuery`UPDATE things t SET updated_by = ${usernameParameter}, payload = CASE WHEN ${sql.parameter(
      "payloadPresent",
      t.boolean,
    )} IS TRUE THEN ${payloadOptParameter} ELSE t.payload END WHERE is_deleted IS FALSE AND id = ${idParameter} RETURNING ${thingColumnListString}`,
    thingValidation,
  ),
);

export const deleteThing = F.pipe(
  ({ username, thing }: DeleteThingInput) => ({
    username,
    ...thing,
  }),
  internal.CRUDEndpoint(
    sql.executeSQLQuery`UPDATE things SET deleted_by = ${usernameParameter}, is_deleted = TRUE WHERE is_deleted IS FALSE AND id = ${idParameter} RETURNING ${thingColumnListString}`,
    thingValidation,
  ),
);

export const undeleteThing = F.pipe(
  ({ username, thing: { id } }: UndeleteThingInput) => ({
    username,
    id,
  }),
  internal.CRUDEndpoint(
    sql.executeSQLQuery`UPDATE things SET updated_by = ${usernameParameter}, is_deleted = FALSE WHERE is_deleted IS TRUE AND id = ${idParameter} RETURNING ${thingColumnListString}`,
    thingValidation,
  ),
);

// Getting more than one thing at a time
export const getThings = F.pipe(({ username }: common.AuthenticatedInput) => {
  // eslint-disable-next-line no-console
  console.info(`Things queried by "${username}".`);
}, internal.singleQueryEndpoint(sql.executeSQLQuery`SELECT ${thingColumnListString} FROM things WHERE is_deleted IS FALSE`, sql.many(thingValidation)));

// Things statistics
export const getThingsCount = F.pipe(
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  (_: common.UnauthenticatedInput) => {},
  internal.singleQueryEndpoint(
    sql.executeSQLQuery`SELECT table_quick_count('things')::int AS estimate`,
    sql.one(t.type({ estimate: t.number })),
  ),
  common.transformReturnType(({ estimate }) => estimate, t.number),
);

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
export type UndeleteThingInput = SpecificThingInput;
