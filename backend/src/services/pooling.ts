import {
  function as F,
  option as O,
  array as A,
  either as E,
  task as T,
  taskEither as TE,
} from "fp-ts";

export interface ResourcePool<T> {
  acquire: () => TE.TaskEither<Error, T>;
  release: (client: T) => TE.TaskEither<Error, void>;
}

export interface ResourcePoolOptions<T> {
  minCount?: number; // Default 0
  maxCount?: number;
  evictionCheckRunInterval?: number; // Milliseconds, default 1000
  evictAfterIdle: number; // Milliseconds
  resource: {
    create: () => Promise<T>;
    destroy: (resource: T) => Promise<void>;
  };
  inits?: Partial<{
    // Errors from these will flow thru acquire/release methods!
    afterCreate: (resource: T) => Promise<void>;
    afterAcquire: (resource: T) => Promise<void>;
    afterRelease: (resource: T) => Promise<void>;
    // Errors from this one will be silently ignored
    beforeEvict: (resource: T) => Promise<void>;
  }>;
}

// Throws if max count constraint is violated
// Can build another pool on top of this, which would instead keep retrying until succeeding.
export const createSimpleResourcePool = <T>(opts: ResourcePoolOptions<T>) =>
  _createResourcePool(Object.assign({}, defaultOptions, opts));

const _createResourcePool = <T>(
  opts: InternalResourcePoolOptions<T>,
): ResourcePool<T> => {
  const state: ResourcePoolState<T> = {
    resources: [],
  };
  const performEvict = F.flow(
    (resource: T) =>
      asyncSideEffectIgnoreErrors(opts.inits?.beforeEvict, resource),
    TE.chain(([r]) =>
      TE.tryCatch(async () => await opts.resource.destroy(r), E.toError),
    ),
  );
  const runEviction = async () => {
    while (state.resources.length > 0) {
      await new Promise((resolve) =>
        setTimeout(resolve, opts.evictionCheckRunInterval),
      );
      const now = Date.now();
      let x = 0;
      while (x < state.resources.length) {
        const item = state.resources[x];
        if (
          item &&
          // Not currently in use
          item.returnedAt !== undefined &&
          // And been here for a while
          now - item.returnedAt > opts.evictAfterIdle
        ) {
          state.resources.splice(x, 1);
          void performEvict(item.resource)();
        } else {
          ++x;
        }
      }
    }
  };
  const acquire = () =>
    F.pipe(
      state.resources,
      // Find first free resource (and map from "Resource<T> | undefined" to "Resource<T>")
      A.findFirstMap((r) =>
        r && r.returnedAt !== undefined ? O.some(r) : O.none,
      ),
      // If found, then mark as reserved
      O.chainFirst((r) => ((r.returnedAt = undefined), O.some("ignored"))),
      O.getOrElseW(() =>
        // If not found, then start process of creating new one
        F.pipe(
          state.resources.length,
          E.fromPredicate(
            (len) => isRoomForResource(opts.maxCount, len),
            () => new Error("No more resource slots available in the pool"),
          ),
          // Before doing async, mark that we are reserved this array slot for future use
          E.chainFirst((idx) => E.of((state.resources[idx] = undefined))),
          TE.fromEither,
          // Acquire resource by calling callback
          TE.chainW((idx) =>
            TE.tryCatch(
              async () => ({ idx, resource: await opts.resource.create() }),
              (error) => ({ error: E.toError(error), idx }),
            ),
          ),
          // Notify about creation
          TE.chainW((idxAndResource) =>
            TE.tryCatch(
              async () => (
                await opts.inits?.afterCreate?.(idxAndResource.resource),
                idxAndResource
              ),
              (error) => ({ error: E.toError(error), idx: idxAndResource.idx }),
            ),
          ),
          // Perform cleanup and extract resource
          TE.bimap(
            (err) => {
              // We have errored -> clean up reserved slot if needed
              const isError = err instanceof Error;
              if (!isError) {
                state.resources.splice(err.idx, 1);
              }
              // Return Error object
              return isError ? err : err.error;
            },
            ({ idx, resource }) => {
              // We have succeeded -> save the result
              state.resources[idx] = new Resource(resource);
              // Start eviction process if this was first resource
              if (idx === 0) {
                void runEviction();
              }
              // Return the resource
              return resource;
            },
          ),
        ),
      ),
      // Lift sync version to async
      (resourceOrTask) =>
        resourceOrTask instanceof Resource
          ? TE.of<Error, T>(resourceOrTask.resource)
          : resourceOrTask,
      // Finally remember to notify about acquirement
      TE.chainFirst((r) =>
        TE.tryCatch(async () => await opts.inits?.afterAcquire?.(r), E.toError),
      ),
    );
  const release = (resource: T) =>
    F.pipe(
      state.resources,
      // Find the resource from state
      A.findFirstMap((r) =>
        r && r.resource === resource ? O.some(r) : O.none,
      ),
      // Create error if not found
      E.fromOption(() => new Error("Given resource was not part of this pool")),
      // Remember when it was returned
      E.chainFirst((r) => ((r.returnedAt = Date.now()), E.right("ignored"))),
      TE.fromEither,
      // Notify about release
      TE.chain((r) =>
        TE.tryCatch(
          async () => opts.inits?.afterRelease?.(r.resource),
          E.toError,
        ),
      ),
      // Map success (resource) to void
      TE.map(() => {}),
    );
  return { acquire, release };
};

const defaultOptions = {
  minCount: 0,
  evictionCheckRunInterval: 1000,
};

interface ResourcePoolState<T> {
  resources: Array<Resource<T> | undefined>;
}

class Resource<T> {
  public constructor(
    public readonly resource: T,
    public returnedAt: number | undefined = undefined, // undefined - currently in use. Otherwise timestamp in ms.
  ) {}
}

type InternalResourcePoolOptions<T> = typeof defaultOptions &
  ResourcePoolOptions<T>;
const isRoomForResource = (maxCount: number | undefined, arrayLength: number) =>
  maxCount === undefined || arrayLength < maxCount;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const asyncSideEffectIgnoreErrors = <TArgs extends Array<any>>(
  sideEffect: ((...args: TArgs) => Promise<void>) | undefined,
  ...args: TArgs
) =>
  F.pipe(
    TE.tryCatch(async () => await sideEffect?.(...args), E.toError),
    TE.toUnion,
    T.map(() => E.of<Error, TArgs>(args)),
  );
