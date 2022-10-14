/* eslint-disable @typescript-eslint/ban-types */
import * as aux from "../auxiliary";
import type { OpenAPIV3 as openapi } from "openapi-types";
import * as data from "@ty-ras/data-backend-io-ts";
import * as t from "io-ts";
import * as spec from "@ty-ras/endpoint-spec";

export const createOpenAPIEndpoint = <TContext>(
  // eslint-disable-next-line @typescript-eslint/ban-types
  builder: spec.AppEndpointBuilderProvider<
    TContext,
    aux.StateInfo,
    unknown,
    unknown,
    {},
    {},
    {}
  >,
  authenticatedMD: openapi.Document,
  unauthenticatedMD: openapi.Document,
) =>
  builder.atURL`/openapi`
    .forMethod("GET", aux.endpointState({ username: false }))
    .withoutBody(
      ({ state: { username } }) =>
        username ? authenticatedMD : unauthenticatedMD,
      // Proper validator for OpenAPI objects is out of scope of this sample
      data.responseBody(t.unknown),
      // No metadata - as this is the metadata-returning endpoint itself
      {},
    )
    .createEndpoint({});
