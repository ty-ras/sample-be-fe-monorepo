import * as protocol from "../../protocol";
import * as aux from "../auxiliary";
import * as services from "../../services/things";
import * as data from "@ty-ras/data-backend-io-ts";
import * as t from "io-ts";

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

const getThings: aux.EndpointSpec<
  protocol.APIGetThings,
  typeof services.getThings,
  { db: true; username: true }
> = {
  state: aux.endpointState({ db: true, username: true }),
  endpointHandler: async ({
    state: {
      db: { db },
      username,
    },
  }) => await services.getThings(username, db),
  method: "GET",
  // Remember that io-ts types 'encode' is identity in all cases when data is raw JSON objects (as opposed to e.g. classes)
  // This means that we will not do "double work" by first service function doing validation on SQL rows, and then REST API validating service function array.
  output: data.responseBody(
    t.array(
      t.type({
        id: t.string,
      }),
    ),
  ),
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
};

const getThingsCount: aux.EndpointSpec<
  protocol.APIThingsSummary,
  typeof services.getThingsCount
> = {
  state: aux.endpointState({ db: true }),
  endpointHandler: ({
    state: {
      db: { db },
    },
  }) => services.getThingsCount(db),
  method: "GET",
  output: data.responseBody(t.number),
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
};
