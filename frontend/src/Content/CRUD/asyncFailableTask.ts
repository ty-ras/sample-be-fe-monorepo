import { function as F, taskEither as TE } from "fp-ts";
import { useCallback, useState } from "react";

// Does not allow running in parallel
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const useAsyncFailableTask = <E, T, TInput extends Array<any>>(
  createTask: (...args: TInput) => TE.TaskEither<E, T> | undefined,
) => {
  const [state, setState] = useState<TaskInvocationState<E, T>>(stateInitial);

  const invokeTask = useCallback(
    (...args: TInput) => {
      let started = false;
      if (state !== "invoking") {
        const task = createTask(...args);
        if (task) {
          setState("invoking");
          started = true;
          void F.pipe(
            task,
            TE.bimap(
              (error) => setState({ result: "error", error }),
              (data) => setState({ result: "success", data }),
            ),
          )();
        }
      }

      return started;
    },
    [createTask, state],
  );

  return { taskState: state, invokeTask };
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const useAsyncFailableTaskCreator = <E, T, TInput extends Array<any>>(
  createTask: (...args: TInput) => TE.TaskEither<E, T> | undefined,
) => {
  const [state, setState] = useState<TaskInvocationState<E, T>>(stateInitial);

  const invokeTask = useCallback(
    (...args: TInput) => {
      if (state !== "invoking") {
        const task = createTask(...args);
        if (task) {
          setState("invoking");
          return F.pipe(
            task,
            TE.bimap(
              (error) => setState({ result: "error", error }),
              (data) => setState({ result: "success", data }),
            ),
          );
        }
      }
    },
    [createTask, state],
  );

  return { taskState: state, invokeTask };
};

export type TaskInvocationState<E, T> =
  | TaskInvocationStateInitial
  | TaskInvocationStateInvoking
  | TaskInvocationStateSuccess<T>
  | TaskInvocationStateError<E>;

export type TaskInvocationStateInitial = typeof stateInitial;
export type TaskInvocationStateInvoking = typeof stateInvoking;

export interface TaskInvocationStateSuccess<T> {
  result: "success";
  data: T;
}

export interface TaskInvocationStateError<E> {
  result: "error";
  error: E;
}

export const isInitial = <E, T>(
  state: TaskInvocationState<E, T>,
): state is TaskInvocationStateInitial => state === stateInitial;

export const isInvoking = <E, T>(
  state: TaskInvocationState<E, T>,
): state is TaskInvocationStateInvoking => state === stateInvoking;

export const isError = <E, T>(
  state: TaskInvocationState<E, T>,
): state is TaskInvocationStateError<E> =>
  typeof state === "object" && state.result === "error";

export const isSuccess = <E, T>(
  state: TaskInvocationState<E, T>,
): state is TaskInvocationStateSuccess<T> =>
  typeof state === "object" && state.result === "success";

const stateInitial = "initial";
const stateInvoking = "invoking";

export const logIfError = <E, T>(state: TaskInvocationState<E, T>) => {
  if (isError(state)) {
    console.error("Task error", state.error);
  }
};
