import * as aux from "../auxiliary";
import { OpenAPIV3 as openapi } from "openapi-types";
import * as data from "@ty-ras/data-backend-io-ts";
import * as t from "io-ts";

export const createOpenAPIEndpoint = (
  builder: aux.PlainBuilder,
  metadata: openapi.Document,
) => {
  // Notice that this will be undefined if all operations are behind authentication
  const unauthenticatedMD = removeAuthenticatedOperations(metadata);

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

// TODO move this to @ty-ras/metadata-openapi
const removeAuthenticatedOperations = (
  metadata: openapi.Document,
): openapi.Document | undefined => {
  const originalPathsLength = Object.keys(metadata.paths).length;
  const unauthenticatedPaths = Array.from(
    getUnauthenticatedPathObjects(metadata),
  );
  return originalPathsLength > unauthenticatedPaths.length
    ? unauthenticatedPaths.length > 0
      ? removeSecuritySchemes({
          ...metadata,
          paths: Object.fromEntries(unauthenticatedPaths),
        })
      : undefined
    : removeSecuritySchemes(metadata);
};

function* getUnauthenticatedPathObjects(metadata: openapi.Document) {
  for (const [pathKey, pathObject] of Object.entries(metadata.paths)) {
    let pathObjectOrExclude: typeof pathObject | string = pathObject;
    if (pathObject) {
      const supportedMethods = Object.values(openapi.HttpMethods).filter(
        (method) => method in pathObject,
      );
      const authenticatedOperations = supportedMethods.filter((method) => {
        const operation = pathObject[method];
        return (operation?.security?.length ?? 0) > 0;
      });
      pathObjectOrExclude =
        supportedMethods.length > 0
          ? supportedMethods.length > authenticatedOperations.length
            ? removeOperations(pathObject, authenticatedOperations)
            : "exclude"
          : pathObject;
    }
    if (typeof pathObjectOrExclude !== "string") {
      yield [pathKey, pathObjectOrExclude] as const;
    }
  }
}

const removeOperations = (
  pathObject: openapi.PathItemObject,
  methods: ReadonlyArray<openapi.HttpMethods>,
): openapi.PathItemObject => {
  const shallowClone = { ...pathObject };
  for (const method of methods) {
    delete shallowClone[method];
  }
  return shallowClone;
};

const removeSecuritySchemes = ({
  components,
  ...doc
}: openapi.Document): openapi.Document => {
  if (components && "securitySchemes" in components) {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { securitySchemes, ...otherComponents } = components;
    if (Object.keys(otherComponents).length > 0) {
      components = otherComponents;
    } else {
      components = undefined;
    }
  }
  return components ? { ...doc, components } : doc;
};
