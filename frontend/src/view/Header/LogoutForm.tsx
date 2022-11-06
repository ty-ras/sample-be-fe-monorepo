import { Button, Text } from "@chakra-ui/react";
import * as user from "services/user";
import * as task from "hooks/asyncFailableTask";
import { useCallback } from "react";

const LogoutForm = () => {
  const logout = user.useUserStore((state) => state.logout);
  const { taskState, invokeTask } = task.useAsyncFailableTask(
    useCallback(() => logout(), [logout]),
  );
  return (
    <Button
      isLoading={task.isInvoking(taskState)}
      onClick={() => {
        invokeTask();
      }}
    >
      <Text>Log out</Text>
    </Button>
  );
};

export default LogoutForm;
