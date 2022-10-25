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
  // Refreshes the token if needed.
  // It must be immutable because our first load might be so that we are logged in (from persistence store), so we can't start with this field set to undefined.
  getTokenForAuthorization: () => Promise<string | undefined>;

  // These fields and actions are mutable
  username: string; // Empty string if not logged in
  accessToken: string; // Peek at token without checking whether it needs to refresh
  refreshToken: string;
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
      getTokenForAuthorization: () => {
        // TODO check for expiration and refresh the token if needed
        // When refreshing, make sure that get().username === input.username to avoid setting token right after logging out.
        return Promise.resolve(get().accessToken || undefined);
      },
      login: async (input) =>
        await F.pipe(
          // We are performing async so lift to TaskEither immediately
          TE.of(input),
          TE.chainW((input) =>
            authenticator.login(input.username, input.password),
          ),
          // TODO this whole thing from here on is side-effect
          // Try chainFirst later?
          TE.chain((tokenOrMFA) =>
            tokenOrMFA.result === "tokens"
              ? F.pipe(
                  E.bindTo("refreshToken")(
                    nonEmptyStringValidation.decode(tokenOrMFA.refreshToken),
                  ),
                  // TODO decode also refresh token
                  E.bindW("accessToken", () =>
                    nonEmptyStringValidation.decode(tokenOrMFA.accessToken),
                  ),
                  E.bindW("unvalidatedTokenContents", ({ accessToken }) =>
                    E.tryCatch(() => jwtDecode(accessToken), common.makeError),
                  ),
                  E.bindW("tokenContents", ({ unvalidatedTokenContents }) =>
                    tokenContentsValidation.decode(unvalidatedTokenContents),
                  ),
                  E.map(({ tokenContents, refreshToken, accessToken }) => {
                    set({
                      username: tokenContents.username,
                      refreshToken,
                      accessToken,
                    });
                    return tokenOrMFA;
                  }),
                  TE.fromEither,
                )
              : TE.left(
                  new Error(
                    `We probably encountered MFA response? (${
                      tokenOrMFA.challengeName ?? "<No challenge>"
                    })`,
                  ),
                ),
          ),
          TE.getOrElseW((e) => T.of(common.getErrorObject(e))),
          T.map(common.throwIfError),
        )(),
      logout: async () => {
        try {
          const token = get().refreshToken;
          if (token) {
            await authenticator.logout(token);
          }
        } finally {
          set({
            username: "",
            accessToken: "",
            refreshToken: "",
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

export type UserLoginOutput = Omit<auth.LoginResult, "AuthenticationResult">;
