import {
  Box,
  Button,
  Center,
  Flex,
  FormControl,
  FormLabel,
  HStack,
  IconButton,
  Input,
  SimpleGrid,
  Spinner,
  StackDivider,
  Text,
} from "@chakra-ui/react";
import { AddIcon, DeleteIcon, RepeatIcon } from "@chakra-ui/icons";
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
      loadingText={"Creating..."}
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
  const idID = `t-${thing.id}-id`;
  const payloadID = `t-${thing.id}-payload`;
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
          <Text as="label" justifySelf="end" htmlFor={idID}>
            ID
          </Text>
          <Input justifySelf="start" id={idID} disabled value={thing.id} />
          <Text as="label" justifySelf="end" htmlFor={payloadID}>
            Payload
          </Text>
          <Input
            justifySelf="start"
            id={payloadID}
            disabled={isBusy}
            defaultValue={thing.payload}
            onBlur={(evt) => {
              const newValue = evt.currentTarget.value;
              if (!isBusy && newValue !== thing.payload) {
                setIsBusy(true);
                void F.pipe(
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
                )();
              }
            }}
            onChange={() => {
              if (isInvalid) {
                setIsInvalid(false);
              }
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

export default ThingManager;
