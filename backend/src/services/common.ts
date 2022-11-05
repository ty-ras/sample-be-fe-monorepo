import * as t from "io-ts";
import type { resources } from "@ty-ras/backend-node-io-ts-openapi";
import type * as db from "pg";
import { function as F, taskEither as TE } from "fp-ts";

export type DBClient = db.Client;

export type DBPool = resources.ResourcePool<db.Client>;

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

export const transformReturnType =
  <TReturn, TValidation extends t.Mixed>(
    transform: (retVal: TReturn) => t.TypeOf<TValidation>,
    validation: TValidation,
  ): (<TParams>(
    service: Service<TParams, TReturn>,
  ) => Service<TParams, t.TypeOf<TValidation>>) =>
  (service) => ({
    validation,
    createTask: F.flow(service.createTask, TE.map(transform)),
  });
