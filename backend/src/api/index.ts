import * as spec from "@ty-ras/endpoint-spec";
import * as server from "@ty-ras/server-node";
import * as openapi from "@ty-ras/metadata-openapi";
import * as jsonSchema from "@ty-ras/metadata-jsonschema-io-ts";
import * as dataBE from "@ty-ras/data-backend-io-ts";
import * as be from "@ty-ras/server";
import * as data from "@ty-ras/data-io-ts";
import * as prefix from "@ty-ras/endpoint-prefix";
import * as t from "io-ts";
import * as aux from "./auxiliary";
import * as endpoints from "./endpoints";

export const createEndpoints = () => {
  // Builder which allows defining endpoints without metadata or authentication
  // Will be needed for endpoint returning OpenAPI Document.
  const initial = spec.startBuildingAPI<server.ServerContext>();

  // Builder which requires metadata, with or without authentication
  const notAuthenticated = initial.withMetadataProvider(
    "openapi",
    openapi.createOpenAPIProvider(
      jsonSchema.createJsonSchemaFunctionality({
        contentTypes: [dataBE.CONTENT_TYPE],
        transformSchema: openapi.convertToOpenAPISchemaObject,
      }),
    ),
  );

  // Builder that requires validation, and enables authentication
  const authenticated = notAuthenticated.changeStateProvider<aux.StateInfo>(
    () => {
      throw new Error("It looks like this callback will never be called (!).");
    },
    {
      openapi: {
        securitySchemes: [
          {
            name: "authentication",
            scheme: {
              type: "http",
              scheme: "bearer ",
            },
          },
        ],
      },
    },
  );

  // Add things endpoints
  const things = prefix.atPrefix(
    "/thing",
    ...endpoints.createThingsEndpoints(authenticated),
  );

  const authenticatedAPI = prefix.atPrefix("/api", things);
  // unauthenticatedAPI = login

  // Add endpoint to serve automatically generated OpenAPI Document
  const openapiDoc = endpoints.createOpenAPIEndpoint(
    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
    authenticated as any,
    authenticated.getMetadataFinalResult(
      {
        openapi: {
          title: "Sample REST API (Authenticated)",
          version: "0.1",
        },
      },
      [authenticatedAPI.getMetadata("")],
    ).openapi,
    undefined!,
  );

  return [
    // Allow Swagger UI execution
    //ep.withCORSOptions(notAuthenticatedAPI, cors),
    authenticatedAPI,
    // Docs endpoint doesn't need OPTIONS support.
    openapiDoc,
  ];
};
