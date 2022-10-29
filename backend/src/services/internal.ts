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
) => QueryWithValidatedRows<TFunctionParameters, t.ArrayC<T>>) => {
  const validation = t.array(singleRowValidation);
  return <TFunctionParameters, TQueryParameters>({
    transform,
    queryString,
    queryParameterNames,
  }: QueryAndTransform<TFunctionParameters, TQueryParameters>) => ({
    validation,
    createTask: _createTask(
      transform,
      queryString,
      queryParameterNames,
      validation,
    ),
  });
};

export const singleRowQuery = <T extends t.Mixed>(
  singleRowValidation: T,
): (<TFunctionParameters, TQueryParameters>(
  queryAndTransform: QueryAndTransform<TFunctionParameters, TQueryParameters>,
) => QueryWithValidatedRows<
  TFunctionParameters,
  t.Type<t.TypeOf<T>, Array<t.OutputOf<T>>, unknown>
>) => {
  const validation = arrayOfOneElement(singleRowValidation);
  return <TFunctionParameters, TQueryParameters>({
    transform,
    queryString,
    queryParameterNames,
  }: QueryAndTransform<TFunctionParameters, TQueryParameters>) => ({
    validation,
    createTask: _createTask(
      transform,
      queryString,
      queryParameterNames,
      validation,
    ),
  });
};

export interface QueryWithValidatedRows<
  TFunctionParameters,
  TValidation extends t.Mixed,
> {
  validation: TValidation;
  createTask: CreateDBQueryTask<TFunctionParameters, TValidation>;
}

export type CreateDBQueryTask<TParameters, TValidation extends t.Mixed> = (
  db: db.Client,
  parameters: TParameters,
) => TE.TaskEither<Error, t.TypeOf<TValidation>>;

export const queryFurther =
  <TQueryValidation extends t.Mixed, TTransformValidation extends t.Mixed>(
    queryInfo: QueryWithValidatedRows<
      t.TypeOf<TQueryValidation>,
      TTransformValidation
    >,
  ): (<TFunctionParameters>(
    q: QueryWithValidatedRows<TFunctionParameters, TQueryValidation>,
  ) => QueryWithValidatedRows<TFunctionParameters, TTransformValidation>) =>
  ({ createTask }) => ({
    validation: queryInfo.validation,
    createTask: F.flow(
      (db, args) =>
        TE.of<Error, { db: typeof db; args: typeof args }>({ db, args }),
      TE.chain((dbAndArgs) =>
        F.pipe(
          createTask(dbAndArgs.db, dbAndArgs.args),
          TE.map((result) => ({ db: dbAndArgs.db, result })),
          TE.chain((dbAndResult) =>
            queryInfo.createTask(dbAndResult.db, dbAndResult.result),
          ),
        ),
      ),
    ),
  });

export const transformResult =
  <TResult, TTransformValidation extends t.Mixed>(
    transformTask: (
      task: TE.TaskEither<Error, TResult>,
    ) => TE.TaskEither<Error, t.TypeOf<TTransformValidation>>,
    validation: TTransformValidation,
  ): (<TFunctionParameters>(
    service: common.Service<TFunctionParameters, TResult>,
  ) => common.Service<TFunctionParameters, t.TypeOf<TTransformValidation>>) =>
  ({ createTask }) => ({
    createTask: F.flow(createTask, transformTask),
    validation,
  });

export const usingConnectionPool = <
  TFunctionParameters,
  TValidation extends t.Mixed,
>({
  validation,
  createTask,
}: QueryWithValidatedRows<TFunctionParameters, TValidation>): common.Service<
  TFunctionParameters,
  t.TypeOf<TValidation>
> => ({
  validation,
  createTask: F.flow(({ acquire, release }, args) =>
    TE.bracket(acquire(), (db) => createTask(db, args), release),
  ),
});

const _createTask = <
  TFunctionParameters,
  TQueryParameters,
  TValidation extends t.Mixed,
>(
  transform: ParameterTransform<TFunctionParameters, TQueryParameters>,
  queryString: string,
  queryParameterNames: ReadonlyArray<keyof TQueryParameters>,
  validation: TValidation,
): CreateDBQueryTask<TFunctionParameters, TValidation> =>
  queryParameterNames.length > 0
    ? F.flow(
        (db, parameters) => {
          const qParameters = transform(parameters);
          return TE.tryCatch(
            async () =>
              await db.query(
                queryString,
                queryParameterNames.map((paramName) => qParameters[paramName]),
              ),
            E.toError,
          );
        },
        TE.chainW(({ rows }) => TE.fromEither(validation.decode(rows))),
        TE.mapLeft(common.getErrorObject),
      )
    : F.flow(
        (db) => TE.tryCatch(async () => await db.query(queryString), E.toError),
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
