import type * as ep from "@ty-ras/endpoint";
import * as data from "@ty-ras/data-io-ts";
import * as t from "io-ts";
import { function as F, either as E } from "fp-ts";
import * as d from "@ty-ras/data";
import * as pg from "postgres";

export const unauthenticatedStateSpec = {
  db: true,
} as const;
export const authenticatedStateSpec = {
  db: true,
  username: true,
} as const;

export const endpointState = <TStateSpec extends object>(
  spec: TStateSpec,
): ep.EndpointStateValidator<
  StateInfo<keyof TStateSpec>,
  GetState<TStateSpec>
> => {
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
      "MandatoryState",
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
      "OptionalState",
    ),
  ]);
  return {
    stateInfo: entries.map(([propName]) => propName) as unknown as StateInfo<
      keyof TStateSpec
    >,
    validator: (input) =>
      F.pipe(
        // Start with input
        input,
        // Validate the input - the result will be success or error
        validator.decode,
        // Perform transformation in case of both success and error
        E.bimap(
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
        E.getOrElseW((e) => e),
      ),
  };
};

// instanceOf is not part of io-ts, see also discussion https://github.com/gcanti/io-ts/issues/66
// It says it is 'bad idea' and advices to use smart constructors and option-monads
// It makes sense if everything you write and use is strictly functional, but in this case, I rather not.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const instanceOf = <T extends abstract new (...args: any) => any>(
  ctor: T,
  className: string,
) =>
  new t.Type<InstanceType<T>>(
    `class ${className}`,
    (i): i is InstanceType<T> => i instanceof ctor,
    (i, context) => (i instanceof ctor ? t.success(i) : t.failure(i, context)),
    // eslint-disable-next-line @typescript-eslint/no-unsafe-return
    (a) => a,
  );

const authenticationStateValidator = t.type({
  username: t.string,
  // More can be added: groupNames, etc
});

export class Database {
  public constructor(public readonly db: pg.Sql) {}
}

const fullStateValidator = t.type({
  ...authenticationStateValidator.props,
  db: instanceOf(Database, "Database"),
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

export type StateInfo<T = keyof State> = ReadonlyArray<T>;

export type TStateBase = { [P in keyof State]: boolean };

export type GetState<TStateSpec> = {
  [P in keyof State & NonOptionalStateKeys<TStateSpec>]: State[P];
} & {
  [P in keyof State &
    Exclude<keyof TStateSpec, NonOptionalStateKeys<TStateSpec>>]?: State[P];
};

export type NonOptionalStateKeys<T> = {
  [P in keyof T]-?: true extends T[P] ? P : never;
}[keyof T];

// This is to fix Array.isArray type-inference not working for ReadonlyArray
// https://github.com/microsoft/TypeScript/issues/17002#issuecomment-1217386617
type IfUnknownOrAny<T, Y, N> = unknown extends T ? Y : N;

type ArrayType<T> = IfUnknownOrAny<
  T,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  T[] extends T ? T[] : any[] & T,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  Extract<T, readonly any[]>
>;

declare global {
  interface ArrayConstructor {
    isArray<T>(arg: T): arg is ArrayType<T>;
  }
}
