import {
  Button,
  Input,
  InputGroup,
  InputRightElement,
  Text,
} from "@chakra-ui/react";
import { ChangeEvent, useState } from "react";
import * as user from "../services/user";

const LoginForm = () => {
  // React state related to this login form
  const [show, setShow] = useState(false);
  const [loginState, setLoginState] = useState<
    "initial" | "logging-in" | "errored"
  >("initial");
  const [username, setUsername] = useState<string | null>(null);
  const [password, setPassword] = useState<string | null>(null);

  // Access to global state
  const login = user.useUserStore((state) => state.login);

  // Wrap login action into function which remembers to set login state after each login attempt.
  const wrapIsLoading = async () => {
    let success = false;
    try {
      if (username && password) {
        await login({ username, password });
        success = true;
      }
    } catch {
      // Ignore - no need to even print to console.
    } finally {
      setLoginState(success ? "initial" : "errored");
    }
  };

  // Build some shared info for rendering
  const isInvalid = loginState === "errored";
  const clearInvalid = () => {
    if (isInvalid) {
      // To clear invalid state when user clicks on inputs
      setLoginState("initial");
    }
  };
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
        // This will cause button to go into 'loading'
        setLoginState("logging-in");
        // Invoke login action, finally setting login state to something else than "logging-in"
        void wrapIsLoading();
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
      <Button isLoading={loginState === "logging-in"} type="submit">
        <Text>Log in</Text>
      </Button>
    </form>
  );
};

export default LoginForm;
