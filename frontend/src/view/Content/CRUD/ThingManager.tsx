/* eslint-disable @typescript-eslint/restrict-template-expressions */
import {
  Box,
  Center,
  Flex,
  HStack,
  IconButton,
  Input,
  InputGroup,
  InputRightElement,
  Popover,
  PopoverArrow,
  PopoverContent,
  PopoverTrigger,
  Portal,
  SimpleGrid,
  Spinner,
  StackDivider,
  Text,
  Tooltip,
  useClipboard,
} from "@chakra-ui/react";
import {
  AddIcon,
  CopyIcon,
  DeleteIcon,
  RepeatClockIcon,
  RepeatIcon,
} from "@chakra-ui/icons";
import * as tyras from "@ty-ras/frontend-fetch-io-ts";
import { useCallback, useEffect, useRef, useState } from "react";
import FocusLock from "react-focus-lock";
import { function as F, either as E, taskEither as TE } from "fp-ts";
import type * as protocol from "protocol";
import backend from "services/backend";
import * as task from "hooks/asyncFailableTask";
import * as state from "./state";

const ThingManager = () => {
  const things = state.useState((s) => s.thingsByID);
  return (
    <Box>
      <Flex direction="column">
        <Center flex={1}>
          <HStack divider={<StackDivider />}>
            <CreateThing />
            <RefreshThings />
            <RestoreThing />
          </HStack>
        </Center>
        {things === undefined ? (
          <Spinner />
        ) : (
          <Flex direction="column">
            {state.getSortedThings(things).map((thing) => (
              <Thing key={thing.id} thing={thing} />
            ))}
          </Flex>
        )}
      </Flex>
    </Box>
  );
};

const CreateThing = () => {
  const addThing = state.useState((s) => s.addThing);
  const { taskState, invokeTask } = task.useAsyncFailableTask(
    useCallback(
      () =>
        F.pipe(
          TE.tryCatch(
            async () =>
              await backend.createThing({
                body: { payload: "" },
              }),
            E.toError,
          ),
          TE.chainEitherKW(tyras.toEither),
          TE.map(addThing),
        ),
      [addThing],
    ),
  );
  task.logIfError(taskState);
  return (
    <Tooltip
      label={task.isInvoking(taskState) ? "Creating..." : "Create a new thing"}
      colorScheme={task.isError(taskState) ? "red" : undefined}
      placement="top"
      closeOnClick={false}
    >
      <IconButton
        icon={<AddIcon />}
        aria-label="Create a new thing"
        onClick={invokeTask}
      >
        Refresh all
      </IconButton>
    </Tooltip>
  );
};

const RefreshThings = () => {
  const resetThings = state.useState((s) => s.resetThings);
  const { taskState, invokeTask } = task.useAsyncFailableTask(
    useCallback(
      () =>
        F.pipe(
          TE.tryCatch(async () => await backend.getThings(), E.toError),
          TE.chainEitherKW(tyras.toEither),
          TE.map(resetThings),
        ),
      [resetThings],
    ),
  );
  task.logIfError(taskState);
  useEffect(() => {
    if (task.isInitial(taskState)) {
      invokeTask();
    }
  }, [taskState, invokeTask]);
  return (
    <Tooltip
      label={
        task.isInvoking(taskState)
          ? "Refreshing..."
          : "Refresh all things from backend"
      }
      colorScheme={task.isError(taskState) ? "red" : undefined}
      placement="top"
      closeOnClick={false}
    >
      <IconButton
        icon={<RepeatIcon />}
        aria-label="Refresh all things from backend"
        onClick={invokeTask}
      >
        Refresh all
      </IconButton>
    </Tooltip>
  );
};

const RestoreThing = () => {
  const fieldRef = useRef(null);
  const addThing = state.useState((s) => s.addThing);
  const { taskState, invokeTask } = task.useAsyncFailableTask(
    useCallback(
      (id: string) => {
        if (id.length > 0) {
          return F.pipe(
            TE.tryCatch(
              async () => backend.restoreThing({ url: { id } }),
              E.toError,
            ),
            TE.chainEitherKW(tyras.toEither),
            TE.map(addThing),
          );
        }
      },
      [addThing],
    ),
  );
  task.logIfError(taskState);
  return (
    <Popover placement="right" initialFocusRef={fieldRef}>
      <Tooltip
        label={
          task.isInvoking(taskState)
            ? "Restoring..."
            : "Restore thing with given ID"
        }
        colorScheme={task.isError(taskState) ? "red" : undefined}
        placement="top"
        closeOnClick={false}
      >
        <Box display="inline-block">
          <PopoverTrigger>
            <IconButton
              icon={<RepeatClockIcon />}
              aria-label="Restore thing with given ID"
              colorScheme={task.isError(taskState) ? "red" : undefined}
            >
              Restore
            </IconButton>
          </PopoverTrigger>
        </Box>
      </Tooltip>
      <Portal>
        <PopoverContent>
          <FocusLock returnFocus persistentFocus={false}>
            <PopoverArrow />
            <Input
              placeholder="Thing ID"
              ref={fieldRef}
              onBlur={(evt) => {
                const id = evt.currentTarget.value;
                evt.currentTarget.value = "";
                invokeTask(id);
              }}
            />
          </FocusLock>
        </PopoverContent>
      </Portal>
    </Popover>
  );
};

const Thing = ({
  thing: { id, ...thing },
}: {
  thing: tyras.RuntimeOf<protocol.data.things.Thing>;
}) => {
  const removeThing = state.useState((s) => s.removeThing);
  const updateThing = state.useState((s) => s.updateThing);
  const { taskState: refreshTaskState, invokeTask: invokeRefreshTask } =
    task.useAsyncFailableTask(
      useCallback(
        (isBusy: boolean) => {
          if (!isBusy) {
            return F.pipe(
              TE.tryCatch(
                async () => await backend.readThing({ url: { id } }),
                E.toError,
              ),
              TE.chainEitherKW(tyras.toEither),
              TE.map(updateThing),
              TE.map(() => setIsInvalid(false)),
            );
          }
        },
        [id, updateThing],
      ),
    );
  const { taskState: deleteTaskState, invokeTask: invokeDeleteTask } =
    task.useAsyncFailableTask(
      useCallback(
        (isBusy: boolean) => {
          if (!isBusy) {
            return F.pipe(
              TE.tryCatch(
                async () => await backend.deleteThing({ url: { id } }),
                E.toError,
              ),
              TE.chainEitherKW(tyras.toEither),
              TE.map(removeThing),
              TE.map(() => setIsInvalid(false)),
            );
          }
        },
        [id, removeThing],
      ),
    );
  const { taskState: updateTaskState, invokeTask: invokeUpdateTask } =
    task.useAsyncFailableTask(
      useCallback(
        (isBusy: boolean, payload: string) => {
          if (!isBusy) {
            return F.pipe(
              TE.tryCatch(
                async () =>
                  await backend.updateThing({
                    url: { id },
                    body: { payload },
                  }),
                E.toError,
              ),
              TE.chainEitherKW(tyras.toEither),
              TE.map(updateThing),
              TE.map(() => setIsInvalid(false)),
            );
          }
        },
        [id, updateThing],
      ),
    );
  task.logIfError(refreshTaskState);
  task.logIfError(deleteTaskState);
  task.logIfError(updateTaskState);
  const isBusy =
    task.isInvoking(refreshTaskState) ||
    task.isInvoking(deleteTaskState) ||
    task.isInvoking(updateTaskState);
  const [isInvalid, setIsInvalid] = useState(false);
  return (
    <Flex direction="row" p={2}>
      <Center>
        <Tooltip
          label={
            task.isInvoking(deleteTaskState)
              ? "Refreshing..."
              : "Refresh contents of this thing"
          }
          colorScheme={task.isError(deleteTaskState) ? "red" : undefined}
          placement="left"
          closeOnClick={false}
        >
          <IconButton
            aria-label={`Refresh thing ${id}`}
            icon={<RepeatIcon />}
            isDisabled={isBusy}
            onClick={() => invokeRefreshTask(isBusy)}
          />
        </Tooltip>
      </Center>
      <Box flex={1}>
        <SimpleGrid
          templateColumns="minmax(20px, auto) 1fr;"
          gap="0.5em"
          alignItems="center"
        >
          <PropertyEditor name="ID" value={id} id={`t-${id}-id`} isDisabled />
          <PropertyEditor
            name="Payload"
            value={thing.payload}
            id={`t-${id}-payload`}
            isDisabled={isBusy}
            mutableValueInfo={{
              onValueChange: () => {
                if (isInvalid) {
                  setIsInvalid(false);
                }
              },
              onValueChangeSubmit: (payload) =>
                invokeUpdateTask(isBusy, payload),
              updateTaskState: updateTaskState,
            }}
          />
        </SimpleGrid>
      </Box>
      <Center>
        <Tooltip
          label={
            task.isInvoking(deleteTaskState)
              ? "Deleting..."
              : "Delete this thing"
          }
          colorScheme={task.isError(deleteTaskState) ? "red" : undefined}
          placement="right"
          closeOnClick={false}
        >
          <IconButton
            aria-label={`Delete ${id}`}
            isDisabled={isBusy}
            icon={<DeleteIcon />}
            colorScheme="red"
            onClick={() => invokeDeleteTask(isBusy)}
          />
        </Tooltip>
      </Center>
    </Flex>
  );
};

const PropertyEditor = <E, T>({
  mutableValueInfo,
  ...props
}: {
  name: string;
  id: string;
  isDisabled: boolean;
  value: string;
  mutableValueInfo?: {
    updateTaskState: task.TaskInvocationState<E, T>;
    onValueChangeSubmit: (newValue: string) => unknown;
    onValueChange: () => void;
  };
}) => {
  const { shouldShow: hasUpdated, hasShown: clearHasUpdated } =
    task.useTaskStatusIndicator(
      !!mutableValueInfo &&
        (task.isSuccess(mutableValueInfo.updateTaskState) ||
          task.isError(mutableValueInfo.updateTaskState)),
    );
  const timeout = 1000;
  useEffect(() => {
    let timeoutId: number | undefined;
    if (hasUpdated) {
      timeoutId = window.setTimeout(() => {
        clearHasUpdated();
      }, timeout);
    }
    return () => {
      if (timeoutId) {
        window.clearTimeout(timeoutId);
      }
    };
  }, [timeout, hasUpdated, clearHasUpdated]);
  const { hasCopied, onCopy } = useClipboard(props.value);
  return (
    <>
      <Text as="label" justifySelf="end" htmlFor={props.id}>
        {props.name}
      </Text>
      <Tooltip
        isOpen={hasUpdated}
        label={
          !!mutableValueInfo && task.isError(mutableValueInfo.updateTaskState)
            ? "Error when saving value!"
            : "Value saved successfully"
        }
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
                      mutableValueInfo.onValueChangeSubmit(newValue);
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
