import * as aux from "../auxiliary";
import { OpenAPIV3 as openapi } from "openapi-types";
import * as data from "@ty-ras/data-backend-io-ts";
import * as md from "@ty-ras/metadata-openapi";
import * as t from "io-ts";

export const createOpenAPIEndpoint = (
  builder: aux.PlainBuilder,
  metadata: openapi.Document,
) => {
  // Notice that this will be undefined if all operations are behind authentication
  const unauthenticatedMD = md.removeAuthenticatedOperations(metadata);

  return builder.atURL`/openapi`
    .forMethod("GET", aux.endpointState({ username: false }))
    .withoutBody(
      // Return OpenAPI document which doesn't have any information about authenticated endpoints for request which don't have username information
      ({ state: { username } }) => (username ? metadata : unauthenticatedMD),
      // Proper validator for OpenAPI objects is out of scope of this sample
      data.responseBody(t.unknown),
      // No metadata - as this is the metadata-returning endpoint itself
      {},
    )
    .createEndpoint({});
};
