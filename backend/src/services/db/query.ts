/* eslint-disable @typescript-eslint/ban-types */
import type { taskEither as TE } from "fp-ts";

export function executeSQLQuery(
  template: TemplateStringsArray,
): SQLQueryInformation<void>;
export function executeSQLQuery<
  TArgs extends [SQLTemplateParameter, ...Array<SQLTemplateParameter>],
>(
  template: TemplateStringsArray,
  ...args: TArgs
): SQLQueryInformation<
  TArgs[number] extends SQLRaw ? void : SQLParameterReducer<TArgs>
>;
export function executeSQLQuery<TArgs extends Array<SQLTemplateParameter>>(
  template: TemplateStringsArray,
  ...args: TArgs
): SQLQueryInformation<void | SQLParameterReducer<TArgs>> {
  return ({ constructParameterReference, executeQuery }) => {
    const parameterNames: Array<string> = [];
    const queryString = constructTemplateString(template, args, (arg, idx) => {
      let thisFragment: string;
      if (arg instanceof SQLParameter) {
        parameterNames.push(arg.parameterName);
        thisFragment = constructParameterReference(idx, arg);
      } else {
        thisFragment = arg.rawSQL;
      }
      return thisFragment;
    });

    return (client, parameters) =>
      executeQuery(
        client,
        queryString,
        parameterNames.length > 0 && parameters
          ? (parameterNames ?? []).map(
              (parameterName) =>
                parameters[parameterName as keyof typeof parameters],
            )
          : [],
      );
  };
}

export type SQLQueryInformation<TParameters> = <TError, TClient>(
  clientInformation: SQLClientInformation<TError, TClient>,
) => SQLQueryExecutor<TError, TClient, TParameters, Array<unknown>>;

export interface SQLClientInformation<TError, TClient> {
  constructParameterReference: (
    parameterIndex: number,
    parameter: SQLParameter<string, unknown>,
  ) => string;
  executeQuery: (
    client: TClient,
    sqlString: string,
    parameters: Array<unknown>,
  ) => TE.TaskEither<TError, Array<unknown>>;
}

export type SQLQueryExecutor<TError, TClient, TParameters, TReturnType> = (
  client: TClient,
  parameters: TParameters,
) => TE.TaskEither<TError, TReturnType>;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type SQLTemplateParameter = SQLParameter<string, any> | SQLRaw;

export class SQLRaw {
  public constructor(public readonly rawSQL: string) {}
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export class SQLParameter<TName extends string, TType> {
  public constructor(public readonly parameterName: TName) {}
}

export type SQLParameterReducer<
  Arr extends Array<unknown>,
  Result extends Record<string, unknown> = {},
  Index extends number[] = [],
> = Arr extends []
  ? Result
  : Arr extends [infer Head, ...infer Tail]
  ? SQLParameterReducer<
      [...Tail],
      Result &
        (Head extends SQLParameter<infer TName, infer TType>
          ? Record<TName, TType>
          : {}),
      [...Index, 1]
    >
  : Readonly<Result>;

export const raw = (str: string) => new SQLRaw(str);

export const parameter =
  <TName extends string>(
    name: TName,
  ): (<TType>() => SQLParameter<TName, TType>) =>
  () =>
    new SQLParameter(name);

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
