import * as t from "io-ts";
import type * as db from "pg";
import * as common from "./common";
import { function as F, either as E, taskEither as TE } from "fp-ts";

/* eslint-disable @typescript-eslint/no-explicit-any */
export const createSimpleDBService = <TParams, T>({
  validation,
  task,
}: ValidatedQueryExecutor<TParams, T>): FlowConstructor<TParams, T> => ({
  createFlow: (transform) => ({
    validation,
    createTask: ({ acquire, release }) =>
      F.flow(transform, (args) =>
        TE.bracket(acquire(), (db) => task(db, args), release),
      ),
  }),
});

export const withSQL: WithSQL = ((
  templateOrString: string | TemplateStringsArray,
  ...args: ReadonlyArray<SQLTemplateParameter>
) => {
  const paramNames: Array<string> = [];
  const queryString =
    typeof templateOrString === "string"
      ? templateOrString
      : constructTemplateString(templateOrString, args, (arg, idx) => {
          if (typeof arg === "string") {
            paramNames.push(arg);
            arg = `$${idx + 1}`;
          } else {
            arg = arg.str;
          }
          return arg;
        });
  const validateRows = <T>(validation: t.Decoder<unknown, T>) => {
    if (paramNames.length === 0) {
      return {
        validation,
        task: F.flow(
          // Execute query
          // eslint-disable-next-line @typescript-eslint/no-unused-vars
          (db: common.DBClient, _: void) =>
            TE.tryCatch(async () => await db.query(queryString), E.toError),
          // Validate query result
          TE.chainW(({ rows }) => TE.fromEither(validation.decode(rows))),
          TE.mapLeft(common.getErrorObject),
        ),
      };
    } else {
      return {
        validation,
        task: F.flow(
          (db: common.DBClient, parameters: Record<string, unknown>) =>
            TE.tryCatch(
              async () =>
                await db.query(
                  queryString,
                  paramNames.map((paramName) => parameters[paramName]),
                ),
              E.toError,
            ),
          TE.chainW(({ rows }) => TE.fromEither(validation.decode(rows))),
          TE.mapLeft(common.getErrorObject),
        ),
      };
    }
  };
  return {
    validateRows: <T extends t.Mixed>(validation: T) =>
      validateRows(t.array(validation)),
    validateRow: <T extends t.Mixed>(validation: T) =>
      validateRows(arrayOfOneElement(validation)),

    // TODO: Remove 'as' assertion.
  };
}) as WithSQL;

export type WithSQL = {
  (sqlString: string): ValidateQuery<void>;
  <TArgs extends [SQLTemplateParameter, ...Array<SQLTemplateParameter>]>(
    template: TemplateStringsArray,
    ...parameterNames: TArgs
  ): ValidateQuery<
    TArgs[number] extends AsIsSQL
      ? void
      : Record<TArgs[number] & string, unknown>
  >;
};

export type SQLTemplateParameter = string | AsIsSQL;

export interface ValidateQuery<TParams> {
  validateRows: <T extends t.Mixed>(
    validation: T,
  ) => ValidatedQueryExecutor<TParams, Array<t.TypeOf<T>>>;
  validateRow: <T extends t.Mixed>(
    validation: T,
  ) => ValidatedQueryExecutor<TParams, t.TypeOf<T>>;
}

export type ValidatedQueryExecutor<TParams, T> = common.ValidatedAnyExecutor<
  [db.Client, TParams],
  T
>;

export interface FlowConstructor<TParams, T> {
  createFlow: <TNewParams>(
    flowParamsToQueryParams: (args: TNewParams) => TParams,
  ) => common.Service<TNewParams, T>;
}

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
