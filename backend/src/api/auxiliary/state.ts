import type * as ep from "@ty-ras/endpoint";
import * as data from "@ty-ras/data-io-ts";
import * as t from "io-ts";
import * as f from "fp-ts";

export const endpointState = <TStateSpec extends TStateBase>(
  spec: TStateSpec,
): ep.EndpointStateValidator<StateInfo, GetState<TStateSpec>> => {
  const entries = Object.entries(spec);
  const validator = t.intersection([
    t.type(
      Object.fromEntries(
        entries
          .filter(([, isRequired]) => isRequired)
          .map(([propName]) => [
            propName,
            fullStateValidator.props[propName as keyof State],
          ]),
      ),
    ),
    t.partial(
      Object.fromEntries(
        entries
          .filter(([, isRequired]) => !isRequired)
          .map(([propName]) => [
            propName,
            fullStateValidator.props[propName as keyof State],
          ]),
      ),
    ),
  ]);
  return {
    stateInfo: entries.map(([propName]) => propName as keyof State),
    // TODO return 403 if validation error and includes username
    validator: (input) => {
      const errorOrResult = f.function.pipe(
        input,
        validator.decode,
        f.either.bimap(
          (errors) =>
            errors.some(
              (error) => error.context[0].key in fullStateValidator.props,
            )
              ? {
                  error: "protocol-error" as const,
                  statusCode: 403,
                  body: undefined,
                }
              : data.createErrorObject(errors),
          (result) => ({
            error: "none" as const,
            data: result as GetState<TStateSpec>,
          }),
        ),
      );
      return f.either.isLeft(errorOrResult)
        ? errorOrResult.left
        : errorOrResult.right;
    },
  };
};

const fullStateValidator = t.type({
  username: t.string,
  // TODO:
  // db: DBConnectionPool
});

export type State = t.TypeOf<typeof fullStateValidator>;

export type StateInfo = ReadonlyArray<keyof State>;

export type TStateBase = { [P in keyof State]: boolean };

export type GetState<TStateSpec extends TStateBase> = {
  [P in keyof State & NonOptionalStateKeys<TStateSpec>]: State[P];
} & {
  [P in keyof State &
    Exclude<keyof TStateSpec, NonOptionalStateKeys<TStateSpec>>]?: State[P];
};

export type NonOptionalStateKeys<T> = {
  [P in keyof T]-?: true extends T[P] ? P : never;
}[keyof T];
