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
  ...args: ReadonlyArray<string>
) => {
  const validateRows = <T>(validation: t.Decoder<unknown, T>) => {
    if (typeof templateOrString === "string") {
      return {
        validation,
        task: F.flow(
          // Execute query
          // eslint-disable-next-line @typescript-eslint/no-unused-vars
          (db: common.DBClient, _: void) =>
            TE.tryCatch(
              async () => await db.query(templateOrString),
              E.toError,
            ),
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
                  templateOrString.reduce(
                    (curSQL, fragment, idx) => `${curSQL}${fragment}$${idx}`,
                    "",
                  ),
                  args.map((parameterName) => parameters[parameterName]),
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
  <TArgs extends [string, ...Array<string>]>(
    template: TemplateStringsArray,
    ...parameterNames: TArgs
  ): ValidateQuery<Record<TArgs[number], unknown>>;
};

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
