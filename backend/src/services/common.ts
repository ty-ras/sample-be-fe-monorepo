import * as t from "io-ts";
import * as tyrasData from "@ty-ras/data-io-ts";
import type * as db from "postgres";
export interface UnauthenticatedInput {
  db: db.Sql;
}

export type AuthenticatedInput = UnauthenticatedInput & {
  username: string;
};

export interface Service<
  TValidation extends t.Mixed,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  TFunctionality extends (...args: Array<any>) => any,
> {
  functionality: TFunctionality;
  validation: TValidation;
}

export const getErrorObject = (error: string | Error | t.Errors): Error =>
  error instanceof Error
    ? error
    : new Error(
        typeof error === "string"
          ? error
          : tyrasData.createErrorObject(error).getHumanReadableMessage(),
      );

export const throwIfError = <T>(obj: T): Exclude<T, Error> => {
  if (obj instanceof Error) {
    throw obj;
  }
  return obj as Exclude<T, Error>;
};

export const makeError = (e: unknown) =>
  e instanceof Error ? e : new Error(`${e}`);

// instanceOf is not part of io-ts, see also discussion https://github.com/gcanti/io-ts/issues/66
// It says it is 'bad idea' and advices to use smart constructors and option-monads
// It makes sense if everything you write and use is strictly functional, but in this case, I rather not.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const instanceOf = <T extends abstract new (...args: any) => any>(
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
