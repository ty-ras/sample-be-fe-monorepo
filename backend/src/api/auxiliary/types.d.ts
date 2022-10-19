import type * as protocol from "@ty-ras/protocol";
import type * as openapi from "@ty-ras/metadata-openapi";
import type * as dataBE from "@ty-ras/data-backend-io-ts";
import type * as server from "@ty-ras/server-node";
import type * as state from "./state";
import type * as services from "../../services";

/* eslint-disable @typescript-eslint/no-explicit-any */
export type EndpointSpec<
  TProtocolSpec extends protocol.ProtocolSpecCore<string, unknown>,
  TFunctionality extends services.Service<any, any>,
  TStateSpec extends object = { db: true },
> = dataBE.EndpointSpec<
  TProtocolSpec,
  TFunctionality["functionality"],
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
