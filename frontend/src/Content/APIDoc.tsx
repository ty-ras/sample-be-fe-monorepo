import { lazy, Suspense, useEffect } from "react";
import "swagger-ui-react/swagger-ui.css";
import * as user from "../services/user";
import { callRawHTTP } from "../services/backend";
import * as t from "io-ts";
import { function as F, either as E, taskEither as TE } from "fp-ts";
import { Spinner, Text, Container } from "@chakra-ui/react";
import * as task from "../hooks/asyncFailableTask";

const SwaggerUI = lazy(() => import("swagger-ui-react"));

// eslint-disable-next-line sonarjs/cognitive-complexity
const APIDoc = () => {
  const username = user.useUserStore((user) => user.username);
  const getToken = user.useUserStore((user) => user.getTokenForAuthorization);

  const { taskState, invokeTask } = task.useAsyncFailableTask(() =>
    F.pipe(
      TE.tryCatch(async () => await getToken(), E.toError),
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
          E.toError,
        ),
      ),
      TE.chainW((body) => TE.fromEither(t.UnknownRecord.decode(body))),
      TE.chain((body) =>
        user.useUserStore.getState().username === username
          ? TE.right(body)
          : TE.left(
              new LogoutDuringTaskError("Logout during Swagger UI fetch"),
            ),
      ),
    ),
  );
  useEffect(() => {
    invokeTask();
    // Don't depend in invokeTask as then we will be re-rendering forever
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [username]);
  return task.isError(taskState) ? (
    <Container>
      <Text>Error!</Text>
    </Container>
  ) : (
    <Suspense fallback={<Spinner />}>
      {task.isSuccess(taskState) ? (
        <SwaggerUI spec={taskState.data} />
      ) : (
        <Text>This should never happen.</Text>
      )}
    </Suspense>
  );
};

export default APIDoc;

class LogoutDuringTaskError extends Error {}
