import * as t from "io-ts";
import * as tyras from "@ty-ras/data-io-ts";

export type Config = t.TypeOf<typeof config>;
export type ConfigAuthenticationConnection = t.TypeOf<typeof connection>;

const remoteEndpoint = t.type({
  host: tyras.nonEmptyString,
  port: t.Int,
});

const connection = t.intersection(
  [
    t.type(
      {
        host: tyras.nonEmptyString,
        port: t.Int,
      },
      "AuthConfigConnectionMandatory",
    ),
    t.partial(
      {
        scheme: t.union([t.literal("http"), t.literal("https")]),
      },
      "AuthConfigConnectionOptional",
    ),
  ],
  "AuthConfigConnection",
);

export const config = t.type(
  {
    authentication: t.intersection(
      [
        t.type(
          {
            poolId: tyras.nonEmptyString,
            clientId: tyras.nonEmptyString,
          },
          "AuthConfigMandatory",
        ),
        t.partial(
          {
            connection,
          },
          "AuthConfigOptional",
        ),
      ],
      "AuthConfig",
    ),
    http: t.type(
      {
        server: t.type(
          {
            ...remoteEndpoint.props,
            // TOTOD: certs
          },
          "HTTPServerConfig",
        ),
        cors: t.type(
          {
            frontendAddress: tyras.nonEmptyString,
          },
          "HTTPCorsConfig",
        ),
      },
      "HTTPConfig",
    ),
    database: t.type(
      {
        ...remoteEndpoint.props,
        dbName: tyras.nonEmptyString,
        username: tyras.nonEmptyString,
        password: tyras.nonEmptyString,
        role: tyras.nonEmptyString,
      },
      "DBConfig",
    ),
  },
  "BEConfig",
);
