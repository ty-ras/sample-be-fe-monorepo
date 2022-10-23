import * as t from "io-ts";
import type * as db from "postgres";
import * as common from "./common";
import { function as F, task as T, taskEither as TE } from "fp-ts";

/* eslint-disable @typescript-eslint/no-explicit-any */
export const createDBService = <
  TValidation extends t.Mixed,
  TArgs extends Array<any>,
>(
  createFunctionality: (validation: TValidation) => (
    ...args: TArgs
  ) => () => Promise<
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    TValidation extends t.Type<infer T, infer _0, infer _1> ? T : never
  >,
  validation: TValidation,
): common.Service<
  TValidation,
  (
    ...args: TArgs
  ) => ReturnType<ReturnType<ReturnType<typeof createFunctionality>>>
> => {
  const functionality = createFunctionality(validation);
  return {
    validation,
    // eslint-disable-next-line @typescript-eslint/no-unsafe-return
    functionality: async (...args) => await functionality(...args)(),
  };
};

export const createDBServiceForSingleRow = <
  TValidation extends t.Mixed,
  TArgs extends Array<any>,
>(
  createFunctionality: (
    validation: t.Type<
      t.TypeOf<TValidation>,
      t.OutputOf<TValidation>[],
      t.InputOf<TValidation>
    >,
  ) => (...args: TArgs) => () => Promise<
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    TValidation extends t.Type<infer T, infer _0, infer _1> ? T : never
  >,
  validation: TValidation,
): common.Service<
  TValidation,
  (
    ...args: TArgs
  ) => ReturnType<ReturnType<ReturnType<typeof createFunctionality>>>
> =>
  createDBService((v) => createFunctionality(arrayOfOneElement(v)), validation);

export const dbQueryWithoutParameters = <T>(
  query: string,
  validation: t.Decoder<unknown, T>,
) => {
  const template = makeTemplateString(query);
  return F.flow(
    // Execute query
    (db: db.Sql) =>
      TE.tryCatch(async () => await db(template), common.makeError),
    // Validate query result
    TE.chainW((rows) => TE.fromEither(validation.decode(rows))),
    // Merge Either<X,Y> into X | Y
    TE.getOrElseW((error) => T.of(common.getErrorObject(error))),
    // Throw if X | Y instanceof Error
    T.map(common.throwIfError),
  );
};

export const dbQueryWithParameters =
  <T>(validation: t.Decoder<unknown, T>): BindDBQueryArgs<T> =>
  (template, ...parameterNames) =>
    F.flow(
      (db, parameters) =>
        TE.tryCatch(
          async () =>
            await db(
              template,
              ...parameterNames.map(
                (parameterName) =>
                  parameters[parameterName as keyof typeof parameters] ?? null,
              ),
            ),
          common.makeError,
        ),
      TE.chainW((rows) => TE.fromEither(validation.decode(rows))),
      TE.getOrElseW((error) => T.of(common.getErrorObject(error))),
      T.map((lel) => common.throwIfError(lel)),
    );

export type BindDBQueryArgs<T> = <TArgs extends [string, ...Array<string>]>(
  template: TemplateStringsArray,
  ...parameterNames: TArgs
) => (
  db: db.Sql,
  parameters: Record<TArgs[number], db.ParameterOrFragment<never> | undefined>,
) => T.Task<T>;

export const makeTemplateString = (string: string): TemplateStringsArray => {
  const result = [string] as const;
  return {
    ...result,
    raw: result,
  };
};

export const pipeArrayToSingleElement = <TValidation extends ArrayTypeBase>(
  array: TValidation,
) =>
  array.pipe<
    GetArrayValidationElementType<TValidation>,
    GetArrayValidationArrayType<TValidation>,
    any,
    GetArrayValidationArrayType<TValidation>
  >(
    new t.Type(
      "FirstElement",
      (u): u is GetArrayValidationElementType<TValidation> => array.type.is(u),
      (i, context) =>
        i.length === 1
          ? t.success(i[0] as GetArrayValidationElementType<TValidation>)
          : t.failure(
              i,
              context,
              "Array was empty or contained more than one element",
            ),
      // eslint-disable-next-line @typescript-eslint/no-unsafe-return
      (a) => [a] as GetArrayValidationArrayType<TValidation>,
    ),
  );

export const arrayOfOneElement = <TValidation extends t.Mixed>(
  singleRow: TValidation,
) =>
  t
    .array(singleRow, "Rows")
    .pipe<
      t.TypeOf<TValidation>,
      Array<t.TypeOf<TValidation>>,
      any,
      Array<t.TypeOf<TValidation>>
    >(
      new t.Type(
        singleRow.name,
        (u): u is t.TypeOf<TValidation> => singleRow.is(u),
        (i, context) =>
          i.length === 1
            ? t.success(i[0])
            : t.failure(
                i,
                context,
                "Array was empty or contained more than one element",
              ),
        (a) => [a],
      ),
    );

/* eslint-disable @typescript-eslint/no-unused-vars */
type GetArrayValidationArrayType<TValidation extends ArrayTypeBase> =
  TValidation extends t.ArrayType<infer _0, infer TArray, infer _1, infer _2>
    ? TArray
    : never;
type GetArrayValidationElementType<TValidation extends ArrayTypeBase> =
  TValidation extends t.ArrayType<infer _0, infer TArray, infer _1, infer _2>
    ? TArray extends Array<infer T>
      ? T
      : never
    : never;

type ArrayTypeBase = t.ArrayType<t.Mixed, Array<any>, any, any>;
