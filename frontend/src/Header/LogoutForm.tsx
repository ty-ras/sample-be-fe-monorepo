import { Button, Text } from "@chakra-ui/react";
import { useState } from "react";
import * as user from "../services/user";

const LogoutForm = () => {
  const [isLoading, setIsLoading] = useState(false);
  const logout = user.useUserStore((state) => state.logout);
  const wrapIsLoading = async () => {
    try {
      await logout();
    } finally {
      setIsLoading(false);
    }
  };
  return (
    <Button
      isLoading={isLoading}
      onClick={() => {
        setIsLoading(true);
        void wrapIsLoading();
      }}
    >
      <Text>Log out</Text>
    </Button>
  );
};

export default LogoutForm;
