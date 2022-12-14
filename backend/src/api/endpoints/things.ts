import * as tyras from "@ty-ras/backend-node-io-ts-openapi";
import * as protocol from "protocol";
import * as aux from "../auxiliary";
import * as services from "services";
import * as t from "io-ts";
import * as tt from "io-ts-types";

export const createThingsEndpoints = (builder: aux.Builder) => [
  builder.atURL`/${thingIDInURL}`
    .batchSpec(readThing)
    .batchSpec(updateThing)
    .batchSpec(deleteThing)
    .batchSpec(undeleteThing)
    .createEndpoint({
      openapi: { summary: "Read, update, delete, or restore a single thing" },
    }),
  builder.atURL``
    .batchSpec(createThing)
    .batchSpec(getThings)
    .createEndpoint({
      openapi: {
        summary: "Query thing statistics",
      },
    }),
  builder.atURL`/statistics`.batchSpec(getThingsCount).createEndpoint({
    openapi: {
      summary: "Get amount of things",
    },
  }),
];

const thingObject = t.type({
  ...services.thingValidation.props,

  // Remember that the Date columns in services are returning Date objects
  // For REST API, we must return ISO timestamp strings instead.
  created_at: tt.DateFromISOString,
  updated_at: tt.DateFromISOString,
});
//  protocolTyras.EncodedOf<
//   dataGeneric.HKTEncoded,
//   protocol.data.things.Thing
// >

const thingIDInURL = tyras.urlParameter(
  "id",
  thingObject.props.id,
  services.thingIDRegex,
);

const exampleThing: t.TypeOf<typeof thingObject> = {
  id: "Dummy ID",
  payload: "Dummy payload",
  created_at: new Date(0),
  updated_at: new Date(0),
  created_by: "User",
  updated_by: "User",
};

const createThing = aux
  .withResponseBody<protocol.api.things.Create>(thingObject)
  .createEndpoint(
    services.createThing,
    aux.authenticatedStateSpec,
    {
      method: "POST",
      input: tyras.requestBody(t.type({ payload: t.string })),
      mdArgs: {
        openapi: {
          ...aux.mdArgsBase(
            { description: "Newly created thing", example: exampleThing },
            {
              description: "Create new thing",
            },
          ),
          body: {
            "application/json": {
              example: {
                payload: exampleThing.payload,
              },
            },
          },
        },
      },
    },
    ({ state: { username }, body }) => ({ username, thing: body }),
  );

const readThing = aux
  .withResponseBody<protocol.api.things.Read>(thingObject)
  .createEndpoint(
    services.getThing,
    aux.authenticatedStateSpec,
    {
      method: "GET",
      mdArgs: {
        openapi: {
          ...aux.mdArgsBase(
            { description: "The thing from database", example: exampleThing },
            { description: "Get a thing by ID" },
          ),
          urlParameters: {
            id: {
              description: "The ID of the thing to get",
            },
          },
        },
      },
    },
    ({ state: { username }, url }) => ({ username, thing: url }),
  );

const updateThing = aux
  .withResponseBody<protocol.api.things.Update>(thingObject)
  .createEndpoint(
    services.updateThing,
    aux.authenticatedStateSpec,
    {
      method: "PATCH",
      input: tyras.requestBody(
        t.partial({
          payload: t.string,
        }),
      ),
      mdArgs: {
        openapi: {
          ...aux.mdArgsBase(
            {
              description: "The thing with updated properties",
              example: exampleThing,
            },
            { description: "Update thing's properties." },
          ),
          urlParameters: {
            id: {
              description: "The ID of the thing to update",
            },
          },
          body: {
            "application/json": {
              example: {
                payload: "Dummy payload",
              },
            },
          },
        },
      },
    },
    ({ state: { username }, url, body }) => ({
      username,
      thing: { ...url, ...body },
    }),
  );

const deleteThing = aux
  .withResponseBody<protocol.api.things.Delete>(thingObject)
  .createEndpoint(
    services.deleteThing,
    aux.authenticatedStateSpec,
    {
      method: "DELETE",
      mdArgs: {
        openapi: {
          ...aux.mdArgsBase(
            {
              description: "The thing deleted from database",
              example: exampleThing,
            },
            { description: "Delete a thing by its ID." },
          ),
          urlParameters: {
            id: {
              description: "The ID of the thing to delete",
            },
          },
        },
      },
    },
    ({ state: { username }, url }) => ({ username, thing: url }),
  );

const undeleteThing = aux
  .withResponseBody<protocol.api.things.Undelete>(thingObject)
  .createEndpoint(
    services.undeleteThing,
    aux.authenticatedStateSpec,
    {
      method: "POST",
      mdArgs: {
        openapi: {
          ...aux.mdArgsBase(
            {
              description: "The thing undeleted from database",
              example: exampleThing,
            },
            {
              description: "Restore a previously deleted thing by its ID.",
            },
          ),
          urlParameters: {
            id: {
              description: "The ID of the thing to restore",
            },
          },
        },
      },
    },
    ({ state: { username }, url }) => ({ username, thing: url }),
  );

const getThings = aux
  .withResponseBody<protocol.api.things.ReadAll>(t.array(thingObject))
  .createEndpoint(
    services.getThings,
    aux.authenticatedStateSpec,
    {
      method: "GET",
      mdArgs: {
        openapi: {
          urlParameters: undefined,
          queryParameters: undefined,
          requestHeaders: undefined,
          body: undefined,
          output: {
            description: "Things in database",
            mediaTypes: {
              "application/json": {
                example: [exampleThing],
              },
            },
          },
          responseHeaders: undefined,
          operation: {},
        },
      },
    },
    ({ state: { username } }) => ({ username }),
  );

// Notice: this is not behind authentication.
// Just to demonstrate how non-authenticated endpoints can still access e.g. DB
const getThingsCount = aux
  .withResponseBody<protocol.api.things.GetSummary>(
    services.getThingsCount.validation,
  )
  .createEndpoint(
    services.getThingsCount,
    aux.unauthenticatedStateSpec,
    {
      method: "GET",
      mdArgs: {
        openapi: {
          urlParameters: undefined,
          queryParameters: undefined,
          requestHeaders: undefined,
          body: undefined,
          output: {
            description: "",
            mediaTypes: {
              "application/json": {
                example: 123,
              },
            },
          },
          responseHeaders: undefined,
          operation: {},
        },
      },
    },
    () => ({}),
  );
