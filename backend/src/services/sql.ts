import * as t from "io-ts";
import * as common from "./common";
import { function as F, either as E, taskEither as TE } from "fp-ts";
import * as sql from "./db";

export const usingPostgresConnection: sql.SQLClientInformation<
  Error,
  common.DBClient
> = {
  constructParameterReference: (index) => `$${index + 1}`,
  executeQuery: (client, query, parameters) =>
    F.pipe(
      TE.tryCatch(async () => await client.query(query, parameters), E.toError),
      // eslint-disable-next-line @typescript-eslint/no-unsafe-return
      TE.map(({ rows }) => rows),
    ),
};

export const CRUDEndpoint = <TValidation extends t.Mixed, TQueryParameters>(
  query: sql.SQLQueryInformation<TQueryParameters>,
  rowValidation: TValidation,
) => singleQueryEndpoint(query, sql.one(rowValidation));

export const singleQueryEndpoint = <
  TValidation extends t.Mixed,
  TQueryParameters,
>(
  query: sql.SQLQueryInformation<TQueryParameters>,
  queryValidation: TValidation,
): (<TFunctionParameters>(
  parameterTransform: (funcParams: TFunctionParameters) => TQueryParameters,
) => common.Service<TFunctionParameters, t.TypeOf<TValidation>>) => {
  const boundQuery = F.pipe(
    usingPostgresConnection,
    query,
    sql.validateRows(queryValidation),
  );
  return (parameterTransform) => ({
    validation: queryValidation,
    createTask: F.flow(({ acquire, release }, args) =>
      TE.bracket(
        acquire(),
        (client) =>
          F.pipe(
            boundQuery(client, parameterTransform(args)),
            TE.mapLeft(common.getErrorObject),
          ),
        release,
      ),
    ),
  });
};