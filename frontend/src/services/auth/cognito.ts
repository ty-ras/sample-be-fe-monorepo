import * as cognito from "@aws-sdk/client-cognito-identity-provider";
import { function as F, taskEither as TE, either as E } from "fp-ts";
import * as api from "./api";

// Useful resource: https://github.com/aws-amplify/amplify-js/blob/main/packages/amazon-cognito-identity-js/src/CognitoUser.js

export const createAuthenticator = (
  endpointOrRegion: string,
  clientId: string,
): api.Authenticator => {
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
        E.toError,
      ),
    TE.map(
      ({ AuthenticationResult: result, ...info }): api.LoginResult =>
        result && result.AccessToken
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
