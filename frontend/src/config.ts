import * as t from "io-ts";
import * as tyras from "@ty-ras/data-io-ts";

const validation = t.readonly(
  t.intersection(
    [
      t.type(
        {
          authentication: t.type(
            {
              clientId: tyras.nonEmptyString,
              endpointOrRegion: tyras.nonEmptyString,
            },
            "AuthConfig",
          ),
          backend: tyras.nonEmptyString,
        },
        "FEConfigMandatory",
      ),
      t.partial(
        {
          region: tyras.nonEmptyString,
        },
        "FEConfigOptional",
      ),
    ],
    "FEConfig",
  ),
);
const CONFIG_ENV_VAR_NAME = "VITE_TYRAS_FE_CONFIG";

const config = tyras.readJSONStringToValueOrThrow(
  () =>
    new Error(
      `Please provide FE config in ${CONFIG_ENV_VAR_NAME} environment variable as stringified JSON.`,
    ),
  validation,
)(import.meta.env[CONFIG_ENV_VAR_NAME]);

export default config;
