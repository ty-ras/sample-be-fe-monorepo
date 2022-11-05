import * as tyras from "@ty-ras/backend-node-io-ts-openapi";
import * as state from "./state";

export const createBuilders = () => {
  const noMetadata = tyras.startBuildingAPI<
    tyras.ServerContext,
    state.StateInfo
  >();

  return {
    // Builder which allows defining endpoints without metadata
    // Will be needed for endpoint returning OpenAPI Document.
    noMetadata,
    // Builder which requires metadata, with or without authentication
    withOpenAPI: noMetadata.withMetadataProvider(
      "openapi",
      tyras.createOpenAPIProvider(
        tyras.createJsonSchemaFunctionality({
          contentTypes: [tyras.CONTENT_TYPE],
          transformSchema: tyras.convertToOpenAPISchemaObject,
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

export const AUTH_SCHEME = "bearer";

export type PlainBuilder = ReturnType<typeof createBuilders>["noMetadata"];
export type Builder = ReturnType<typeof createBuilders>["withOpenAPI"];
