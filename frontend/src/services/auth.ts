import * as cognito from "@aws-sdk/client-cognito-identity-provider";
import { function as F, task as T, taskEither as TE } from "fp-ts";
import * as common from "./common";

// Useful resource: https://github.com/aws-amplify/amplify-js/blob/main/packages/amazon-cognito-identity-js/src/CognitoUser.js

export const createAuthenticator = (
  endpointOrRegion: string,
  clientId: string,
): Authenticator => {
  const endpointIsURL = endpointOrRegion.startsWith("http");
  const client = new cognito.CognitoIdentityProviderClient({
    endpoint: endpointIsURL ? endpointOrRegion : undefined,
    region: endpointIsURL ? undefined : endpointOrRegion,
    // If we don't override signer in local env, we will get error on logout
    signer: endpointIsURL
      ? () =>
          Promise.resolve({
            sign: (req) => Promise.resolve(req),
          })
      : undefined,
  });

  const task = F.flow(
    (flow: cognito.AuthFlowType, parameters: Record<string, string>) =>
      TE.tryCatch(
        async () =>
          await client.send(
            new cognito.InitiateAuthCommand({
              AuthFlow: flow,
              ClientId: clientId,
              AuthParameters: parameters,
            }),
          ),
        common.makeError,
      ),
    TE.map(
      ({ AuthenticationResult: result, ...info }): LoginResult =>
        result && result.AccessToken && result.RefreshToken
          ? {
              result: "tokens",
              accessToken: result.AccessToken,
              refreshToken: result.RefreshToken,
            }
          : {
              result: "mfa",
              challengeName: info.ChallengeName ?? "<no challenge name>",
            },
    ),
  );

  return {
    login: (username, password) =>
      task(cognito.AuthFlowType.USER_PASSWORD_AUTH, {
        USERNAME: username,
        PASSWORD: password,
      }),
    // Remember DEVICE_KEY if needed
    refreshTokens: (refreshToken) =>
      task(cognito.AuthFlowType.REFRESH_TOKEN_AUTH, {
        REFRESH_TOKEN: refreshToken,
      }),
    // RevokeTokenCommand, (Admin)UserGlobalSignOutCommand, don't work
    logout: async (refreshToken) => {
      await client.send(
        new cognito.RevokeTokenCommand({
          ClientId: clientId,
          Token: refreshToken,
        }),
      );
    },
  };
};

export type LoginResult =
  | {
      result: "tokens";
      accessToken: string;
      refreshToken: string;
    }
  | {
      result: "mfa";
      challengeName: string;
    };

export interface Authenticator {
  login: (
    username: string,
    password: string,
  ) => TE.TaskEither<Error, LoginResult>;
  refreshTokens: (refreshToken: string) => TE.TaskEither<Error, LoginResult>;
  logout: (refreshToken: string) => Promise<void>;
}

// TODO MFA things
