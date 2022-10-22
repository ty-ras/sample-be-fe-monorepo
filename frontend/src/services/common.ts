import type * as t from "io-ts";
import * as tyrasData from "@ty-ras/data-io-ts";

export interface Service<
  TValidation extends t.Mixed,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  TFunctionality extends (...args: Array<any>) => any,
> {
  functionality: TFunctionality;
  validation: TValidation;
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
  // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
  e instanceof Error ? e : new Error(`${e}`);

export const handleError = (error: Error) => {
  // For now, just console it
  console.error(error);
};
