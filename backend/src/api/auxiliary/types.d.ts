import type * as tyras from "@ty-ras/backend-node-io-ts-openapi";
import type * as state from "./state";
import type * as services from "services";

/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unused-vars */
export type EndpointSpec<
  TProtocolSpec extends tyras.ProtocolSpecCore<string, unknown>,
  TFunctionality extends TFunctionalityBase,
  TStateSpec extends object,
> = tyras.EndpointSpec<
  TProtocolSpec,
  () => TFunctionality extends services.Service<infer _, infer T> ? T : never,
  tyras.ServerContext,
  ReadonlyArray<keyof TStateSpec & keyof state.State>,
  state.GetState<TStateSpec>,
  TMetadataProviders
>;

export type TMetadataProviders = {
  openapi: tyras.OpenAPIMetadataProvider<
    tyras.HeaderDecoder,
    tyras.HeaderEncoder,
    tyras.OutputValidatorSpec<any, any>,
    tyras.InputValidatorSpec<any>
  >;
};

export type TFunctionalityBase<TParams = any, TReturn = any> = services.Service<
  TParams,
  TReturn
>;
