import * as t from "io-ts";
import { either as E, taskEither as TE, function as F } from "fp-ts";
import * as data from "@ty-ras/data-io-ts";
import * as process from "process";
import * as fs from "fs/promises";

export const acquireConfigurationOrThrow = async () => {
  return F.pipe(
    await F.pipe(
      // Start with string from process environment
      E.right(process.env[CONFIG_ENV_VAR_NAME]),
      // Check that it is non-empty non-undefined string
      E.map((str) =>
        str
          ? E.right(str)
          : E.left(
              `Please specify configuration as inline JSON string or path to file in "${CONFIG_ENV_VAR_NAME}" env variable.`,
            ),
      ),
      // Transform Either<X,Y> | Either<A,B> into Either<X|A,Y|B>, or
      // Either<X, Either<Y, Z>> into Either<X, Y|Z>
      E.flatten,
      // Check the string contents - should we treat it as JSON string or path to file?
      E.map((str) =>
        JSON_STARTS.some((s) => str.startsWith(s))
          ? E.right<never, ConfigStringType>({
              type: "JSON",
              str,
            })
          : FILE_STARTS.some((s) => str.startsWith(s))
          ? E.right<never, ConfigStringType>({
              type: "file",
              str,
            })
          : E.left(
              `The env variable string must start with one of the following characters: ${[
                ...JSON_STARTS,
                ...FILE_STARTS,
              ]
                .map((s) => `"${s}"`)
                .join(",")}.`,
            ),
      ),
      // Flatten again
      E.flatten,
      // We may need to use async now (in case of file path), so lift Either into TaskEither (Promisified version of Either)
      TE.fromEither,
      // Invoke async callback, and flatten result (flatMap = chain in fp-ts terminology)
      TE.chainW(({ type, str }) =>
        TE.tryCatch(
          async () =>
            // eslint-disable-next-line @typescript-eslint/no-unsafe-return
            JSON.parse(type === "JSON" ? str : await fs.readFile(str, "utf8")),
          (e) => (e instanceof Error ? e : new Error(`${e}`)),
        ),
      ),
      // Flatmap again, this time using the IO-TS validator.
      // The validator checks at runtime that whatever is parsed by JSON.parse(...) adhers to whatever is specified in validator.
      // The validator is in "config" const, which is defined later.
      TE.chainW((parsedJSON) => TE.fromEither(config.decode(parsedJSON))),

      // Invoke the final constructed callback
    )(),
    // At this point we have either error (from any point of callbacks above), or runtime-validated instance of configuration.
    // Throw if there is an error, and return the actual result otherwise.
    (configOrError) =>
      throwOnError(configOrError, (error) =>
        error instanceof Error || typeof error === "string"
          ? error
          : data.createErrorObject(error).getHumanReadableMessage(),
      ),
  );
};

export type Config = t.TypeOf<typeof config>;

const nonEmptyString = t.refinement(t.string, (str) => str.length > 0);

const remoteEndpoint = t.type({
  host: nonEmptyString,
  port: t.Int,
});

const config = t.type(
  {
    authentication: t.type(
      {
        ...remoteEndpoint.props,
        poolID: nonEmptyString,
      },
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

type ConfigStringType = { type: "JSON" | "file"; str: string };

const throwOnError = <E, A>(
  either: E.Either<E, A>,
  getErrorOrMessage?: (e: E) => string | Error,
): A => {
  if (E.isLeft(either)) {
    const errorOrMessage = (getErrorOrMessage ?? ((e) => `${e}`))(either.left);
    throw errorOrMessage instanceof Error
      ? errorOrMessage
      : new Error(errorOrMessage);
  }
  return either.right;
};

const CONFIG_ENV_VAR_NAME = "TYRAS_BE_CONFIG";

const JSON_STARTS = ["{"];

const FILE_STARTS = [".", "/"];
