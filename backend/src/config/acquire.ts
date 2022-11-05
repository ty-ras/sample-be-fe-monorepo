import { either as E, taskEither as TE, function as F, task as T } from "fp-ts";
import * as process from "process";
import * as fs from "fs/promises";
import * as tyras from "@ty-ras/backend-node-io-ts-openapi";
import * as data from "./data";

export const acquireConfigurationOrThrow = () =>
  // We keep errors as TLeft of Either<TLeft, TRight>, and data in TRight.
  F.pipe(
    // Start with string from process environment
    // Check that it is non-empty non-undefined string.
    E.fromNullable(
      new Error(
        `Please specify configuration as inline JSON string or path to file in "${CONFIG_ENV_VAR_NAME}" env variable.`,
      ),
    )(process.env[CONFIG_ENV_VAR_NAME]),
    // Check the string contents - should we treat it as JSON string or path to file?
    // We use chainW instead of map because we return EitherOr, and chainW = map + flatten (+ 'W'iden types)
    E.chainW(extractConfigStringType),
    // We may need to use async now (in case of file path), so lift Either into TaskEither (Promisified version of Either)
    TE.fromEither,
    // Invoke async callback
    TE.chain(({ type, str }) =>
      TE.tryCatch(
        async () =>
          // eslint-disable-next-line @typescript-eslint/no-unsafe-return
          type === "JSON" ? str : await fs.readFile(str, "utf8"),
        E.toError,
      ),
    ),
    TE.chainEitherK(tyras.validateFromStringifiedJSON(data.config)),
    TE.mapLeft(tyras.toError),
    TE.toUnion,
    T.map(tyras.throwIfError),
  )();

type ConfigStringType = { type: "JSON" | "file"; str: string };

const CONFIG_ENV_VAR_NAME = "TYRAS_BE_CONFIG";

const JSON_STARTS = ["{"];

const FILE_STARTS = [".", "/"];

const extractConfigStringType = (
  configString: string,
): E.Either<Error, ConfigStringType> =>
  JSON_STARTS.some((s) => configString.startsWith(s))
    ? E.right({
        type: "JSON",
        str: configString,
      })
    : FILE_STARTS.some((s) => configString.startsWith(s))
    ? E.right({
        type: "file",
        str: configString,
      })
    : E.left(
        new Error(
          `The env variable string must start with one of the following characters: ${[
            ...JSON_STARTS,
            ...FILE_STARTS,
          ]
            .map((s) => `"${s}"`)
            .join(",")}.`,
        ),
      );
