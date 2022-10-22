import { useEffect, useState } from "react";
import SwaggerUI from "swagger-ui-react";
import "swagger-ui-react/swagger-ui.css";
import * as user from "../services/user";
import { callRawHTTP } from "../services/backend";
import * as common from "../services/common";
import * as t from "io-ts";
import { function as F, task as T, taskEither as TE } from "fp-ts";
import { Spinner, Text, Container } from "@chakra-ui/react";

// eslint-disable-next-line sonarjs/cognitive-complexity
const APIDoc = () => {
  const username = user.useUserStore((user) => user.username);
  const getToken = user.useUserStore((user) => user.getTokenForAuthorization);
  const [state, setState] = useState<undefined | FetchedData<object>>(
    undefined,
  );

  useEffect(() => {
    void F.pipe(
      TE.tryCatch(async () => await getToken?.(), common.makeError),
      TE.chain((token) =>
        TE.tryCatch(
          async () =>
            (
              await callRawHTTP({
                method: "GET",
                url: "/openapi",
                headers: token ? { Authorization: `Bearer ${token}` } : {},
              })
            ).body,
          common.makeError,
        ),
      ),
      TE.chainW((body) => TE.fromEither(t.UnknownRecord.decode(body))),
      TE.getOrElseW((error) => T.of(common.getErrorObject(error))),
      T.map((data) => {
        if (user.useUserStore.getState().username === username) {
          setState({
            username,
            data,
          });
        }
      }),
    )();
  }, [username, getToken]);
  return typeof state === "object" ? (
    state.data instanceof Error ? (
      <Container>
        <Text>Error!</Text>
      </Container>
    ) : (
      <SwaggerUI spec={state.data} />
    )
  ) : (
    <Spinner />
  );
};

export default APIDoc;

interface FetchedData<T> {
  username: string;
  data: T;
}
