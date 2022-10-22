import create from "zustand";
import { persist } from "zustand/middleware";
import jwtDecode from "jwt-decode";
import * as t from "io-ts";
import { function as F, either as E, task as T, taskEither as TE } from "fp-ts";
import * as auth from "./auth";
import config from "../config";
import * as common from "./common";

interface User {
  // These actions are immutable
  login: (input: UserLoginInput) => Promise<UserLoginOutput>;
  logout: () => Promise<void>;
  getTokenForAuthorization: () => Promise<string | undefined>; // Refreshes the token if needed.

  // These fields and actions are mutable
  username: string; // Empty string if not logged in
  lastSeenToken: string; // Peek at token without checking whether it needs to refresh
}

const authenticator = auth.createAuthenticator(
  config.authentication.endpointOrRegion,
  config.authentication.clientId,
);

export const useUserStore = create<User>()(
  persist(
    (set, get) => ({
      username: "",
      lastSeenToken: "",
      getTokenForAuthorization: () => {
        // TODO check for expiration and refresh the token if needed
        // When refreshing, make sure that get().username === input.username to avoid setting token right after logging out.
        const token = get().lastSeenToken;
        return Promise.resolve(token || undefined);
      },
      login: async (input) =>
        await F.pipe(
          // We are performing async so lift to TaskEither immediately
          TE.of(input),
          TE.chainW((input) =>
            TE.tryCatch(
              async () =>
                await authenticator.login(input.username, input.password),
              common.makeError,
            ),
          ),
          // TODO this whole thing from here on is side-effect
          // Try chainFirst later?
          TE.chain(({ AuthenticationResult: authInfo, ...info }) =>
            authInfo
              ? F.pipe(
                  // TODO decode also refresh token
                  E.bindTo("accessToken")(
                    nonEmptyStringValidation.decode(authInfo.AccessToken),
                  ),
                  E.bindW("unvalidatedTokenContents", ({ accessToken }) =>
                    E.tryCatch(() => jwtDecode(accessToken), common.makeError),
                  ),
                  E.bindW("tokenContents", ({ unvalidatedTokenContents }) =>
                    tokenContentsValidation.decode(unvalidatedTokenContents),
                  ),
                  E.map(({ tokenContents, accessToken }) => {
                    set({
                      username: tokenContents.username,
                      lastSeenToken: accessToken,
                    });
                    return info;
                  }),
                  TE.fromEither,
                )
              : TE.left(
                  new Error(
                    `We probably encountered MFA response? (${
                      info.ChallengeName ?? "<No challenge>"
                    })`,
                  ),
                ),
          ),
          TE.getOrElseW((e) => T.of(common.getErrorObject(e))),
          T.map(common.throwIfError),
        )(),
      logout: async () => {
        // Logout -> send something to Cognito?
        try {
          const accessToken = get().lastSeenToken;
          if (accessToken) {
            await authenticator.logout(accessToken);
          }
        } finally {
          set({
            username: "",
            lastSeenToken: "",
          });
        }
      },
    }),
    {
      name: "user",
      getStorage: () => localStorage,
    },
  ),
);

const nonEmptyStringValidation = t.refinement(
  t.string,
  (str) => str.length > 0,
  "NonEmptyString",
);

const tokenContentsValidation = t.type(
  {
    username: nonEmptyStringValidation,
    exp: t.Int,
    // There are others but we don't need them
  },
  "TokenContents",
);

export interface UserLoginInput {
  username: string;
  password: string;
}

export type UserLoginOutput = Omit<
  auth.UsernamePasswordResult,
  "AuthenticationResult"
>;
