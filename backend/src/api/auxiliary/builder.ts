import * as spec from "@ty-ras/endpoint-spec";
import * as server from "@ty-ras/server-node";
import * as openapi from "@ty-ras/metadata-openapi";
import * as jsonSchema from "@ty-ras/metadata-jsonschema-io-ts";
import * as dataBE from "@ty-ras/data-backend-io-ts";
import * as state from "./state";

export const createBuilders = () => {
  const noMetadata = spec.startBuildingAPI<
    server.ServerContext,
    state.StateInfo
  >();

  return {
    // Builder which allows defining endpoints without metadata
    // Will be needed for endpoint returning OpenAPI Document.
    noMetadata,
    // Builder which requires metadata, with or without authentication
    withOpenAPI: noMetadata.withMetadataProvider(
      "openapi",
      openapi.createOpenAPIProvider(
        jsonSchema.createJsonSchemaFunctionality({
          contentTypes: [dataBE.CONTENT_TYPE],
          transformSchema: openapi.convertToOpenAPISchemaObject,
        }),
      ),
      (requiredProperties) => {
        return {
          securitySchemes:
            state.filterAuthenticatedProperties(requiredProperties).length > 0
              ? [
                  {
                    name: "authentication",
                    scheme: {
                      type: "http",
                      scheme: AUTH_SCHEME,
                    },
                  },
                ]
              : [],
        };
      },
    ),
  };
};

export const AUTH_SCHEME = "bearer ";

export type PlainBuilder = ReturnType<typeof createBuilders>["noMetadata"];
export type Builder = ReturnType<typeof createBuilders>["withOpenAPI"];
