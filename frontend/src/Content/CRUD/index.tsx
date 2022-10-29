import { Code, Container, Heading, Text } from "@chakra-ui/react";
import * as user from "../../services/user";
import ThingManager from "./ThingManager";

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

export default CRUD;
