import * as config from "config";
import * as server from "server";

const main = async () => {
  await server.startServer(await config.acquireConfigurationOrThrow());
  // eslint-disable-next-line no-console
  console.info("Server started");
};

void main();
