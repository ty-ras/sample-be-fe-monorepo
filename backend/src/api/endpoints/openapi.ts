import * as aux from "../auxiliary";
import { OpenAPIV3 as openapi } from "openapi-types";
import * as tyras from "@ty-ras/backend-node-io-ts-openapi";
import * as t from "io-ts";
import * as tls from "tls";

export const createOpenAPIEndpoint = (
  builder: aux.PlainBuilder,
  metadata: openapi.Document,
) => {
  // Notice that this will be undefined if all operations are behind authentication
  const unauthenticatedMD = tyras.removeAuthenticatedOperations(metadata);
  return builder.atURL`/openapi`
    .forMethod("GET", aux.endpointState({ username: false }))
    .withoutBody(
      // Return OpenAPI document which doesn't have any information about authenticated endpoints for request which don't have username information
      ({ state: { username }, context }) => {
        let returnMD = username ? metadata : unauthenticatedMD;
        if (returnMD) {
          const host = context.req.headers["host"];
          if (host) {
            const scheme =
              context.req.socket instanceof tls.TLSSocket ? "https" : "http";
            returnMD = {
              ...returnMD,
              servers: [{ url: `${scheme}://${host}` }],
            };
          }
        }
        return returnMD;
      },
      // Proper validator for OpenAPI objects is out of scope of this sample
      tyras.responseBodyForValidatedData(t.unknown),
      // No metadata - as this is the metadata-returning endpoint itself
      {},
    )
    .createEndpoint({});
};
