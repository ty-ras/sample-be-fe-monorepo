import * as t from "io-ts";
import type * as db from "pg";
import * as common from "./common";
import { function as F, either as E, task as T, taskEither as TE } from "fp-ts";

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
  return F.flow(
    // Execute query
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    (db: db.Client, _: void) =>
      TE.tryCatch(async () => await db.query(query), common.makeError),
    // Validate query result
    TE.chainW(({ rows }) => TE.fromEither(validation.decode(rows))),
    TE.mapLeft(common.getErrorObject),
  );
};

export const dbQueryWithParameters =
  <T>(validation: t.Decoder<unknown, T>): BindDBQueryArgs<T> =>
  (template, ...parameterNames) =>
    F.flow(
      (db, parameters) =>
        TE.tryCatch(
          async () =>
            await db.query(
              template.reduce(
                (curSQL, fragment, idx) => `${curSQL}${fragment}$${idx}`,
                "",
              ),
              parameterNames.map(
                (parameterName) =>
                  parameters[parameterName as keyof typeof parameters],
              ),
            ),
          common.makeError,
        ),
      TE.chainW(({ rows }) => TE.fromEither(validation.decode(rows))),
      TE.mapLeft(common.getErrorObject),
    );

export type BindDBQueryArgs<T> = <TArgs extends [string, ...Array<string>]>(
  template: TemplateStringsArray,
  ...parameterNames: TArgs
) => (
  db: db.Client,
  parameters: Record<TArgs[number], unknown>,
) => TE.TaskEither<Error, T>;

export const makeTemplateString = (string: string): TemplateStringsArray => {
  const result = [string] as const;
  return {
    ...result,
    raw: result,
  };
};

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

export const usePool = <T, TContext>(
  useClient: (client: db.Client, ctx: TContext) => TE.TaskEither<Error, T>,
) =>
  F.flow(
    (db: common.DBPool, ctx: TContext) => TE.bindTo("ctx")(TE.of({ db, ctx })),
    TE.bind("client", ({ ctx }) =>
      TE.tryCatch(async () => await ctx.db.acquire(), E.toError),
    ),
    TE.bindW("result", ({ client, ctx }) =>
      F.pipe(
        useClient(client, ctx.ctx),
        TE.mapLeft((error) => ({ error, client, ctx })),
      ),
    ),
    TE.toUnion,
    T.map((acquireErrorOrContext) =>
      acquireErrorOrContext instanceof Error
        ? TE.left<Error, T>(acquireErrorOrContext)
        : F.pipe(
            TE.tryCatch(
              async () =>
                await acquireErrorOrContext.ctx.db.release(
                  acquireErrorOrContext.client,
                ),
              E.toError,
            ),
            TE.toUnion,
            T.map(() =>
              "error" in acquireErrorOrContext
                ? E.left<Error, T>(acquireErrorOrContext.error)
                : E.right<Error, T>(acquireErrorOrContext.result),
            ),
          ),
    ),
    T.flatten,
    TE.toUnion,
    T.map<T | Error, T>(common.throwIfError),
    // TE.bimap(
    //   ({ client, ctx, error }) =>
    //     F.pipe(
    //       TE.of(error),
    //       TE.chainFirst(() =>
    //         TE.tryCatch(async () => await ctx.db.release(client), E.toError),
    //       ),
    //       TE.toUnion,
    //     ),
    //   ({ client, ctx, result }) =>
    //     F.pipe(
    //       TE.of(result),
    //       TE.chainFirst(() =>
    //         TE.tryCatch(async () => await ctx.db.release(client), E.toError),
    //       ),
    //     ),
    // ),
    // T.map((e) => (E.isLeft(e) ? TE.leftTask<Error, T>(e.left) : e.right)),
    // T.flatten,
    // TE.toUnion,
    // T.map<T | Error, T>(common.throwIfError),
    //  .chainFirst(({ ctx, client }) =>
    //   TE.tryCatch(async () => await ctx.db.release(client), E.toError),
    // ),
    // TE.map(({ result }) => result),
    // TE.toUnion,
    // T.map<T | Error, T>(common.throwIfError),
  );
