import {
  function as F,
  option as O,
  array as A,
  either as E,
  task as T,
  taskEither as TE,
} from "fp-ts";
import * as common from "./common";

export interface ResourcePool<T> {
  acquire: () => Promise<T>;
  release: (resource: T) => Promise<void>;
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
    afterCreate: (resource: T) => Promise<void>;
    afterAcquire: (resource: T) => Promise<void>;
    afterRelease: (resource: T) => Promise<void>;
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
    shouldEvictionRun: false,
    resources: [],
  };
  const performEvict = F.flow(
    (resource: T) => TE.of(resource),
    // Side-effect: invoke beforeEvict and forget error
    TE.chainFirstW((r: T) =>
      asyncSideEffectIgnoreErrors(opts.inits?.beforeEvict, r),
    ),
    // Actual task: invoke destroy (and the caller will forget error)
    TE.chain((r) =>
      TE.tryCatch(async () => await opts.resource.destroy(r), E.toError),
    ),
  );
  const createResourceTask = poolCreateResource(opts, state, async () => {
    while (state.shouldEvictionRun) {
      await new Promise((resolve) =>
        setTimeout(resolve, opts.evictionCheckRunInterval),
      );
      // If someone changed state.shouldEvictionRun to true while awaiting, it would've also emptied the resource array.
      const now = Date.now();
      let x = 0;
      while (x < state.resources.length) {
        const returnedAt = state.resources[x].returnedAt;
        if (
          // Not currently in use
          returnedAt !== undefined &&
          // And been here for a while
          now - returnedAt > opts.evictAfterIdle
        ) {
          const [resourceToEvict] = state.resources.splice(x, 1);
          void performEvict(resourceToEvict.resource)();
        } else {
          ++x;
        }
      }
    }
  });
  // Notice that acquire functionality does *not* remove resources from state array!
  // That way we can close resources when needed even when they are borrowed
  const acquire = () =>
    F.pipe(
      state.resources,
      // Find resource which is not in use
      A.findFirst((r: Resource<T>) => r.returnedAt !== undefined),
      // If we succeed, mark it as being in use in a side effect (chainFirst)
      // The remaining statements will not use the value anymore, thus returning it directly
      O.chainFirst((r) => ((r.returnedAt = undefined), O.some(r))),
      O.map((r) => r.resource),
      E.fromOption(() => isRoomForResource(opts.maxCount, state.resources)),
      TE.fromEither,
      TE.mapLeft((hasRoom) =>
        hasRoom
          ? createResourceTask
          : TE.left(new Error("No more resource slots available in the pool")),
      ),
      TE.swap,
      TE.flattenW,
      TE.toUnion,
      T.map((r) =>
        r instanceof Error ? E.left<Error, T>(r) : E.right<Error, T>(r),
      ),
      TE.chainFirst((r) =>
        asyncSideEffectIgnoreErrors(opts.inits?.afterAcquire, r),
      ),
      TE.toUnion,
      // Throw the error if it is there
      T.map<Error | T, T>(common.throwIfError),
    );
  const release = F.flow(
    (resource: T) =>
      A.findFirst<Resource<T>>((r) => r.resource === resource)(state.resources),
    O.chainFirst((r) => ((r.returnedAt = Date.now()), O.some(r))),
    E.fromOption(() => new Error("Given resource was not part of this pool")),
    TE.fromEither,
    TE.chainFirst((r) =>
      asyncSideEffectIgnoreErrors(opts.inits?.afterRelease, r.resource),
    ),
    T.map(() => {}),
  );
  return {
    acquire: () => acquire()(),
    release: (resource) => release(resource)(),
  };
};

const defaultOptions = {
  minCount: 0,
  evictionCheckRunInterval: 1000,
};

interface ResourcePoolState<T> {
  shouldEvictionRun: boolean;
  resources: Array<Resource<T>>;
}

interface Resource<T> {
  resource: T;
  returnedAt: number | undefined; // undefined - currently in use. Otherwise timestamp in ms.
}

type InternalResourcePoolOptions<T> = typeof defaultOptions &
  ResourcePoolOptions<T>;

const isRoomForResource = (
  maxCount: number | undefined,
  array: Array<unknown>,
) => maxCount === undefined || array.length < maxCount;

const makeResource = <T>(resource: T): Resource<T> => ({
  resource,
  returnedAt: undefined,
});

const poolCreateResource = <T>(
  {
    maxCount,
    resource: { create, destroy },
    inits,
  }: InternalResourcePoolOptions<T>,
  state: ResourcePoolState<T>,
  runEviction: () => Promise<void>,
) =>
  F.pipe(
    // Invoke creation callback
    TE.tryCatch(async () => await create(), E.toError),
    // Invoke callback to initialize newly created resource
    // It is side-effect (we ignore return value), so use chainFirst
    TE.chainFirst((r) =>
      TE.tryCatch(async () => await inits?.afterCreate?.(r), E.toError),
    ),
    // On success, check again (since we async'ed) whether we have room for more
    // Again, this is side-effect, and thus using chainFirst
    TE.chainFirst((resource) =>
      isRoomForResource(maxCount, state.resources)
        ? // There is room -> add to array, and return it
          TE.of(F.pipe(makeResource(resource), (r) => state.resources.push(r)))
        : // There is no more room -> destroy resource, swallow error from destruction, and return error about no more resources
          TE.leftTask(
            F.pipe(
              TE.tryCatch(async () => destroy(resource), E.toError),
              TE.map(
                () => new Error("No more resource slots available in the pool"),
              ),
              TE.toUnion,
            ),
          ),
    ),
    // Start periodic eviction here as side-effect
    TE.chainFirst(() => {
      if (!state.shouldEvictionRun) {
        state.shouldEvictionRun = true;
        void runEviction();
      }
      return TE.of(undefined);
    }),
  );

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const asyncSideEffectIgnoreErrors = <TArgs extends Array<any>>(
  sideEffect: ((...args: TArgs) => Promise<void>) | undefined,
  ...args: TArgs
) =>
  F.pipe(
    TE.tryCatch(async () => await sideEffect?.(...args), E.toError),
    TE.toUnion,
    T.map(() => E.of<Error, string>("Lose error on purpose")),
  );
