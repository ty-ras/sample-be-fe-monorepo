/* eslint-disable @typescript-eslint/no-explicit-any */
import type * as protocol from "@ty-ras/protocol";
import type * as types from "./types";
import * as openapi from "@ty-ras/metadata-openapi";

export const mdArgsBase = <TOutput>(
  output: { description: string; example: TOutput },
  operation: openapi.OpenAPIArgumentsStatic["operation"],
): ReturnType<
  types.EndpointSpec<
    protocol.ProtocolSpecCore<string, any>,
    types.TFunctionalityBase<any, TOutput>,
    any
  >
>["mdArgs"]["openapi"] => ({
  urlParameters: undefined,
  queryParameters: undefined,
  requestHeaders: undefined,
  body: undefined,
  responseHeaders: undefined,
  output: {
    description: output.description,
    mediaTypes: {
      "application/json": {
        example: output.example,
      },
    },
  },
  operation,
});
