import { either as E, function as F } from "fp-ts";
import * as data from "./data";
import * as common from "../services/common";
import * as t from "io-ts";

export const acquireConfigurationOrThrow = () =>
  F.pipe(
    import.meta.env[CONFIG_ENV_VAR_NAME],
    (envVar) => t.string.decode(envVar),
    E.mapLeft(
      () =>
        new Error(
          `Please provide FE config in ${CONFIG_ENV_VAR_NAME} environment variable as stringified JSON.`,
        ),
    ),
    E.chainW((configAsString) =>
      // eslint-disable-next-line @typescript-eslint/no-unsafe-return
      E.tryCatch(() => JSON.parse(configAsString), common.makeError),
    ),
    E.chainW((configAsUnvalidated) => data.config.decode(configAsUnvalidated)),
    E.getOrElseW(common.getErrorObject),
    common.throwIfError,
  );

const CONFIG_ENV_VAR_NAME = "VITE_TYRAS_FE_CONFIG";
