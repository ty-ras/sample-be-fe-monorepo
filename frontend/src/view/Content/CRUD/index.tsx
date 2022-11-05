import { Code, Container, Heading, Text } from "@chakra-ui/react";
import { lazy, Suspense } from "react";
import * as user from "services/user";

const ThingManager = lazy(() => import("./ThingManager"));

const CRUD = () => {
  const username = user.useUserStore((state) => state.username);
  return (
    <Container>
      <Heading>
        {username ? "Manage things" : "Please log in to manage things"}
      </Heading>
      <Suspense>
        {username ? (
          <ThingManager />
        ) : (
          <Text>
            Hint: username <Code>dev</Code>, password <Code>dev</Code>.
          </Text>
        )}
      </Suspense>
    </Container>
  );
};

export default CRUD;
