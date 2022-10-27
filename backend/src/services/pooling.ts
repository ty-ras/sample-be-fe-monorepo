import {
  function as F,
  option as O,
  array as A,
  readonlyArray as RA,
  either as E,
  task as T,
  taskEither as TE,
} from "fp-ts";

export interface ResourcePoolWithAdministration<T, TAcquireParameters> {
  pool: ResourcePool<T, TAcquireParameters>;
  administration: ResourcePoolAdministration<T>;
}
export interface ResourcePool<T, TAcquireParameters = void> {
  acquire: (parameters: TAcquireParameters) => TE.TaskEither<Error, T>;
  release: (client: T) => TE.TaskEither<Error, void>;
}

export interface ResourcePoolAdministration<T> {
  getMaxCount: () => number | undefined;
  getMinCount: () => number;
  getDefaultResourceIdleTime: () => number; // Milliseconds
  getCurrentResourceCount: () => number;
  runEviction: (
    resourceIdleTime?: ResourceIdleTimeCustomization<T>,
  ) => T.Task<EvictionResult>;
}

export interface ResourcePoolOptions<T> {
  minCount?: number; // Default 0
  maxCount?: number;
  idleTimeBeforeEvict: number; // Milliseconds
  resource: {
    create: () => Promise<T>;
    destroy: (resource: T) => Promise<void>;
  };
}

// Throws if max count constraint is violated
// Can build another pool on top of this, which would instead keep retrying until succeeding.
export const createSimpleResourcePool = <T>(opts: ResourcePoolOptions<T>) =>
  _createResourcePool(Object.assign({}, defaultOptions, opts));

const _createResourcePool = <T>({
  minCount,
  maxCount,
  idleTimeBeforeEvict,
  ...opts
}: InternalResourcePoolOptions<T>): ResourcePoolWithAdministration<T, void> => {
  const state: ResourcePoolState<T> = {
    resources: [],
    minCount,
    maxCount,
    idleTimeBeforeEvict,
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
            (len) => isRoomForResource(state.maxCount, len),
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
      // Map success (resource) to void
      TE.map(() => {}),
    );

  const runEviction = (resourceIdleTime?: ResourceIdleTimeCustomization<T>) => {
    const shouldEvict: ResourceIdleTimeCustomizationFunction<T> =
      resourceIdleTime === undefined
        ? ({ returnedAt, now }) => now - returnedAt > state.idleTimeBeforeEvict
        : typeof resourceIdleTime === "number"
        ? ({ returnedAt, now }) => now - returnedAt > resourceIdleTime
        : resourceIdleTime;
    return F.pipe(
      state.resources,
      A.reduceWithIndex<Resource<T> | undefined, EvictReduceState<T>>(
        { now: Date.now(), toBeEvicted: [], toBeRetained: [] },
        (idx, reduceState, r) => {
          if (
            idx >= state.minCount &&
            r &&
            r.returnedAt !== undefined &&
            shouldEvict({
              now: reduceState.now,
              returnedAt: r.returnedAt,
              resource: r.resource,
            })
          ) {
            reduceState.toBeEvicted.push(r.resource);
          } else {
            reduceState.toBeRetained.push(r);
          }
          return reduceState;
        },
      ),
      ({ toBeEvicted, toBeRetained }) => {
        state.resources = toBeRetained;
        return toBeEvicted;
      },
      T.traverseArray((resource) =>
        TE.tryCatch(
          async () => await opts.resource.destroy(resource),
          E.toError,
        ),
      ),
      T.map((results) => ({
        resourcesDeleted: results.length,
        errors: F.pipe(
          results,
          RA.filter(E.isLeft),
          RA.map((l) => l.left),
        ),
      })),
    );
  };

  return {
    pool: { acquire, release },
    administration: {
      getCurrentResourceCount: () => state.resources.length,
      getMinCount: () => state.minCount,
      getMaxCount: () => state.maxCount,
      getDefaultResourceIdleTime: () => state.idleTimeBeforeEvict,
      runEviction,
    },
  };
};

const defaultOptions = {
  minCount: 0,
  evictionCheckRunInterval: 1000,
};

interface ResourcePoolState<T> {
  resources: Array<Resource<T> | undefined>;
  minCount: number;
  maxCount: number | undefined;
  idleTimeBeforeEvict: number; // Milliseconds
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

interface EvictReduceState<T> {
  now: number;
  toBeEvicted: Array<T>;
  toBeRetained: Array<Resource<T> | undefined>;
}

export type ResourceIdleTimeCustomization<T> =
  | number
  | ResourceIdleTimeCustomizationFunction<T>;

export type ResourceIdleTimeCustomizationFunction<T> = (input: {
  returnedAt: number;
  now: number;
  resource: T;
}) => boolean;

export interface EvictionResult {
  resourcesDeleted: number;
  errors: ReadonlyArray<Error>;
}
