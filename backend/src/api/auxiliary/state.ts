import type * as ep from "@ty-ras/endpoint";
import * as data from "@ty-ras/data-io-ts";
import * as dataBE from "@ty-ras/data-backend";
import * as t from "io-ts";
import * as f from "fp-ts";
import * as d from "@ty-ras/data";

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
    validator: (input) =>
      f.function.pipe(
        // Start with input
        input,
        // Validate the input - the result will be success or error
        validator.decode,
        // Perform transformation in case of both success and error
        f.either.bimap(
          // On error, check if error is about any property name related to authentication state
          (errors) =>
            errors.some((error) =>
              error.context.some(
                ({ key }) => key in authenticationStateValidator.props,
              ),
            )
              ? // This was authentication related error -> return 403
                {
                  error: "protocol-error" as const,
                  statusCode: 401, // 401 is "no authentication", while 403 is "no permission even with authentication"
                  body: undefined,
                }
              : // This was other error - perhaps DB pool creation failed? Will return 500
                data.createErrorObject(errors),
          // In case of success, transform it into
          (result) => ({
            error: "none" as const,
            data: result as GetState<TStateSpec>,
          }),
        ),
        // "Merge" the result of previous operation as TyRAS operates on type unions, not either-or constructs.
        f.either.fold(
          (
            error,
          ): // We need to help compiler a little bit with return type
          ReturnType<dataBE.StateValidator<GetState<TStateSpec>>> => error,
          (data) => data,
        ),
      ),
  };
};

const authenticationStateValidator = t.type({
  username: t.string,
  // More can be added: groupNames, etc
});

const fullStateValidator = t.type({
  ...authenticationStateValidator.props,
  // TODO:
  // db: DBConnectionPool
});

const AUTHENTICATION_PROPS = d.transformEntries(
  authenticationStateValidator.props,
  () => true,
);

export const filterAuthenticatedProperties = (
  propertyNames: ReadonlyArray<string>,
): Array<keyof typeof AUTHENTICATION_PROPS> =>
  propertyNames.filter(
    (propertyName): propertyName is keyof typeof AUTHENTICATION_PROPS =>
      propertyName in AUTHENTICATION_PROPS,
  );

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
