import * as protocol from "../../protocol";
import * as aux from "../auxiliary";
import * as services from "../../services/things";
import * as data from "@ty-ras/data-backend-io-ts";
import * as t from "io-ts";
import * as tt from "io-ts-types";

export const createThingsEndpoints = (builder: aux.Builder) => [
  builder.atURL`/${"id"}`
    .validateURLData(data.url({ id: thingObject.props.id }))
    .batchSpec(readThing)
    .batchSpec(updateThing)
    .batchSpec(deleteThing)
    .createEndpoint({ openapi: { summary: "Read, update, or delete things" } }),
  builder.atURL``.batchSpec(getThings).createEndpoint({
    openapi: {
      summary: "Query things",
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
const exampleThing: t.TypeOf<typeof thingObject> = {
  id: "Dummy ID",
  payload: "Dummy payload",
  created_at: new Date(0),
  updated_at: new Date(0),
};

const createThing = aux
  .withResponseBody<protocol.api.things.Create>(thingObject)
  .createEndpoint(
    services.createThing.functionality,
    aux.authenticatedStateSpec,
    {
      method: "POST",
      input: data.requestBody(t.type({ payload: t.string })),
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
    ({
      state: {
        db: { db },
        username,
      },
      body,
    }) => [{ db, username, thing: body }] as const,
  );

const readThing = aux
  .withResponseBody<protocol.api.things.Read>(thingObject)
  .createEndpoint(
    services.getThing.functionality,
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
    ({
      state: {
        db: { db },
        username,
      },
      url,
    }) => [{ db, username, thing: url }] as const,
  );

const updateThing = aux
  .withResponseBody<protocol.api.things.Update>(thingObject)
  .createEndpoint(
    services.updateThing.functionality,
    aux.authenticatedStateSpec,
    {
      method: "PATCH",
      input: data.requestBody(
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
    ({
      state: {
        db: { db },
        username,
      },
      url,
    }) => [{ db, username, thing: url }] as const,
  );

const deleteThing = aux
  .withResponseBody<protocol.api.things.Delete>(thingObject)
  .createEndpoint(
    services.deleteThing.functionality,
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
        },
      },
    },
    ({
      state: {
        db: { db },
        username,
      },
      url,
    }) => [{ db, username, thing: url }] as const,
  );

const getThings = aux
  .withResponseBody<protocol.api.things.ReadAll>(t.array(thingObject))
  .createEndpoint(
    services.getThings.functionality,
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
    ({
      state: {
        db: { db },
        username,
      },
    }) => [{ username, db }] as const,
  );

// Notice: this is not behind authentication.
// Just to demonstrate how non-authenticated endpoints can still access e.g. DB
const getThingsCount = aux
  .withResponseBody<protocol.api.things.GetSummary>(
    services.getThingsCount.validation,
  )
  .createEndpoint(
    services.getThingsCount.functionality,
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
    ({
      state: {
        db: { db },
      },
    }) => [{ db }] as const,
  );
