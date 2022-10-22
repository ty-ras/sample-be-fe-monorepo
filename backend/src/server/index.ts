/* eslint-disable no-console */
import * as server from "@ty-ras/server-node";
import * as serverGeneric from "@ty-ras/server";
import * as data from "@ty-ras/data";
import * as ep from "@ty-ras/endpoint";
import * as api from "../api";
import type * as config from "../config";
import * as auth from "./auth";
import * as db from "./db";

export const startServer = async ({
  authentication,
  http: { server: serverConfig, cors },
  database,
}: config.Config) => {
  const verifier = await auth.createNonThrowingVerifier(authentication);
  const dbPool = db.createDBPool(database);
  const corsHandler = createCORSHandler({
    origin: cors.frontendAddress,
    allowHeaders: ["Content-Type", "Authorization"],
  });
  await serverGeneric.listenAsync(
    server.createServer({
      // Endpoints comprise the REST API as a whole
      endpoints: api.createEndpoints(),
      // React on various server events.
      // Notice call to corsHandler -> it will modify the context (Response object) as necessary.
      events: (eventName, eventArgs) =>
        console.info(
          "EVENT",
          eventName,
          corsHandler(eventName, eventArgs),
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          data.omit(eventArgs, "ctx", "groups" as any, "regExp"),
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
};

const createCORSHandler = ({
  origin,
  allowHeaders,
}: ep.CORSOptions): EventEmitter<
  serverGeneric.VirtualRequestProcessingEvents<server.ServerContext, any>,
  boolean
> => {
  const allowHeadersValue =
    typeof allowHeaders === "string" ? allowHeaders : allowHeaders.join(",");
  const headerSetter = (
    ctx: server.ServerContext,
    wasOnInvalidMethod: boolean,
  ) => {
    const { req, res } = ctx;
    res.setHeader("Access-Control-Allow-Origin", origin);
    if (req.method === "OPTIONS") {
      res.setHeader("Access-Control-Allow-Headers", allowHeadersValue);
    }
    if (wasOnInvalidMethod) {
      res.statusCode = 200;
      ctx.skipSettingStatusCode = true;
    }
  };
  return (eventName, { ctx }) => {
    let modified = true;
    switch (eventName) {
      case "onInvalidMethod":
        if (ctx.req.method === "OPTIONS") {
          headerSetter(ctx, true);
        }
        break;
      case "onSuccessfulInvocationEnd":
      case "onInvalidUrl":
      case "onInvalidUrlParameters":
      case "onInvalidState":
      case "onInvalidQuery":
      case "onInvalidRequestHeaders":
      case "onInvalidContentType":
      case "onInvalidBody":
      case "onException":
        headerSetter(ctx, false);
        break;
      default:
        modified = false;
    }
    return modified;
  };
};

export type EventEmitter<TVirtualEvents extends object, TReturn = void> = <
  TEventName extends keyof TVirtualEvents,
>(
  eventName: TEventName,
  eventArgs: TVirtualEvents[TEventName],
) => TReturn;
