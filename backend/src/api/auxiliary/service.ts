/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unsafe-return */
import * as tyras from "@ty-ras/backend-node-io-ts-openapi";
import * as services from "services";
import * as types from "./types";
import * as state from "./state";
import { function as F, taskEither as TE } from "fp-ts";

export const withResponseBody = <
  TProtocolSpec extends tyras.ProtocolSpecCore<string, any>,
>(
  validation: tyras.Encoder<
    tyras.GetRuntime<TProtocolSpec["responseBody"]>,
    tyras.GetEncoded<TProtocolSpec["responseBody"]>
  >,
): SpecCreator<TProtocolSpec> => ({
  createEndpoint: ({ createTask }, stateSpec, apiSpec, extractArgs) => {
    const executor = F.flow(createTask, TE.getOrElseW(tyras.throwOnError));
    return {
      ...apiSpec,
      state: state.endpointState(stateSpec),
      output: tyras.responseBodyForValidatedData(validation),
      endpointHandler: async (
        args: tyras.EndpointHandlerArgs<any, state.GetState<{ db: true }>>,
        // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
      ) => await executor(args.state.db.db, extractArgs(args as any))(),
    } as any;
  },
});

export interface SpecCreator<
  TProtocolSpec extends tyras.ProtocolSpecCore<string, any>,
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
