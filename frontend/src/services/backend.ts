import * as tyras from "@ty-ras/frontend-fetch-io-ts";
import * as t from "io-ts";
import * as tt from "io-ts-types";
import * as protocol from "protocol";
import * as user from "./user";
import config from "config";

export const callRawHTTP = tyras.createCallHTTPEndpoint(config.backend);

const createBackend = () => {
  const factory = tyras.createAPICallFactory(callRawHTTP).withHeaders({
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
      method: tyras.plainValidator(t.literal("GET")),
      url: "/api/thing/statistics",
      response: tyras.plainValidator(t.number),
    },
  );
  const authParams = {
    headersFunctionality: {
      Authorization: "auth",
    },
  } as const;
  const getThings = factory.makeAPICall<protocol.api.things.ReadAll>("GET", {
    ...authParams,
    method: tyras.plainValidator(t.literal("GET")),
    url: "/api/thing",
    response: tyras.plainValidator(t.array(datas.thing)),
  });
  const createThing = factory.makeAPICall<protocol.api.things.Create>("POST", {
    ...authParams,
    method: tyras.plainValidator(t.literal("POST")),
    url: "/api/thing",
    body: tyras.plainValidatorEncoder(
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
    response: tyras.plainValidator(datas.thing),
  });
  const thingSpecificURL = tyras.transitiveDataValidation(
    tyras.plainValidatorEncoder(
      t.type({
        id: t.string,
      }),
      false,
    ),
    ({ id }): tyras.DataValidatorResult<string> => ({
      error: "none",
      data: `/api/thing/${id}`,
    }),
  );
  const deleteThing = factory.makeAPICall<protocol.api.things.Delete>(
    "DELETE",
    {
      ...authParams,
      method: tyras.plainValidator(t.literal("DELETE")),
      url: thingSpecificURL,
      response: tyras.plainValidator(datas.thing),
    },
  );
  const restoreThing = factory.makeAPICall<protocol.api.things.Undelete>(
    "POST",
    {
      ...authParams,
      method: tyras.plainValidator(t.literal("POST")),
      url: thingSpecificURL,
      response: tyras.plainValidator(datas.thing),
    },
  );
  const updateThing = factory.makeAPICall<protocol.api.things.Update>("PATCH", {
    ...authParams,
    method: tyras.plainValidator(t.literal("PATCH")),
    url: thingSpecificURL,
    body: tyras.plainValidatorEncoder(
      t.partial({
        payload: t.string,
      }),
      false,
    ),
    response: tyras.plainValidator(datas.thing),
  });
  const readThing = factory.makeAPICall<protocol.api.things.Read>("GET", {
    ...authParams,
    method: tyras.plainValidator(t.literal("GET")),
    url: thingSpecificURL,
    response: tyras.plainValidator(datas.thing),
  });
  return {
    createThing,
    readThing,
    updateThing,
    deleteThing,
    restoreThing,
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
