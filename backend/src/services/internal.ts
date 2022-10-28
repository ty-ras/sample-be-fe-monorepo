import * as t from "io-ts";
import type * as db from "pg";
import * as common from "./common";
import { function as F, either as E, taskEither as TE } from "fp-ts";

export type ParameterTransform<TFunctionParameters, TQueryParameters> = (
  args: TFunctionParameters,
) => TQueryParameters;

export function executeSQL(
  template: TemplateStringsArray,
): <TFunctionParameters>(
  transform: ParameterTransform<TFunctionParameters, void>,
) => QueryAndTransform<TFunctionParameters, void>;
export function executeSQL<
  TArgs extends [SQLTemplateParameter, ...Array<SQLTemplateParameter>],
>(
  template: TemplateStringsArray,
  ...args: TArgs
): <TFunctionParameters>(
  transform: ParameterTransform<
    TFunctionParameters,
    TArgs[number] extends AsIsSQL
      ? void
      : Record<TArgs[number] & string, unknown>
  >,
) => QueryAndTransform<
  TFunctionParameters,
  TArgs[number] extends AsIsSQL ? void : Record<TArgs[number] & string, unknown>
>;
export function executeSQL<TArgs extends Array<SQLTemplateParameter>>(
  template: TemplateStringsArray,
  ...args: TArgs
): <TFunctionParameters>(
  transform: ParameterTransform<
    TFunctionParameters,
    void | Record<TArgs[number] & string, unknown>
  >,
) =>
  | QueryAndTransform<TFunctionParameters, void>
  | QueryAndTransform<
      TFunctionParameters,
      void | Record<TArgs[number] & string, unknown>
    > {
  return (transform) => {
    const parameterNames: Array<string> = [];
    const queryString = constructTemplateString(template, args, (arg, idx) => {
      if (typeof arg === "string") {
        parameterNames.push(arg);
        arg = `$${idx + 1}`;
      } else {
        arg = arg.str;
      }
      return arg;
    });
    return {
      transform,
      queryString,
      queryParameterNames: parameterNames as unknown as ReadonlyArray<never>,
    };
  };
}
export type SQLTemplateParameter = string | AsIsSQL;
export interface QueryAndTransform<TFunctionParameters, TQueryParameters> {
  transform: ParameterTransform<TFunctionParameters, TQueryParameters>;
  queryString: string;
  queryParameterNames: ReadonlyArray<keyof TQueryParameters>;
}

export const multiRowQuery = <T extends t.Mixed>(
  singleRowValidation: T,
): (<TFunctionParameters, TQueryParameters>(
  queryAndTransform: QueryAndTransform<TFunctionParameters, TQueryParameters>,
) => QueryWithValidatedRows<
  TFunctionParameters,
  TQueryParameters,
  t.ArrayC<T>
>) => {
  const validation = t.array(singleRowValidation);
  return <TFunctionParameters, TQueryParameters>({
    transform,
    queryString,
    queryParameterNames,
  }: QueryAndTransform<TFunctionParameters, TQueryParameters>) => ({
    transform,
    validation,
    createTask: _createTask(queryString, queryParameterNames, validation),
  });
};

export const singleRowQuery = <T extends t.Mixed>(
  singleRowValidation: T,
): (<TFunctionParameters, TQueryParameters>(
  queryAndTransform: QueryAndTransform<TFunctionParameters, TQueryParameters>,
) => QueryWithValidatedRows<
  TFunctionParameters,
  TQueryParameters,
  t.Type<t.TypeOf<T>, Array<t.OutputOf<T>>, unknown>
>) => {
  const validation = arrayOfOneElement(singleRowValidation);
  return <TFunctionParameters, TQueryParameters>({
    transform,
    queryString,
    queryParameterNames,
  }: QueryAndTransform<TFunctionParameters, TQueryParameters>) => ({
    transform,
    validation,
    createTask: _createTask(queryString, queryParameterNames, validation),
  });
};

export interface QueryWithValidatedRows<
  TFunctionParameters,
  TQueryParameters,
  TValidation extends t.Mixed,
> {
  transform: ParameterTransform<TFunctionParameters, TQueryParameters>;
  validation: TValidation;
  createTask: CreateDBQueryTask<TQueryParameters, TValidation>;
}

export type CreateDBQueryTask<TQueryParameters, TValidation extends t.Mixed> = (
  db: db.Client,
  parameters: TQueryParameters,
) => TE.TaskEither<Error, t.TypeOf<TValidation>>;

export const transformResult =
  <
    TQueryParameters,
    TQueryValidation extends t.Mixed,
    TTransformValidation extends t.Mixed,
  >(
    transformTask: (
      task: TE.TaskEither<Error, t.TypeOf<TQueryValidation>>,
    ) => TE.TaskEither<Error, t.TypeOf<TTransformValidation>>,
    validation: TTransformValidation,
  ): (<TFunctionParameters>(
    q: QueryWithValidatedRows<
      TFunctionParameters,
      TQueryParameters,
      TQueryValidation
    >,
  ) => QueryWithValidatedRows<
    TFunctionParameters,
    TQueryParameters,
    TTransformValidation
  >) =>
  ({ transform, createTask }) => ({
    transform,
    validation,
    createTask: F.flow(createTask, transformTask),
  });

export const toService = <
  TFunctionParameters,
  TQueryParameters,
  TValidation extends t.Mixed,
>({
  validation,
  transform,
  createTask,
}: QueryWithValidatedRows<
  TFunctionParameters,
  TQueryParameters,
  TValidation
>): common.Service<TFunctionParameters, t.TypeOf<TValidation>> => ({
  validation,
  createTask: ({ acquire, release }) =>
    F.flow(transform, (args) =>
      TE.bracket(acquire(), (db) => createTask(db, args), release),
    ),
});

const _createTask = <TQueryParameters, TValidation extends t.Mixed>(
  queryString: string,
  queryParameterNames: ReadonlyArray<keyof TQueryParameters>,
  validation: TValidation,
): CreateDBQueryTask<TQueryParameters, TValidation> =>
  queryParameterNames.length > 0
    ? F.flow(
        (db, parameters) =>
          TE.tryCatch(
            async () =>
              await db.query(
                queryString,
                queryParameterNames.map((paramName) => parameters[paramName]),
              ),
            E.toError,
          ),
        TE.chainW(({ rows }) => TE.fromEither(validation.decode(rows))),
        TE.mapLeft(common.getErrorObject),
      )
    : F.flow(
        // Execute query
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        (db, _) =>
          TE.tryCatch(async () => await db.query(queryString), E.toError),
        // Validate query result
        TE.chainW(({ rows }) => TE.fromEither(validation.decode(rows))),
        TE.mapLeft(common.getErrorObject),
      );

export const arrayOfOneElement = <TValidation extends t.Mixed>(
  singleRow: TValidation,
) =>
  t.array(singleRow, "Rows").pipe<
    t.TypeOf<TValidation>,
    Array<t.TypeOf<TValidation>>,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
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

export const createSQLColumnList = <T>(props: { [P in keyof T]: unknown }) =>
  Object.keys(props).join(", ");

export class AsIsSQL {
  public constructor(public readonly str: string) {}
}

export const rawSQL = (str: string) => new AsIsSQL(str);

const constructTemplateString = <T>(
  fragments: TemplateStringsArray,
  args: ReadonlyArray<T>,
  transformArg: (arg: T, idx: number, fragment: string) => string,
) =>
  fragments.reduce(
    (curString, fragment, idx) =>
      `${curString}${fragment}${
        idx >= args.length ? "" : transformArg(args[idx], idx, fragment)
      }`,
    "",
  );
