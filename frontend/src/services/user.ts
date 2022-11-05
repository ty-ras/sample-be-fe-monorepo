import create, { StoreApi } from "zustand";
import { persist } from "zustand/middleware";
import jwtDecode from "jwt-decode";
import * as tyras from "@ty-ras/frontend-fetch-io-ts";
import * as t from "io-ts";
import { function as F, either as E, taskEither as TE } from "fp-ts";
import * as auth from "./auth";
import config from "../config";

interface User {
  // These actions are immutable
  login: (input: UserLoginInput) => TE.TaskEither<Error, auth.LoginResult>;
  logout: () => TE.TaskEither<Error, void>;
  // Refreshes the token if needed.
  // It must be immutable because our first load might be so that we are logged in (from persistence store), so we can't start with this field set to undefined.
  getTokenForAuthorization: () => Promise<string | undefined>;

  // These fields and actions are mutable
  username: string; // Empty string if not logged in
  accessToken: string; // Peek at token without checking whether it needs to refresh
  accessTokenExpires: number; // Decoded access token
  refreshToken: string;

  // Internal stuff
  _internalTokenRefreshPromise: undefined | Promise<string | undefined>;
}

const authenticator = auth.createAuthenticator(
  config.authentication.endpointOrRegion,
  config.authentication.clientId,
);

export const useUserStore = create<User>()(
  persist(
    (set, get) => ({
      username: "",
      accessToken: "",
      refreshToken: "",
      accessTokenExpires: 0,
      _internalTokenRefreshPromise: undefined,
      getTokenForAuthorization: () => {
        const { accessToken, refreshToken, accessTokenExpires, username } =
          get();
        if (
          refreshToken &&
          username &&
          accessTokenExpires &&
          // TODO make tolerance customizable (maybe put it in state?)
          Date.now() + 1000 > accessTokenExpires
        ) {
          // We need to refresh token
          let { _internalTokenRefreshPromise: promise } = get();
          // We don't use '=== undefined' check because if we persist the
          if (!(promise instanceof Promise)) {
            // We need to start the promise now
            promise = performTokenRefresh(get, set, refreshToken, username);
            set({ _internalTokenRefreshPromise: promise });
          }
          return promise;
        } else {
          // Transform empty string into undefined
          return Promise.resolve(accessToken || undefined);
        }
      },
      login: (input) =>
        F.pipe(
          // We are performing async so lift to TaskEither immediately
          TE.of(input),
          TE.chainW((input) =>
            authenticator.login(input.username, input.password),
          ),
          // Set state as side-effect
          TE.chainFirst((tokenOrMFA) =>
            tokenOrMFA.result === "tokens"
              ? F.pipe(setTokensToState(set, tokenOrMFA), TE.fromEither)
              : TE.left(
                  new Error(
                    `We probably encountered MFA response? (${
                      tokenOrMFA.challengeName ?? "<No challenge>"
                    })`,
                  ),
                ),
          ),
          TE.mapLeft(tyras.toError),
        ),
      logout: () =>
        TE.bracket(
          // Our 'resource' is refresh token
          TE.of(get().refreshToken),
          // Use the resource: perform logout if non-empty token
          (token) =>
            F.pipe(
              // Start with token
              token,
              // Check is it non-empty
              TE.fromPredicate(
                (t) => !!t,
                () => new Error("No refresh token"),
              ),
              // Perform logout if it is non-empty
              TE.chain((t) => authenticator.logout(t)),
            ),
          () => {
            // Regardless what happened in body, clear authentication fields
            set({
              username: "",
              accessToken: "",
              refreshToken: "",
              accessTokenExpires: 0,
            });
            // This will be ignored in any case, but is required by TE.bracket
            return TE.of<Error, void>(undefined);
          },
        ),
    }),
    {
      name: "user",
      getStorage: () => localStorage,
      // Don't serialize the promise
      serialize: (state) =>
        JSON.stringify({
          ...state,
          state: tyras.omit(state.state, "_internalTokenRefreshPromise"),
        }),
    },
  ),
);

const nonEmptyStringValidation = t.refinement(
  t.string,
  (str) => str.length > 0,
  "NonEmptyString",
);
const maybeNonEmptyStringValidation = t.union([
  t.undefined,
  nonEmptyStringValidation,
]);

const tokenContentsValidation = t.type(
  {
    username: nonEmptyStringValidation,
    exp: t.Int,
    // There are others but we don't need them
  },
  "TokenContents",
);

export type AccessTokenContents = t.TypeOf<typeof tokenContentsValidation>;

export interface UserLoginInput {
  username: string;
  password: string;
}

const setTokensToState = (
  set: StoreApi<User>["setState"],
  { accessToken, refreshToken }: auth.LoginResultTokens,
) =>
  F.pipe(
    E.bindTo("refreshToken")(
      maybeNonEmptyStringValidation.decode(refreshToken),
    ),
    E.bindW("accessToken", () => nonEmptyStringValidation.decode(accessToken)),
    E.bindW("unvalidatedTokenContents", ({ accessToken }) =>
      E.tryCatch(() => jwtDecode(accessToken), E.toError),
    ),
    E.bindW("tokenContents", ({ unvalidatedTokenContents }) =>
      tokenContentsValidation.decode(unvalidatedTokenContents),
    ),
    E.map(({ tokenContents, refreshToken, accessToken }) => {
      set({
        username: tokenContents.username,
        accessToken,
        accessTokenExpires: tokenContents.exp * 1000, // Expiration time is in seconds, while Date.now() is in milliseconds.
        ...(refreshToken ? { refreshToken } : {}),
      });
    }),
  );

const performTokenRefresh = (
  get: StoreApi<User>["getState"],
  set: StoreApi<User>["setState"],
  refreshToken: string,
  username: string,
) =>
  new Promise<string | undefined>((resolve) =>
    // eslint-disable-next-line @typescript-eslint/no-misused-promises
    setTimeout(async () => {
      try {
        await F.pipe(
          authenticator.refreshTokens(refreshToken),
          TE.chain((tokenOrMFA) =>
            TE.fromEither(
              tokenOrMFA.result === "tokens"
                ? // Remember to get() username again, after spending time waiting for token from server
                  get().username === username
                  ? setTokensToState(set, tokenOrMFA)
                  : E.left(new Error("Logout during refresh"))
                : E.left(new Error("MFA response during token refresh.")),
            ),
          ),
          // On any refresh error -> perform logout
          TE.orLeft(() => get().logout()),
        )();
      } catch {
        // Just leave it.
      } finally {
        set({ _internalTokenRefreshPromise: undefined });
        // Transform empty string into undefined
        resolve(get().accessToken || undefined);
      }
    }, 1),
  );
