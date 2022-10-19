import * as config from "./config";
import * as serverr from "./server";

const main = async () => {
  await serverr.startServer(await config.acquireConfigurationOrThrow());
  // eslint-disable-next-line no-console
  console.info("Server started");
};

void main();
