/* eslint-disable @typescript-eslint/no-explicit-any */
import * as tyras from "@ty-ras/backend-node-io-ts-openapi";
import type * as types from "./types";

// TODO move to TyRAS libs.
export const mdArgsBase = <TOutput>(
  output: { description: string; example: TOutput },
  operation: tyras.OpenAPIArgumentsStatic["operation"],
): types.EndpointSpec<
  tyras.ProtocolSpecCore<string, any>,
  types.TFunctionalityBase<any, TOutput>,
  any
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
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        example: output.example as any,
      },
    },
  },
  operation,
});
