/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unsafe-return */
import type * as protocol from "@ty-ras/protocol";
import * as dataBE from "@ty-ras/data-backend-io-ts";
import * as data from "@ty-ras/data-io-ts";
import * as spec from "@ty-ras/endpoint-spec";
import * as services from "../../services";
import * as types from "./types";
import * as state from "./state";
import { function as F, taskEither as TE } from "fp-ts";

export const withResponseBody = <
  TProtocolSpec extends protocol.ProtocolSpecCore<string, any>,
>(
  validation: data.Encoder<
    data.GetRuntime<TProtocolSpec["responseBody"]>,
    data.GetEncoded<TProtocolSpec["responseBody"]>
  >,
): SpecCreator<TProtocolSpec> => ({
  createEndpoint: ({ createTask }, stateSpec, apiSpec, extractArgs) => {
    const executor = F.flow(createTask, TE.getOrElseW(data.throwOnError));
    return {
      ...apiSpec,
      state: state.endpointState(stateSpec),
      output: dataBE.responseBodyForValidatedData(validation),
      endpointHandler: async (
        args: spec.EndpointHandlerArgs<any, state.GetState<{ db: true }>>,
        // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
      ) => await executor(args.state.db.db, extractArgs(args as any))(),
    } as any;
  },
});

export interface SpecCreator<
  TProtocolSpec extends protocol.ProtocolSpecCore<string, any>,
> {
  createEndpoint: <
    TFunctionality extends types.TFunctionalityBase,
    TStateSpec extends { db: true },
  >(
    functionality: TFunctionality,
    stateSpec: TStateSpec,
    apiSpec: Omit<
      types.EndpointSpec<TProtocolSpec, TFunctionality, TStateSpec>,
      "endpointHandler" | "output" | "state"
    >,
    extractArgs: (
      args: Parameters<
        types.EndpointSpec<
          TProtocolSpec,
          TFunctionality,
          TStateSpec
        >["endpointHandler"]
      >[0],
    ) => TFunctionality extends services.Service<infer TParams, infer _>
      ? TParams
      : never,
  ) => types.EndpointSpec<TProtocolSpec, TFunctionality, TStateSpec>;
}
