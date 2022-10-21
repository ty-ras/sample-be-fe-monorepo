import { useEffect, useState } from "react";
import SwaggerUI from "swagger-ui-react";
import "swagger-ui-react/swagger-ui.css";
import * as user from "../services/user";
import { callRawHTTP } from "../services/backend";
import * as common from "../services/common";
import * as t from "io-ts";
import { function as F, task as T, taskEither as TE } from "fp-ts";
import { Spinner, Text } from "@chakra-ui/react";

const APIDoc = () => {
  const [spec, setSpec] = useState<object | undefined>(undefined);
  // Have this in order to re-render on login/logout
  // This is because the resulting OpenAPI document will be different for logged-in user.
  // We also don't want to refresh when
  user.useUserStore((user) => user.username);
  useEffect(() => {
    void F.pipe(
      TE.tryCatch(
        async () =>
          (await callRawHTTP({ method: "GET", url: "/openapi" })).body,
        common.makeError,
      ),
      TE.chainW((body) => TE.fromEither(t.UnknownRecord.decode(body))),
      TE.getOrElseW((error) => T.of(common.getErrorObject(error))),
      T.map(setSpec),
    )();
  }, [setSpec]);
  return spec === undefined ? (
    <Spinner />
  ) : spec instanceof Error ? (
    <Text>Error!</Text>
  ) : (
    <SwaggerUI spec={spec} />
  );
};

export default APIDoc;
