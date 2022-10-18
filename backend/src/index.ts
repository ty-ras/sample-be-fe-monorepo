/* eslint-disable no-console */
import * as server from "@ty-ras/server-node";
import * as data from "@ty-ras/data";
import * as pg from "postgres";
import * as api from "./api";
import * as config from "./config";
import * as cognito from "./cognito";

import type * as net from "net";

const main = async () => {
  const {
    authentication,
    http,
    database: { dbName, ...database },
  } = await config.acquireConfigurationOrThrow();
  const verifier = await cognito.createNonThrowingVerifier(authentication);
  console.log(
    "TEST TOKEN",
    await cognito.getToken(
      `http://${authentication.connection?.host}:${authentication.connection?.port}`,
    ),
  );
  await listenAsync(
    server.createServer({
      endpoints: api.createEndpoints(),
      events: (eventName, eventArgs) =>
        console.info(
          "EVENT",
          eventName,
          JSON.stringify(
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            data.omit(eventArgs, "ctx", "groups" as any, "regExp"),
          ),
        ),
      createState: async ({ stateInfo: statePropertyNames, context }) => {
        const state: Partial<api.State> = {};
        for (const propertyName of statePropertyNames) {
          if (propertyName === "username") {
            const jwtPropsOrError = await verifier(
              context.headers["authorization"],
            )();
            if (jwtPropsOrError instanceof Error) {
              console.error("Token validation error: ", jwtPropsOrError);
            } else {
              state.username = jwtPropsOrError.username?.toString();
            }
          } else if (propertyName === "db") {
            state.db = new api.Database(
              pg.default({
                ...database,
                database: dbName,
              }),
            );
          } else {
            // TODO e.g. group names etc
          }
        }

        return state;
      },
    }),
    http.host,
    http.port,
  );
  console.info("Server started");
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

void main();
