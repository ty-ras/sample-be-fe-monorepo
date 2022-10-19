import * as cognito from "@aws-sdk/client-cognito-identity-provider";
import * as verify from "aws-jwt-verify";
import * as parse from "aws-jwt-verify/safe-json-parse";
import * as http from "http";
import * as t from "io-ts";
import { function as F, either as E, task as T, taskEither as TE } from "fp-ts";
import * as config from "./config";
import * as services from "./services";

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

export const createNonThrowingVerifier = async (
  input: config.Config["authentication"],
) => {
  const verifier = await createVerifier(input)();
  const checkTokenNotNull = E.fromNullable(new Error("Token is missing"));
  return F.flow(
    // Input: string token from headers (if present)
    // If it isn't present, we will shortcircuit to error right away.
    (scheme: string, token: string | undefined) =>
      F.pipe(
        // Will be left (Error) if token is nully, and right (non-nully token itself) otherwise
        checkTokenNotNull(token),
        // Validate that token string starts with given scheme (case-insensitively)
        // If it doesn't, return left (Error)
        // If it does, return right (the actual token without scheme prefix)
        E.chain((nonNullToken) => {
          const seenScheme = nonNullToken.substring(0, scheme.length);
          if (seenScheme.toLowerCase() === scheme) {
            return E.right(nonNullToken.substring(scheme.length));
          } else {
            return E.left(
              new Error(`Token has invalid scheme "${seenScheme}".`),
            );
          }
        }),
      ),
    // Lift Either into TaskEither, as we will be invoking async things
    TE.fromEither,
    // Invoke the asynchronous method (only if right = token was non-empty string)
    TE.chain((token) =>
      TE.tryCatch(async () => await verifier.verify(token), services.makeError),
    ),
    // 'Merge' both left and right
    TE.getOrElseW((error) => T.of(error)),
  );
};

export const createVerifier = ({
  connection,
  poolId,
  clientId,
}: config.Config["authentication"]) =>
  F.pipe(
    // Start by creating either JWT verifier if connection info is passed
    // Or Cognito verifier if no connection info
    TE.fromEither<
      ReturnType<typeof createCognitoVerifier>,
      ReturnType<typeof createJwtVerifier>
    >(
      connection
        ? E.right(createJwtVerifier(clientId, poolId, connection))
        : E.left(createCognitoVerifier(clientId, poolId)),
    ),
    // "Join" either-or into union type
    TE.map((jwtVerifier) =>
      jwtVerifier.connection.scheme === "http"
        ? // Side-effect: explicitly cache JWKS info if using http connection (as we do in local setup)
          // Verifier uses fetch API and it refuses to work on unencrypted http.
          explicitlyCacheJwks(poolId, jwtVerifier)
        : TE.left<typeof jwtVerifier["verifier"], Error>(jwtVerifier.verifier),
    ),
    // Convert Either<X, Either<Y,Z>> to Either<X | Y, Z>
    TE.flattenW,
    // Change Either<X,Y> to Either<Y,X>
    TE.swap,
    // 'Merge' both left (error) and right (verifier)
    TE.getOrElseW((error) => T.of(error)),
    // Throw if instanceof Error
    T.map(services.throwIfError),
  );

const httpGetAsync = (opts: Omit<http.RequestOptions, "method">) =>
  new Promise<{
    headers: http.IncomingHttpHeaders;
    data: string | undefined;
  }>((resolve, reject) => {
    const writeable = http
      .request({ ...opts, method: "GET" }, (resp) => {
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

class RequestError extends Error {
  public constructor(
    public readonly statusCode: number | undefined,
    message: string,
  ) {
    super(message);
  }
}

const getErrorMessage = (statusCode: number | undefined) =>
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

const createJwtVerifier = (
  clientId: string,
  userPoolId: string,
  connectionFromConfig: config.ConfigAuthenticationConnection,
) => {
  const connection = {
    ...connectionFromConfig,
    scheme: connectionFromConfig.scheme ?? "https",
  };
  const issuer = `${connection.scheme}://${connection.host}:${connection.port}/${userPoolId}`;
  return {
    connection,
    issuer,
    verifier: verify.JwtRsaVerifier.create({
      issuer,
      audience: null,
      ...verifierProps(clientId),
    }),
  };
};

const createCognitoVerifier = (clientId: string, userPoolId: string) =>
  verify.CognitoJwtVerifier.create({
    userPoolId,
    ...verifierProps(clientId),
  });

const verifierProps = (clientId: string) => ({
  clientId,
  tokenUse: "access" as const,
  scope: "aws.cognito.signin.user.admin",
});

const explicitlyCacheJwks = (
  userPoolId: string,
  {
    connection: { host, port },
    verifier,
  }: ReturnType<typeof createJwtVerifier>,
) =>
  F.pipe(
    // Start by right away invoking http get asynchronously
    TE.tryCatch(
      () =>
        httpGetAsync({
          host,
          port,
          path: `/${userPoolId}/.well-known/jwks.json`,
        }),
      services.makeError,
    ),
    // On success - parse JSON
    TE.map(({ data }) => parse.safeJsonParse(data ?? "")),
    // Validate parsed JSON at runtime against shape defined in "jwksContents"
    TE.chainW((contents) => TE.fromEither(jwksContents.decode(contents))),
    // Transform validation error of io-ts into JS Error object
    // As side-effect, cache the parsed JWKS information to verifier
    TE.bimap(services.getErrorObject, (jwks) => {
      verifier.cacheJwks(jwks);
      return verifier;
    }),
    // Swap right <-> left.
    // This makes sense in createVerifier, as flattenW is called after calling this
    TE.swap,
  );
