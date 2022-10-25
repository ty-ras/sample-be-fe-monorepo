import type * as protocol from "@ty-ras/protocol";

declare namespace api {
  namespace things {
    // CRUD for things
    export interface Create extends common.AuthenticatedEndpoint {
      method: "POST";
      requestBody: Partial<data.things.ThingID> & data.things.ThingPayload;
      responseBody: data.things.Thing;
    }

    export interface Read extends common.AuthenticatedEndpoint {
      method: "GET";
      url: data.things.ThingID;
      responseBody: data.things.Thing;
    }

    export interface Update extends common.AuthenticatedEndpoint {
      method: "PATCH";
      url: data.things.ThingID;
      requestBody: Partial<data.things.ThingPayload>;
      responseBody: data.things.Thing;
    }

    export interface Delete extends common.AuthenticatedEndpoint {
      method: "DELETE";
      url: data.things.ThingID;
      responseBody: data.things.Thing;
    }

    // Get multiple things
    export interface ReadAll extends common.AuthenticatedEndpoint {
      method: "GET";
      responseBody: Array<data.things.Thing>;
    }

    // Get summary (count) of things
    export interface GetSummary {
      method: "GET";
      responseBody: number;
    }
  }

  namespace common {
    export interface AuthenticatedEndpoint {
      // Header *functionality* - not the header data content validation
      // Notice that currently, 'headers' is only used in FE.
      // BE can be made to utilize that (by modifying StateInfo) later.
      headers: {
        // Require functionality "auth" using HTTP header "Authorization"
        // The header value will not be visible at runtime to BE handler, instead the state will be required to be of type { username: string } for the "auth" functionality.
        Authorization: "auth";
      };
    }
  }
}

declare namespace data {
  namespace things {
    export interface Thing {
      id: string;
      payload: string;

      // Soft-delete columns
      created_at: common.Timestamp;
      updated_at: common.Timestamp;
    }
    export type ThingPayload = Omit<Thing, "id" | "created_at" | "updated_at">;
    export type ThingID = Pick<Thing, "id">;
  }
  namespace common {
    export type Timestamp = protocol.Encoded<Date, string>;
  }
}
