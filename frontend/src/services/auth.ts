import * as cognito from "@aws-sdk/client-cognito-identity-provider";

export const createAuthenticator = (
  endpointOrRegion: string,
  clientId: string,
): Authenticator => {
  const endpointIsURL = endpointOrRegion.startsWith("http");
  const client = new cognito.CognitoIdentityProviderClient({
    endpoint: endpointIsURL ? endpointOrRegion : undefined,
    region: endpointIsURL ? undefined : endpointOrRegion,
  });
  return {
    login: async (username, password) =>
      await client.send(
        new cognito.InitiateAuthCommand({
          AuthFlow: cognito.AuthFlowType.USER_PASSWORD_AUTH,
          ClientId: clientId,
          AuthParameters: {
            USERNAME: username,
            PASSWORD: password,
          },
        }),
      ),
    logout: () => Promise.resolve(), // Using GlobalSignOutCommand requires region + AWS creds
  };
};

export type UsernamePasswordResult = cognito.InitiateAuthCommandOutput;

export interface Authenticator {
  login: (
    username: string,
    password: string,
  ) => Promise<UsernamePasswordResult>;
  logout: (accessToken: string) => Promise<void>;
}

// TODO MFA things
