import {
  Button,
  Input,
  InputGroup,
  InputRightElement,
  Text,
  Tooltip,
} from "@chakra-ui/react";
import { ChangeEvent, useState } from "react";
import * as user from "services/user";
import * as task from "hooks/asyncFailableTask";
import { LockIcon } from "@chakra-ui/icons";

const LoginForm = () => {
  // Access to global state
  const login = user.useUserStore((state) => state.login);

  // React state related to this login form
  const [show, setShow] = useState(false);
  const [username, setUsername] = useState<string | null>(null);
  const [password, setPassword] = useState<string | null>(null);
  const canLogIn = !!username && !!password;
  const { taskState, invokeTask } = task.useAsyncFailableTask(() => {
    if (canLogIn) {
      return login({ username, password });
    }
  });
  const { shouldShow: isInvalid, hasShown: clearInvalid } =
    task.useTaskStatusIndicator(task.isError(taskState));

  const onChange = (
    setter: typeof setUsername | typeof setPassword,
    e: ChangeEvent<HTMLInputElement>,
  ) => {
    clearInvalid();
    setter(e.currentTarget.value);
  };
  const commonProps = {
    isInvalid,
    onFocus: clearInvalid,
  };

  // Render
  return (
    <form
      onSubmit={(e) => {
        // Don't reload whole page on submit
        e.preventDefault();
        invokeTask();
      }}
    >
      <Input
        {...commonProps}
        onChange={(e) => onChange(setUsername, e)}
        placeholder="Username"
      ></Input>
      <InputGroup size="md">
        <Input
          {...commonProps}
          onChange={(e) => onChange(setPassword, e)}
          pr="4.5rem"
          type={show ? "text" : "password"}
          placeholder="Password"
        />
        <InputRightElement width="4.5rem">
          <Button h="1.75rem" size="sm" onClick={() => setShow(!show)}>
            {show ? "Hide" : "Show"}
          </Button>
        </InputRightElement>
      </InputGroup>
      <Tooltip
        placement="right"
        openDelay={500}
        label={
          canLogIn ? "Log in" : "Please enter username and password to log in"
        }
      >
        <Button
          rightIcon={<LockIcon />}
          isLoading={task.isInvoking(taskState)}
          isDisabled={!canLogIn}
          loadingText="Logging in..."
          type="submit"
        >
          <Text>Log in</Text>
        </Button>
      </Tooltip>
    </form>
  );
};

export default LoginForm;
