/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unsafe-return */
import type * as protocol from "@ty-ras/protocol";
import * as dataBE from "@ty-ras/data-backend-io-ts";
import type * as services from "../../services";
import * as types from "./types";
import * as state from "./state";
import type * as t from "io-ts";

export const createServiceEndpoint =
  <
    TValidation extends t.Mixed,
    TFunctionality extends (...args: Array<any>) => Promise<any>,
    TStateSpec extends object,
  >(
    {
      validation,
      functionality,
    }: services.Service<TValidation, TFunctionality>,
    stateSpec: TStateSpec,
  ): SpecCreator<TFunctionality, TStateSpec> =>
  (extractArgs, spec) =>
    ({
      ...spec,
      state: state.endpointState(stateSpec),
      output: dataBE.responseBody(validation),
      endpointHandler: async (...args: Parameters<typeof extractArgs>) =>
        await functionality(...extractArgs(...args)),
    } as any);

export type SpecCreator<
  TFunctionality extends (...args: Array<any>) => Promise<any>,
  TStateSpec extends object,
> = <
  TProtocolSpec extends protocol.ProtocolSpecCore<
    string,
    Awaited<ReturnType<TFunctionality>>
  >,
>(
  extractArgs: (
    ...args: Parameters<
      types.EndpointSpec<
        TProtocolSpec,
        TFunctionality,
        TStateSpec
      >["endpointHandler"]
    >
  ) => Parameters<TFunctionality>,
  spec: Omit<
    types.EndpointSpec<TProtocolSpec, TFunctionality, TStateSpec>,
    "endpointHandler" | "output" | "state"
  >,
) => types.EndpointSpec<TProtocolSpec, TFunctionality, TStateSpec>;
