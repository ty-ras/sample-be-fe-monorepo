import * as protocol from "../../protocol";
import * as aux from "../auxiliary";
import * as services from "../../services/things";

export const createThingsEndpoints = (builder: aux.Builder) => [
  builder.atURL``.batchSpec(getThings).createEndpoint({
    openapi: {
      summary: "Query things",
    },
  }),
  builder.atURL`/statistics`.batchSpec(getThingsCount).createEndpoint({
    openapi: {
      summary: "Get amount of things",
    },
  }),
];

const getThings = aux.createServiceEndpoint(services.getThings, {
  db: true,
  username: true,
})<protocol.APIGetThings>(
  ({
    state: {
      db: { db },
      username,
    },
  }) => [username, db],
  {
    method: "GET",
    mdArgs: {
      openapi: {
        urlParameters: undefined,
        queryParameters: undefined,
        requestHeaders: undefined,
        body: undefined,
        output: {
          description: "",
          mediaTypes: {
            "application/json": {
              example: [
                {
                  id: "DummyID",
                },
              ],
            },
          },
        },
        responseHeaders: undefined,
        operation: {},
      },
    },
  },
);

// Notice: this is not behind authentication.
// Just to demonstrate how non-authenticated endpoints can still access e.g. DB
const getThingsCount = aux.createServiceEndpoint(services.getThingsCount, {
  db: true,
})<protocol.APIThingsSummary>(
  ({
    state: {
      db: { db },
    },
  }) => [db],
  {
    method: "GET",
    mdArgs: {
      openapi: {
        urlParameters: undefined,
        queryParameters: undefined,
        requestHeaders: undefined,
        body: undefined,
        output: {
          description: "",
          mediaTypes: {
            "application/json": {
              example: 123,
            },
          },
        },
        responseHeaders: undefined,
        operation: {},
      },
    },
  },
);
