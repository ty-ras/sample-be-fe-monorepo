/* eslint-disable no-console */
import * as server from "@ty-ras/server-node";
import * as data from "@ty-ras/data";
import * as api from "./api";
import type * as net from "net";
import * as config from "./config";
import * as cognito from "./cognito";

const main = async () => {
  const { authentication, http, database } =
    await config.acquireConfigurationOrThrow();
  await cognito.doVerify(
    authentication.host,
    authentication.port,
    authentication.poolId,
    "",
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
      createState: ({ stateInfo: statePropertyNames }) => {
        const state: Partial<api.State> = {};
        for (const propertyName of statePropertyNames) {
          if (propertyName === "username") {
            // TODO extract username from JWT token
            state.username = undefined;
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
