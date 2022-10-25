import * as data from "@ty-ras/data-io-ts";
import * as api from "@ty-ras/data-frontend-io-ts";
import * as t from "io-ts";
import * as client from "./client";
import * as protocol from "../../protocol";
import * as user from "../user";
import config from "../../config";

export const callRawHTTP = client.createCallHTTPEndpoint(config.backend);

const createBackend = () => {
  const factory = api.createAPICallFactory(callRawHTTP).withHeaders({
    auth: async () => {
      return (
        (await user.useUserStore.getState().getTokenForAuthorization()) ??
        doThrow("User is not logged in")
      );
    },
  });
  const getThingsStats = factory.makeAPICall<protocol.APIThingsSummary>("GET", {
    method: data.plainValidator(t.literal("GET")),
    url: "/api/thing/statistics",
    response: data.plainValidator(t.number), // data.plainValidator(t.array(datas.thing)),
  });
  return {
    getThingsStats,
  };
};
const datas = {
  thing: t.type({
    id: t.string,
  }),
} as const;

const doThrow = (msg: string) => {
  throw new Error(msg);
};
