import { taskEither as TE } from "fp-ts";

export type LoginResult = LoginResultTokens | LoginResultMFA;

export interface LoginResultTokens {
  result: "tokens";
  accessToken: string;
  refreshToken: string | undefined;
}

export interface LoginResultMFA {
  result: "mfa";
  challengeName: string;
}

export interface Authenticator {
  login: (
    username: string,
    password: string,
  ) => TE.TaskEither<Error, LoginResult>;
  refreshTokens: (refreshToken: string) => TE.TaskEither<Error, LoginResult>;
  logout: (refreshToken: string) => TE.TaskEither<Error, void>;
}

// TODO MFA things
