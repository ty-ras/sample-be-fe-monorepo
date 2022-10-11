import type * as protocol from "../protocol";
import type * as types from "./types";
import * as services from "../services/things";
import * as data from "@ty-ras/data-backend-io-ts";
import * as t from "io-ts";

export const createEndpoints = <TContext, TRefinedContext>(
  builder: types.Builder<TContext, TRefinedContext, types.AuthenticatedState>,
) => [
  builder.atURL``.batchSpec(getThings()).createEndpoint({
    openapi: {
      summary: "Query things",
    },
  }),
];

const getThings: types.EndpointSpec<
  protocol.APIGetThings,
  typeof services.getThings
> = () => ({
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
