import * as t from "io-ts";

const nonEmptyString = t.refinement(t.string, (str) => str.length > 0);

export const config = t.intersection(
  [
    t.type(
      {
        authentication: t.type(
          {
            clientId: nonEmptyString,
            endpointOrRegion: nonEmptyString,
          },
          "AuthConfig",
        ),
        backend: nonEmptyString,
      },
      "FEConfigMandatory",
    ),
    t.partial(
      {
        region: nonEmptyString,
      },
      "FEConfigOptional",
    ),
  ],
  "FEConfig",
);
