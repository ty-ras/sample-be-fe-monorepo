import * as t from "io-ts";

export type Config = t.TypeOf<typeof config>;
export type ConfigAuthenticationConnection = t.TypeOf<typeof connection>;

const nonEmptyString = t.refinement(t.string, (str) => str.length > 0);

const remoteEndpoint = t.type({
  host: nonEmptyString,
  port: t.Int,
});

const connection = t.intersection(
  [
    t.type(
      {
        host: nonEmptyString,
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
            poolId: nonEmptyString,
            clientId: nonEmptyString,
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
        ...remoteEndpoint.props,
        // TOTOD: certs
      },
      "HTTPConfig",
    ),
    database: t.type(
      {
        ...remoteEndpoint.props,
        dbName: nonEmptyString,
        username: nonEmptyString,
        password: nonEmptyString,
      },
      "DBConfig",
    ),
  },
  "BEConfig",
);
