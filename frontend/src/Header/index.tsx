import { Box, Container, Heading, Stack } from "@chakra-ui/react";
import * as user from "../services/user";
import LoginForm from "./LoginForm";
import LogoutForm from "./LogoutForm";

const Header = () => {
  const username = user.useUserStore((state) => state.username);
  return (
    <Box>
      <Container>
        <Heading>Hello, {username || "friend"}!</Heading>
        <Stack spacing={3}>{username ? <LogoutForm /> : <LoginForm />}</Stack>
      </Container>
    </Box>
  );
};

export default Header;
