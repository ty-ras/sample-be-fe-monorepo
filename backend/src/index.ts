import * as server from "@ty-ras/server-node";
import type * as net from "net";

const main = async () => {
  await listenAsync(
    server.createServer({
      endpoints: [],
    }),
    "0.0.0.0",
    7000,
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

void main();
