import type * as protocol from "@ty-ras/protocol";
import type * as openapi from "@ty-ras/metadata-openapi";
import type * as dataBE from "@ty-ras/data-backend-io-ts";
import type * as server from "@ty-ras/server-node";
import type * as state from "./state";
import type * as services from "../../services";

/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unused-vars */
export type EndpointSpec<
  TProtocolSpec extends protocol.ProtocolSpecCore<string, unknown>,
  TFunctionality extends TFunctionalityBase,
  TStateSpec extends object = { db: true },
> = (
  pool: services.DBPool,
) => dataBE.EndpointSpec<
  TProtocolSpec,
  () => TFunctionality extends services.Service<infer _, infer T> ? T : never,
  server.ServerContext,
  ReadonlyArray<keyof TStateSpec & keyof state.State>,
  state.GetState<TStateSpec>,
  TMetadataProviders
>;

export type TMetadataProviders = {
  openapi: openapi.OpenAPIMetadataProvider<
    dataBE.HeaderDecoder,
    dataBE.HeaderEncoder,
    dataBE.OutputValidatorSpec<any, any>,
    dataBE.InputValidatorSpec<any>
  >;
};

export type TFunctionalityBase<TParams = any, TReturn = any> = services.Service<
  TParams,
  TReturn
>;
