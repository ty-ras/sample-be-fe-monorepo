import * as data from "@ty-ras/data-io-ts";
import * as api from "@ty-ras/data-frontend-io-ts";
import * as t from "io-ts";
import * as client from "./client";
import env from "../../environment";
import * as protocol from "../../protocol";

export const callRawHTTP = client.createCallHTTPEndpoint(env.backend);

const createBackend = () => {
  const factory = api.createAPICallFactory(callRawHTTP).withHeaders({
    auth: () => {
      return "No";
    },
  });
  const getThingsStats = factory.makeAPICall<protocol.APIThingsSummary>("GET", {
    method: data.plainValidator(t.literal("GET")),
    url: "/api/thing/statistics",
    response: data.plainValidator(t.number), // data.plainValidator(t.array(datas.thing)),
  });
};
const datas = {
  thing: t.type({
    id: t.string,
  }),
} as const;
