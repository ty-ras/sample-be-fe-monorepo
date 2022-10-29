import * as t from "io-ts";
import * as tyrasData from "@ty-ras/data-io-ts";
import type * as db from "pg";
import type * as pooling from "./pooling";
import type { taskEither as TE } from "fp-ts";

export type DBClient = db.Client;

export type DBPool = pooling.ResourcePool<db.Client>;

// eslint-disable-next-line @typescript-eslint/no-empty-interface
export interface UnauthenticatedInput {
  // db: DBPool;
}

export type AuthenticatedInput = UnauthenticatedInput & {
  username: string;
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export interface ValidatedAnyExecutor<TArgs extends Array<any>, T> {
  task: (...args: TArgs) => TE.TaskEither<Error, T>;
  validation: t.Type<T>;
}

export interface Service<TParams, TReturn> {
  validation: t.Type<TReturn>;
  createTask: (pool: DBPool, arg: TParams) => TE.TaskEither<Error, TReturn>;
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
