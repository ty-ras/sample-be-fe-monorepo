import * as dataGeneric from "@ty-ras/data";
import * as dataFE from "@ty-ras/data-frontend";
import * as data from "@ty-ras/data-io-ts";
import * as api from "@ty-ras/data-frontend-io-ts";
import type * as protocolData from "@ty-ras/protocol";
import * as t from "io-ts";
import * as tt from "io-ts-types";
import { either as E } from "fp-ts";
import * as client from "./client";
import * as protocol from "../../protocol";
import * as user from "../user";
import config from "../../config";

export const callRawHTTP = client.createCallHTTPEndpoint(config.backend);

const createBackend = () => {
  const factory = api.createAPICallFactory(callRawHTTP).withHeaders({
    auth: async () => {
      return `Bearer ${
        (await user.useUserStore.getState().getTokenForAuthorization()) ??
        doThrow("User is not logged in")
      }`;
    },
  });
  const getThingsStats = factory.makeAPICall<protocol.api.things.GetSummary>(
    "GET",
    {
      method: data.plainValidator(t.literal("GET")),
      url: "/api/thing/statistics",
      response: data.plainValidator(t.number), // data.plainValidator(t.array(datas.thing)),
    },
  );
  const authParams = {
    headersFunctionality: {
      Authorization: "auth",
    },
  } as const;
  const getThings = factory.makeAPICall<protocol.api.things.ReadAll>("GET", {
    ...authParams,
    method: data.plainValidator(t.literal("GET")),
    url: "/api/thing",
    response: data.plainValidator(t.array(datas.thing)),
  });
  const createThing = factory.makeAPICall<protocol.api.things.Create>("POST", {
    ...authParams,
    method: data.plainValidator(t.literal("POST")),
    url: "/api/thing",
    body: data.plainValidatorEncoder(
      t.intersection([
        t.type({
          payload: datas.thing.props.payload,
        }),
        t.partial({
          id: datas.thing.props.id,
        }),
      ]),
      false,
    ),
    response: data.plainValidator(datas.thing),
  });
  const thingSpecificURL = dataGeneric.transitiveDataValidation(
    data.plainValidatorEncoder(
      t.type({
        id: t.string,
      }),
      false,
    ),
    ({ id }): dataGeneric.DataValidatorResult<string> => ({
      error: "none",
      data: `/api/thing/${id}`,
    }),
  );
  const deleteThing = factory.makeAPICall<protocol.api.things.Delete>(
    "DELETE",
    {
      ...authParams,
      method: data.plainValidator(t.literal("DELETE")),
      url: thingSpecificURL,
      response: data.plainValidator(datas.thing),
    },
  );
  const updateThing = factory.makeAPICall<protocol.api.things.Update>("PATCH", {
    ...authParams,
    method: data.plainValidator(t.literal("PATCH")),
    url: thingSpecificURL,
    body: data.plainValidatorEncoder(
      t.partial({
        payload: t.string,
      }),
      false,
    ),
    response: data.plainValidator(datas.thing),
  });
  const readThing = factory.makeAPICall<protocol.api.things.Read>("GET", {
    ...authParams,
    method: data.plainValidator(t.literal("GET")),
    url: thingSpecificURL,
    response: data.plainValidator(datas.thing),
  });
  return {
    createThing,
    readThing,
    updateThing,
    deleteThing,
    getThings,
    getThingsStats,
  };
};

const datas = {
  thing: t.type({
    id: t.string,
    payload: t.string,
    created_at: tt.DateFromISOString,
    updated_at: tt.DateFromISOString,
    created_by: t.string,
    updated_by: t.string,
  }),
} as const;

const doThrow = (msg: string) => {
  throw new Error(msg);
};

const backend = createBackend();
export default backend;

export type APICallError = Exclude<
  dataFE.APICallResult<never>,
  dataGeneric.DataValidatorResultSuccess<never>
>;

export type NativeOrAPICallError = APICallError | Error;

export const toEither = <T>(
  result: dataFE.APICallResult<T>,
): E.Either<APICallError, protocolData.RuntimeOf<T>> =>
  result.error === "none" ? E.right(result.data) : E.left(result);
