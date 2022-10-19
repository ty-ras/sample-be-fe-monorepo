import type * as dataBE from "@ty-ras/data-backend-io-ts";
import type * as protocol from "@ty-ras/protocol";
import type * as services from "../../services";
import * as types from "./types";
import * as state from "./state";
import type * as t from "io-ts";

export const createServiceEndpoint =
  <
    TValidation extends t.Mixed,
    TFunctionality extends (...args: Array<any>) => any,
    TStateSpec extends object = { db: true },
  >(
    service: services.Service<TValidation, TFunctionality>,
    stateSpec: TStateSpec,
  ): SpecCreator<TValidation, TFunctionality, TStateSpec> =>
  // 'Omit<EndpointSpec<TProtocolSpec, TFunctionality, ServerContext, readonly (keyof TStateSpec & ("username" | "db"))[], GetState<TStateSpec>, TMetadataProviders>, "endpointHandler" | "output" | "state"> & { state: EndpointStateValidator<StateInfo<keyof TStateSpec>, GetState<TStateSpec>>; outputHandler: TValidation; endpointHandler: (this: void, args: EndpointHandlerArgs<ServerContext, GetState<TStateSpec>>) => any; }'
  // 'EndpointSpec<TProtocolSpec, TFunctionality, ServerContext, readonly (keyof TStateSpec & ("username" | "db"))[], GetState<TStateSpec>, TMetadataProviders>'.
  (extractArgs, spec) => ({
    ...spec,
    state: state.endpointState(stateSpec),
    outputHandler: service.validation,
    endpointHandler: (args) => service.functionality(...extractArgs(...args)),
  });

//: <TProtocolSpec extends protocol.ProtocolSpecCore, TStateSpec extends object = { db: true },>(extractArgs: () => any, spec: types.EndpointSpec<TProtocolSpec, typeof service, TStateSpec>): types.EndpointSpec<TProtocolSpec, typeof service, TStateSpec> => () => null

export type SpecCreator<
  TValidation extends t.Mixed,
  TFunctionality extends (...args: Array<any>) => any,
  TStateSpec extends object,
> = <TProtocolSpec extends protocol.ProtocolSpecCore<string, any>>(
  extractArgs: (
    ...args: Parameters<
      types.EndpointSpec<
        TProtocolSpec,
        services.Service<TValidation, TFunctionality>,
        TStateSpec
      >["endpointHandler"]
    >
  ) => Parameters<TFunctionality>,
  spec: Omit<
    types.EndpointSpec<
      TProtocolSpec,
      services.Service<TValidation, TFunctionality>,
      TStateSpec
    >,
    "endpointHandler" | "output" | "state"
  >,
) => types.EndpointSpec<
  TProtocolSpec,
  services.Service<TValidation, TFunctionality>,
  TStateSpec
>;
