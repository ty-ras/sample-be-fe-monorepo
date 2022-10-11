/* eslint-disable no-console */
import * as server from "@ty-ras/server-node";
import * as data from "@ty-ras/data";
import * as api from "./api";
import type * as net from "net";
import * as process from "process";

const main = async () => {
  await listenAsync(
    server.createServer({
      endpoints: api.createEndpoints(),
      events: {
        emit: (eventName, eventArgs) =>
          console.info(
            "EVENT",
            eventName,
            data.omit(eventArgs, "ctx", "groups" as any, "regExp"),
          ),
      },
      // TODO extract username from JWT token
      createState: () => ({}),
    }),
    "0.0.0.0",
    parseInt(
      process.env[PORT_ENV_VAR] ||
        doThrow(`Please specify port via env variable "${PORT_ENV_VAR}".`),
    ),
  );
  console.info("Server started");
};

const listenAsync = (server: net.Server, host: string, port: number) =>
  new Promise<void>((resolve, reject) => {
    try {
      server.listen(port, host, () => resolve());
    } catch (e) {
      reject(e);
    }
  });

const doThrow = (msg: string) => {
  throw new Error(msg);
};

const PORT_ENV_VAR = "TYRAS_BE_PORT";

void main();
