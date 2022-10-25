import { Box, Code, Container, Heading, Spinner, Text } from "@chakra-ui/react";
import * as data from "@ty-ras/data-frontend";
import type * as proto from "@ty-ras/protocol";
import * as dataGeneric from "@ty-ras/data";
import * as user from "../services/user";
import backend from "../services/backend";
import * as common from "../services/common";
import { useEffect, useState } from "react";
import type * as protocol from "../protocol";
import { function as F, task as T, taskEither as TE } from "fp-ts";

const CRUD = () => {
  const username = user.useUserStore((state) => state.username);
  return (
    <Container>
      <Heading>
        {username ? "Manage things" : "Please log in to manage things"}
      </Heading>
      {username ? (
        <ThingManager />
      ) : (
        <Text>
          Hint: username <Code>dev</Code>, password <Code>dev</Code>.
        </Text>
      )}
    </Container>
  );
};

const ThingManager = () => {
  const [things, setThings] = useState<
    data.APICallResult<Array<protocol.data.things.Thing>> | undefined
  >();
  useEffect(() => {
    if (things === undefined) {
      void F.pipe(
        TE.tryCatch(async () => await backend.getThings(), common.makeError),
        TE.getOrElseW((error) =>
          T.of(dataGeneric.exceptionAsValidationError(error)),
        ),
        T.map(setThings),
      )();
    }
  }, [things]);
  return (
    <Box>
      {things === undefined ? (
        <Spinner />
      ) : things.error === "none" ? (
        things.data.map((thing) => <Thing key={thing.id} thing={thing} />)
      ) : (
        <Text>Error: {JSON.stringify(things.errorInfo)}</Text>
        // TODO retry button -> setThings(undefined)
      )}
    </Box>
  );
};

const Thing = ({
  thing,
}: {
  thing: proto.RuntimeOf<protocol.data.things.Thing>;
}) => {
  return <Text>{thing.payload}</Text>;
};

export default CRUD;
