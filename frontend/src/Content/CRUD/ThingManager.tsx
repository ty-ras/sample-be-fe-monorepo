import {
  Box,
  Button,
  Center,
  Flex,
  HStack,
  IconButton,
  Input,
  InputGroup,
  InputRightElement,
  SimpleGrid,
  Spinner,
  StackDivider,
  Text,
  Tooltip,
  useClipboard,
} from "@chakra-ui/react";
import { AddIcon, CopyIcon, DeleteIcon, RepeatIcon } from "@chakra-ui/icons";
import type * as proto from "@ty-ras/protocol";
import backend, {
  toEither,
  NativeOrAPICallError,
} from "../../services/backend";
import { useCallback, useEffect, useState } from "react";
import type * as protocol from "../../protocol";
import { function as F, task as T, either as E, taskEither as TE } from "fp-ts";
import * as state from "./state";

const ThingManager = () => {
  const things = state.useState((s) => s.things);
  return (
    <Box>
      <Flex direction="column">
        <Center flex={1}>
          <HStack divider={<StackDivider />}>
            <CreateThing />
            <RefreshThings />
          </HStack>
        </Center>
        {things === undefined ? (
          <Spinner />
        ) : (
          <Flex direction="column">
            {things.map((thing) => (
              <Thing key={thing.id} thing={thing} />
            ))}
          </Flex>
        )}
      </Flex>
    </Box>
  );
};

const CreateThing = () => {
  const [creationError, setCreationError] = useState<
    NativeOrAPICallError | undefined
  >();
  const [isFetching, setIsFetching] = useState(false);
  const addThing = state.useState((s) => s.addThing);
  return (
    <Button
      leftIcon={<AddIcon />}
      aria-label="Create new thing"
      isLoading={isFetching}
      loadingText={"Creating..."}
      colorScheme={creationError ? "red" : undefined}
      onClick={() => {
        if (!isFetching) {
          setIsFetching(true);
          void F.pipe(
            TE.tryCatch(
              async () =>
                await backend.createThing({
                  body: { payload: "" },
                }),
              E.toError,
            ),
            TE.chainW((d) => TE.fromEither(toEither(d))),
            TE.bimap(setCreationError, addThing),
            T.map((e) => {
              setIsFetching(false);
              if (creationError !== undefined && E.isRight(e)) {
                setCreationError(undefined);
              }
            }),
          )();
        }
      }}
    >
      Create
    </Button>
  );
};

const RefreshThings = () => {
  const things = state.useState((s) => s.things);
  const resetThings = state.useState((s) => s.resetThings);
  const [error, setError] = useState<NativeOrAPICallError | undefined>();
  const [isFetching, setIsFetching] = useState(false);
  const refreshThings = useCallback(() => {
    if (!isFetching) {
      setIsFetching(true);
      void F.pipe(
        TE.tryCatch(async () => await backend.getThings(), E.toError),
        TE.chainW((r) => TE.fromEither(toEither(r))),
        TE.bimap(setError, resetThings),
        T.map(() => setIsFetching(false)),
      )();
    }
  }, [isFetching, resetThings]);
  useEffect(() => {
    if (error === undefined && things === undefined) {
      void refreshThings();
    }
  }, [things, error, refreshThings]);
  return (
    <Button
      rightIcon={<RepeatIcon />}
      aria-label="Refresh things from backend"
      isLoading={isFetching}
      loadingText={"Refreshing..."}
      colorScheme={error === undefined ? undefined : "red"}
      onClick={() => void refreshThings()}
    >
      Refresh all
    </Button>
  );
};

const Thing = ({
  thing,
}: {
  thing: proto.RuntimeOf<protocol.data.things.Thing>;
}) => {
  const [isBusy, setIsBusy] = useState(false);
  const [isInvalid, setIsInvalid] = useState(false);
  const removeThing = state.useState((s) => s.removeThing);
  const updateThing = state.useState((s) => s.updateThing);
  return (
    <Flex direction="row">
      <Center>
        <IconButton
          aria-label={`Refresh thing ${thing.id}`}
          icon={<RepeatIcon />}
          isDisabled={isBusy}
          onClick={() => {
            if (!isBusy) {
              setIsBusy(true);
              void F.pipe(
                TE.tryCatch(
                  async () =>
                    await backend.readThing({ url: { id: thing.id } }),
                  E.toError,
                ),
                TE.chainW((r) => TE.fromEither(toEither(r))),
                TE.bimap(
                  () => setIsInvalid(true),
                  (d) => updateThing(d),
                ),
                T.map(() => setIsBusy(false)),
              )();
            }
          }}
        />
      </Center>
      <Box flex={1}>
        <SimpleGrid
          templateColumns="minmax(20px, auto) 1fr;"
          gap="0.5em"
          alignItems="center"
        >
          <PropertyEditor
            name="ID"
            value={thing.id}
            id={`t-${thing.id}-id`}
            isDisabled
          />
          <PropertyEditor
            name="Payload"
            value={thing.payload}
            id={`t-${thing.id}-payload`}
            isDisabled={isBusy}
            mutableValueInfo={{
              onValueChange: () => {
                if (isInvalid) {
                  setIsInvalid(false);
                }
              },
              onValueChangeSubmit: (newValue) => {
                if (!isBusy) {
                  setIsBusy(true);
                  return F.pipe(
                    TE.tryCatch(
                      async () =>
                        await backend.updateThing({
                          url: { id: thing.id },
                          body: { payload: newValue },
                        }),
                      E.toError,
                    ),
                    TE.chainW((r) => TE.fromEither(toEither(r))),
                    TE.bimap(
                      () => setIsInvalid(true),
                      (d) => updateThing(d),
                    ),
                    T.map(() => setIsBusy(false)),
                  );
                }
              },
            }}
          />
        </SimpleGrid>
      </Box>
      <Center>
        <IconButton
          aria-label={`Delete ${thing.id}`}
          isDisabled={isBusy}
          icon={<DeleteIcon />}
          onClick={() => {
            if (!isBusy) {
              setIsBusy(true);
              void F.pipe(
                TE.tryCatch(
                  async () =>
                    await backend.deleteThing({ url: { id: thing.id } }),
                  E.toError,
                ),
                TE.toUnion,
                T.map(() => removeThing(thing.id)),
              )();
            }
          }}
        />
      </Center>
    </Flex>
  );
};

const PropertyEditor = ({
  mutableValueInfo,
  ...props
}: {
  name: string;
  id: string;
  isDisabled: boolean;
  value: string;
  mutableValueInfo?: {
    onValueChangeSubmit: (newValue: string) => T.Task<unknown> | undefined;
    onValueChange: () => void;
  };
}) => {
  const [hasUpdated, setHasUpdated] = useState(false);
  const timeout = 1000;
  useEffect(() => {
    let timeoutId: number | undefined;
    if (hasUpdated) {
      timeoutId = window.setTimeout(() => {
        setHasUpdated(false);
      }, timeout);
    }
    return () => {
      if (timeoutId) {
        window.clearTimeout(timeoutId);
      }
    };
  }, [timeout, hasUpdated]);
  const { hasCopied, onCopy } = useClipboard(props.value);
  return (
    <>
      <Text as="label" justifySelf="end" htmlFor={props.id}>
        {props.name}
      </Text>
      <Tooltip
        isOpen={hasUpdated}
        label={"Value saved!"}
        placement="top"
        defaultIsOpen={false}
      >
        <InputGroup size="md" justifySelf="start">
          <Input
            disabled={!mutableValueInfo || props.isDisabled}
            id={props.id}
            pr="4.5rem"
            defaultValue={props.value}
            onChange={
              mutableValueInfo
                ? () => mutableValueInfo.onValueChange()
                : undefined
            }
            onBlur={
              mutableValueInfo
                ? (evt) => {
                    const newValue = evt.currentTarget.value;
                    if (newValue != props.value) {
                      const maybeTask =
                        mutableValueInfo.onValueChangeSubmit(newValue);
                      if (maybeTask) {
                        void F.pipe(
                          maybeTask,
                          T.map(() => {
                            setHasUpdated(true);
                          }),
                        )();
                      }
                    }
                  }
                : undefined
            }
            placeholder={mutableValueInfo ? props.name : undefined}
          />
          <InputRightElement width="4.5rem">
            <Tooltip
              label={hasCopied ? "Copied!" : "Copy to clipboard"}
              placement="right"
              closeOnClick={false}
              defaultIsOpen={false}
            >
              <IconButton
                h="1.75rem"
                size="sm"
                aria-label={`Copy value for "${props.name}".`}
                icon={<CopyIcon />}
                onClick={onCopy}
              />
            </Tooltip>
          </InputRightElement>
        </InputGroup>
      </Tooltip>
    </>
  );
};

export default ThingManager;
