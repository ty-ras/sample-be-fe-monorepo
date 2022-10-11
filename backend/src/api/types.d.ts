/* eslint-disable @typescript-eslint/ban-types */
import type * as protocol from "@ty-ras/protocol";
import type * as openapi from "@ty-ras/metadata-openapi";
import type * as dataBE from "@ty-ras/data-backend-io-ts";
import type * as data from "@ty-ras/data-io-ts";
import type * as spec from "@ty-ras/spec";

/* eslint-disable @typescript-eslint/no-explicit-any */
export type EndpointSpec<
  TProtocolSpec extends protocol.ProtocolSpecCore<string, unknown>,
  TFunctionality extends (...args: any) => any,
> = dataBE.EndpointSpec<
  TProtocolSpec,
  TFunctionality,
  GetProtocolState<TProtocolSpec>,
  TMetadataProviders,
  void
>;

export type GetProtocolState<TProtocolSpec> =
  TProtocolSpec extends protocol.ProtocolSpecHeaders<Record<string, "auth">>
    ? AuthenticatedState
    : Partial<AuthenticatedState>;

export type DefaultState = Partial<AuthenticatedState>;

export type TMetadataProviders = {
  openapi: openapi.OpenAPIMetadataBuilder<
    dataBE.HeaderDecoder,
    dataBE.HeaderEncoder,
    dataBE.OutputValidatorSpec<any, any>,
    dataBE.InputValidatorSpec<any>
  >;
};

export interface AuthenticatedState {
  username: string;
}

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
  TContext,
  TRefinedContext,
  TState,
  TMetadata extends spec.MetadataProvidersBase<
    AnyDecoder,
    AnyEncoder,
    AnyOutputContents,
    AnyInputContents
  > = OpenAPIMetadataProviders,
> = spec.AppEndpointBuilderProvider<
  TContext,
  TRefinedContext,
  TState,
  AnyDecoder,
  AnyEncoder,
  AnyOutputContents,
  AnyInputContents,
  TMetadata
>;
