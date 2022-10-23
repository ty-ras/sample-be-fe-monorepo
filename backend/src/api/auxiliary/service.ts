/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unsafe-return */
import type * as protocol from "@ty-ras/protocol";
import * as dataBE from "@ty-ras/data-backend-io-ts";
import * as data from "@ty-ras/data-io-ts";
import * as types from "./types";
import * as state from "./state";

export const withResponseBody = <
  TProtocolSpec extends protocol.ProtocolSpecCore<string, any>,
>(
  validation: data.Encoder<
    data.GetRuntime<TProtocolSpec["responseBody"]>,
    data.GetEncoded<TProtocolSpec["responseBody"]>
  >,
): SpecCreator<TProtocolSpec> => ({
  createEndpoint: (functionality, stateSpec, apiSpec, extractArgs) =>
    ({
      ...apiSpec,
      state: state.endpointState(stateSpec),
      output: dataBE.responseBody(validation),
      endpointHandler: async (...args: Parameters<typeof extractArgs>) =>
        await functionality(...extractArgs(...args)),
    } as any),
});

export interface SpecCreator<
  TProtocolSpec extends protocol.ProtocolSpecCore<string, any>,
> {
  createEndpoint: <
    TFunctionality extends (
      ...args: Array<any>
    ) => Promise<data.GetRuntime<TProtocolSpec["responseBody"]>>,
    TStateSpec extends object,
  >(
    functionality: TFunctionality,
    stateSpec: TStateSpec,
    apiSpec: Omit<
      types.EndpointSpec<TProtocolSpec, TFunctionality, TStateSpec>,
      "endpointHandler" | "output" | "state"
    >,
    extractArgs: (
      ...args: Parameters<
        types.EndpointSpec<
          TProtocolSpec,
          TFunctionality,
          TStateSpec
        >["endpointHandler"]
      >
    ) => Readonly<Parameters<TFunctionality>>,
  ) => types.EndpointSpec<TProtocolSpec, TFunctionality, TStateSpec>;
}
