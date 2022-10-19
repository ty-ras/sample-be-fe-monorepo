import { either as E, taskEither as TE, function as F, task as T } from "fp-ts";
import * as process from "process";
import * as fs from "fs/promises";
import * as data from "./data";
import * as services from "../services";

export const acquireConfigurationOrThrow = () =>
  // We keep errors as TLeft of Either<TLeft, TRight>, and data in TRight.
  F.pipe(
    // Start with string from process environment
    E.right(process.env[CONFIG_ENV_VAR_NAME]),
    // Check that it is non-empty non-undefined string.
    // We use chainW instead of map because we return EitherOr, and chainW = map + flatten (+ 'W'iden types)
    E.chainW((str) =>
      str
        ? E.right(str)
        : E.left(
            `Please specify configuration as inline JSON string or path to file in "${CONFIG_ENV_VAR_NAME}" env variable.`,
          ),
    ),
    // Check the string contents - should we treat it as JSON string or path to file?
    E.chainW(extractConfigStringType),
    // We may need to use async now (in case of file path), so lift Either into TaskEither (Promisified version of Either)
    TE.fromEither,
    // Invoke async callback
    TE.chainW(({ type, str }) =>
      TE.tryCatch(
        async () =>
          // eslint-disable-next-line @typescript-eslint/no-unsafe-return
          JSON.parse(type === "JSON" ? str : await fs.readFile(str, "utf8")),
        services.makeError,
      ),
    ),
    // Flatmap again, this time using the IO-TS validator.
    // The validator checks at runtime that whatever is parsed by JSON.parse(...) adhers to whatever is specified in validator.
    // The validator is in "config" const, which is defined later.
    TE.chainW((parsedJSON) => TE.fromEither(data.config.decode(parsedJSON))),

    // Extract inner value, or transform various error types into one Error
    TE.getOrElseW((error) => T.of(services.getErrorObject(error))),
    // Throw if it is an error
    T.map(services.throwIfError),
  )();

type ConfigStringType = { type: "JSON" | "file"; str: string };

const CONFIG_ENV_VAR_NAME = "TYRAS_BE_CONFIG";

const JSON_STARTS = ["{"];

const FILE_STARTS = [".", "/"];

const extractConfigStringType = (
  configString: string,
): E.Either<string, ConfigStringType> =>
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
        `The env variable string must start with one of the following characters: ${[
          ...JSON_STARTS,
          ...FILE_STARTS,
        ]
          .map((s) => `"${s}"`)
          .join(",")}.`,
      );
