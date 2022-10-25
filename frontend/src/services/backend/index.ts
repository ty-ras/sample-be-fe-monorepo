import * as data from "@ty-ras/data-io-ts";
import * as api from "@ty-ras/data-frontend-io-ts";
import * as t from "io-ts";
import * as tt from "io-ts-types";
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
  return {
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
  }),
} as const;

const doThrow = (msg: string) => {
  throw new Error(msg);
};

const backend = createBackend();
export default backend;
