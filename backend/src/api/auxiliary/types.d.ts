/* eslint-disable @typescript-eslint/ban-types */
import type * as protocol from "@ty-ras/protocol";
import type * as openapi from "@ty-ras/metadata-openapi";
import type * as dataBE from "@ty-ras/data-backend-io-ts";
import type * as data from "@ty-ras/data-io-ts";
import type * as spec from "@ty-ras/endpoint-spec";
import type * as server from "@ty-ras/server-node";
import type * as state from "./state";

/* eslint-disable @typescript-eslint/no-explicit-any */
export type EndpointSpec<
  TProtocolSpec extends protocol.ProtocolSpecCore<string, unknown>,
  TFunctionality extends (...args: any) => any,
  TStateSpec extends state.TStateBase,
> = dataBE.EndpointSpec<
  TProtocolSpec,
  TFunctionality,
  server.ServerContext,
  ReadonlyArray<keyof TStateSpec>,
  state.GetState<TStateSpec>,
  TMetadataProviders,
  void
>;

export type TMetadataProviders = {
  openapi: openapi.OpenAPIMetadataBuilder<
    dataBE.HeaderDecoder,
    dataBE.HeaderEncoder,
    dataBE.OutputValidatorSpec<any, any>,
    dataBE.InputValidatorSpec<any>
  >;
};

export type AnyDecoder = data.Decoder<any>;
export type AnyEncoder = data.Encoder<any, any>;
export type AnyOutputContents = { [dataBE.CONTENT_TYPE]: AnyEncoder };
export type AnyInputContents = { [dataBE.CONTENT_TYPE]: AnyDecoder };
export type OpenAPIMetadataProviders = {
  openapi: openapi.OpenAPIMetadataProvider<
    AnyDecoder,
    AnyEncoder,
    AnyOutputContents,
    AnyInputContents
  >;
};
export type Builder<
  TMetadata extends spec.MetadataProvidersBase<
    AnyDecoder,
    AnyEncoder,
    AnyOutputContents,
    AnyInputContents
  > = OpenAPIMetadataProviders,
> = spec.AppEndpointBuilderProvider<
  server.ServerContext,
  state.StateInfo,
  AnyDecoder,
  AnyEncoder,
  AnyOutputContents,
  AnyInputContents,
  TMetadata
>;
