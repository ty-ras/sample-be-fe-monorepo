import { Box, Container, Heading, Stack } from "@chakra-ui/react";
import { lazy, Suspense } from "react";
import * as user from "../../services/user";

const LoginForm = lazy(() => import("./LoginForm"));
const LogoutForm = lazy(() => import("./LogoutForm"));

const Header = () => {
  const username = user.useUserStore((state) => state.username);
  return (
    <Box>
      <Container>
        <Heading>Hello, {username || "friend"}!</Heading>
        <Stack spacing={3}>
          <Suspense>{username ? <LogoutForm /> : <LoginForm />}</Suspense>
        </Stack>
      </Container>
    </Box>
  );
};

export default Header;
