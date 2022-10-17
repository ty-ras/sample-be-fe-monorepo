import * as cognito from "@aws-sdk/client-cognito-identity-provider";
import * as verify from "aws-jwt-verify";
import * as parse from "aws-jwt-verify/safe-json-parse";
import * as http from "http";
import * as t from "io-ts";
import * as config from "./config";

export const getToken = async (endpoint: string) => {
  return await new cognito.CognitoIdentityProviderClient({
    endpoint,
  }).send(
    new cognito.InitiateAuthCommand({
      AuthFlow: cognito.AuthFlowType.USER_PASSWORD_AUTH,
      ClientId: "abcdefghijklmnopqrstuvwxy",
      AuthParameters: {
        USERNAME: "dev",
        PASSWORD: "dev",
      },
    }),
  );
};

export const doVerify = async (
  userPoolHost: string,
  userPoolPort: number,
  userPoolId: string,
  token: string,
) => {
  // Unfortunately, can't use https://github.com/awslabs/aws-jwt-verify as it doesn't like custom URLs and thus will not work with local cognito pool emulator.
  const issuer = `http://${userPoolHost}:${userPoolPort}/${userPoolId}`;
  const verifier = verify.JwtRsaVerifier.create({
    issuer,
    // Don't check audience - we are checking access tokens
    audience: null,
    clientId: "abcdefghijklmnopqrstuvwxy",
    tokenUse: "access",
    scope: "aws.cognito.signin.user.admin",
  });
  // We must do this manually if we are using 'http' protocol.
  verifier.cacheJwks(
    config.throwOnError(
      jwksContents.decode(
        parse.safeJsonParse(
          (
            await getAsync({
              host: userPoolHost,
              port: userPoolPort,
              path: `/${userPoolId}/.well-known/jwks.json`,
              method: "GET",
            })
          ).data ?? "",
        ),
      ),
    ),
    issuer,
  );
  return await verifier.verify(token);
};

export const getAsync = (opts: http.RequestOptions) =>
  new Promise<{
    headers: http.IncomingHttpHeaders;
    data: string | undefined;
  }>((resolve, reject) => {
    // const agent =
    //   opts.protocol === "http:"
    //     ? undefined
    //     : new https.Agent({
    //         rejectUnauthorized: false,
    //       });
    const writeable = http
      .request(opts, (resp) => {
        resp.setEncoding("utf8");
        let data: string | undefined;
        const headers = resp.headers;
        const statusCode = resp.statusCode;

        // A chunk of data has been received.
        resp.on("data", (chunk: string) => {
          if (data === undefined) {
            data = chunk;
          } else {
            data += chunk;
          }
        });

        // The whole response has been received. Print out the result.
        resp.on("end", () => {
          if (statusCode === undefined || statusCode >= 400) {
            reject(new RequestError(statusCode, getErrorMessage(statusCode)));
          } else {
            resolve({
              headers,
              data,
            });
          }
        });
      })
      .on("error", (err) => {
        reject(err);
      });
    writeable.end();
  });

export class RequestError extends Error {
  public constructor(
    public readonly statusCode: number | undefined,
    message: string,
  ) {
    super(message);
  }
}

export const getErrorMessage = (statusCode: number | undefined) =>
  `Status code: ${statusCode}`;

const jwksContents = t.type({
  keys: t.array(
    t.intersection([
      t.type({
        kty: t.string,
      }),
      t.partial({
        use: t.string,
        alg: t.string,
        kid: t.string,
        n: t.string,
        e: t.string,
      }),
    ]),
  ),
});
