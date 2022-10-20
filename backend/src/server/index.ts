/* eslint-disable no-console */
import * as server from "@ty-ras/server-node";
import * as data from "@ty-ras/data";
import * as ep from "@ty-ras/endpoint";
import * as api from "../api";
import type * as config from "../config";
import * as auth from "./auth";
import * as db from "./db";

import type * as net from "net";

export const startServer = async ({
  authentication,
  http: { server: serverConfig, cors },
  database,
}: config.Config) => {
  const verifier = await auth.createNonThrowingVerifier(authentication);
  const dbPool = db.createDBPool(database);
  await listenAsync(
    server.createServer({
      // Endpoints comprise the REST API as a whole
      endpoints: api.createEndpoints().map((endpoint) =>
        ep.withCORSOptions(endpoint, {
          origin: cors.frontendAddress,
          allowHeaders: ["Content-Type"],
        }),
      ),
      // React on various server events - in case of this sample, just log them to console.
      events: (eventName, eventArgs) =>
        console.info(
          "EVENT",
          eventName,
          JSON.stringify(
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            data.omit(eventArgs, "ctx", "groups" as any, "regExp"),
          ),
        ),
      // Create the state object for endpoints
      // Endpoints specify which properties of State they want, and this callback tries to provide them
      // The final validation of the returned state object is always done by endpoint specification, and thus it is enough to just attempt to e.g. provide username.
      // Some endpoints will then fail on username missing, and some others can recover from that.
      createState: async ({ stateInfo: statePropertyNames, context }) => {
        const state: Partial<api.State> = {};
        for (const propertyName of statePropertyNames) {
          if (propertyName === "username") {
            const jwtPropsOrError = await verifier(
              api.AUTH_SCHEME,
              context.headers["authorization"],
            )();
            if (jwtPropsOrError instanceof Error) {
              console.error("Token validation error: ", jwtPropsOrError);
            } else {
              state.username = jwtPropsOrError.username?.toString();
            }
          } else if (propertyName === "db") {
            state.db = dbPool;
          } else {
            // TODO e.g. group names etc
          }
        }

        return state;
      },
    }),
    serverConfig.host,
    serverConfig.port,
  );
};

// TODO move this to @ty-ras/server
const listenAsync = (server: net.Server, host: string, port: number) =>
  new Promise<void>((resolve, reject) => {
    try {
      server.listen(port, host, () => resolve());
    } catch (e) {
      reject(e);
    }
  });
