import { function as F, taskEither as TE } from "fp-ts";
import { useCallback, useState } from "react";

/* eslint-disable @typescript-eslint/no-explicit-any*/
/**
 * Creates a invocation callback and task state tracking for a callback producing `TaskEither`, which typically performs some asynchronous, failable action.
 * The invocation callback will take care of not executing the task in parallel, but instead simply return if the task is already running.
 *
 * IMPORTANT!
 * Please pass result of `useCallback` as a parameter to this function!
 * Otherwise, the `invokeTask` of returned object will constantly change!
 * @param createTask The callback which creates the task, or returns `undefined`. **Should be result of `useCallback` call**.
 * @returns Object with task invocation callback, as well as current task state information.
 */
export const useAsyncFailableTask = <E, T, TInput extends Array<any>>(
  createTask: (...args: TInput) => TE.TaskEither<E, T> | undefined,
) => {
  /* eslint-enable @typescript-eslint/no-explicit-any*/
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

export const useTaskStatusIndicator = (shouldShowBasedOnTaskState: boolean) => {
  const [showState, setShowState] = useState<TaskStateIndicatorState>(
    stateIndicatorInitial,
  );

  const isInitial = showState === stateIndicatorInitial;
  const isAlreadyShowed = showState === stateIndicatorAlreadyShown;
  if (isInitial && shouldShowBasedOnTaskState) {
    setShowState(stateIndicatorShouldShow);
  } else if (isAlreadyShowed && !shouldShowBasedOnTaskState) {
    setShowState(stateIndicatorInitial);
  }

  return {
    shouldShow: showState === stateIndicatorShouldShow,
    hasShown: useCallback(() => {
      if (showState === stateIndicatorShouldShow) {
        setShowState(stateIndicatorAlreadyShown);
      }
    }, [showState]),
  };
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
    // eslint-disable-next-line no-console
    console.error("Task error", state.error);
  }
};

const stateIndicatorInitial = stateInitial;
const stateIndicatorShouldShow = "should-show";
const stateIndicatorAlreadyShown = "already-shown";

type TaskStateIndicatorState =
  | typeof stateIndicatorInitial
  | typeof stateIndicatorShouldShow
  | typeof stateIndicatorAlreadyShown;
