import type * as protocol from "@ty-ras/protocol";
import type * as types from "./types";
import type { OpenAPIV3 as openapi } from "openapi-types";

export const mdArgsBase = <TOutput>(
  output: { description: string; example: TOutput },
  operation: Omit<
    openapi.OperationObject,
    "parameters" | "requestBody" | "responses" | "security"
  >,
): types.EndpointSpec<
  protocol.ProtocolSpecCore<string, any>,
  any,
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
        example: output.example,
      },
    },
  },
  operation,
});
