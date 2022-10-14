import type * as protocol from "../../protocol";
import * as aux from "../auxiliary";
import * as services from "../../services/things";
import * as data from "@ty-ras/data-backend-io-ts";
import * as t from "io-ts";

export const createThingsEndpoints = (builder: aux.Builder) => [
  builder.atURL``.batchSpec(getThings()).createEndpoint({
    openapi: {
      summary: "Query things",
    },
  }),
];

const getThings: aux.EndpointSpec<
  protocol.APIGetThings,
  typeof services.getThings,
  { username: true }
> = () => ({
  state: aux.endpointState({
    username: true,
  }),
  endpointHandler: () => services.getThings(),
  method: "GET",
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
});
