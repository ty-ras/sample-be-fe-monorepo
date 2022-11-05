/* eslint-disable no-console */
import * as tyras from "@ty-ras/backend-node-io-ts-openapi";
import type { resources } from "@ty-ras/backend-node-io-ts-openapi";
import { function as F } from "fp-ts";
import * as api from "api";
import * as services from "services";
import type * as config from "config";
import * as auth from "./auth";
import * as db from "./db";

export const startServer = async ({
  authentication,
  http: { server: serverConfig, cors },
  database,
}: config.Config) => {
  const verifier = await auth.createNonThrowingVerifier(authentication);
  const { pool, administration } = db.createDBPool(database);
  const dbPool = new api.Database(pool);
  const corsHandler = tyras.createCORSHandler({
    allowOrigin: cors.frontendAddress,
    allowHeaders: ["Content-Type", "Authorization"],
    allowMethods: true,
  });
  await tyras.listenAsync(
    tyras.createServer({
      // Endpoints comprise the REST API as a whole
      endpoints: api.createEndpoints(),
      // React on various server events.
      events: F.flow(
        // First, trigger CORS handler (it will modify the context object of eventArgs)
        (eventName, eventArgs) => ({
          eventName,
          eventArgs,
          corsTriggered: corsHandler(eventName, eventArgs),
        }),
        // Then log event info + whether CORS triggered to console
        ({ eventName, eventArgs, corsTriggered }) =>
          console.info(
            "EVENT",
            eventName,
            corsTriggered,
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            tyras.omit(eventArgs, "ctx", "groups" as any, "regExp"),
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
              `${api.AUTH_SCHEME} `,
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

  // Start eviction process
  void runDBPoolEviction(administration);
};

const runDBPoolEviction = async (
  poolAdmin: resources.ResourcePoolAdministration<services.DBClient>,
) => {
  // eslint-disable-next-line no-constant-condition
  while (true) {
    // It is enough to check once a minute.
    await new Promise<void>((resolve) => setTimeout(resolve, 60 * 1000));
    // Destroy all connections which have been idle for 10min or more.
    await poolAdmin.runEviction(10 * 60 * 1000)();
  }
};
