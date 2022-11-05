import * as tyras from "@ty-ras/backend-node-io-ts-openapi";
import * as aux from "./auxiliary";
import * as endpoints from "./endpoints";

export {
  State,
  filterAuthenticatedProperties,
  Database,
  AUTH_SCHEME,
} from "./auxiliary";

export const createEndpoints = () => {
  // Create builder: 'initial' which doesn't require any metadata added to endpoints
  // And 'withMD' which requires few OpenAPI manual things added to endpoints (schema generation is automatic).
  const { noMetadata, withOpenAPI } = aux.createBuilders();

  // Add things endpoints with their metdata
  const thingsEndpointsAndMD = endpoints.createThingsEndpoints(withOpenAPI);

  // Add endpoint to serve automatically generated OpenAPI Document
  const openapiDoc = endpoints.createOpenAPIEndpoint(
    noMetadata,
    withOpenAPI.getMetadataFinalResult(
      {
        openapi: {
          title: "Sample REST API",
          version: "0.1",
        },
      },
      thingsEndpointsAndMD.map(({ getMetadata }) =>
        getMetadata(`${topLevelAPIPrefix}${thingsAPIPrefix}`),
      ),
    ).openapi,
  ).endpoint;

  // Return endpoints
  return [
    // Behind '/api' prefix, we have
    tyras.atPrefix(
      topLevelAPIPrefix,
      // All things endpoints under '/thing' prefix
      tyras.atPrefix(
        thingsAPIPrefix,
        ...thingsEndpointsAndMD.map(({ endpoint }) => endpoint),
      ),
      // Perhaps something else in the future...?
    ),
    // At '/openapi' endpoint we serve OpenAPI document
    openapiDoc,
  ];
};

const topLevelAPIPrefix = "/api";
const thingsAPIPrefix = "/thing";
