import create from "zustand";
import produce from "immer";
import type * as protocol from "../../protocol";
import type * as dataProtocol from "@ty-ras/protocol";

export const useState = create<ThingsState>((set, get) => ({
  thingsByID: undefined,
  addThing: (thing) => {
    const thingsByID = get().thingsByID;
    const existingThing = thingsByID?.[thing.id];
    const added = !existingThing;
    if (added) {
      set(
        produce<ThingsState>((draft) => {
          const draftThings = draft.thingsByID ?? {};
          draftThings[thing.id] = thing;
          draft.thingsByID = draftThings;
        }),
      );
    }
    return added;
  },
  removeThing: (thing) => {
    const thingsByID = get().thingsByID;
    const existingThing = thingsByID?.[thing.id];
    const removed =
      !!existingThing && existingThing.updated_at <= thing.updated_at;
    if (removed) {
      set(
        produce<ThingsState>(({ thingsByID }) => {
          if (thingsByID) {
            delete thingsByID[thing.id];
          }
        }),
      );
    }
    return removed;
  },
  updateThing: (thing) => {
    const thingsByID = get().thingsByID;
    const existingThing = thingsByID?.[thing.id];
    const updated =
      !!existingThing && existingThing.updated_at <= thing.updated_at;
    if (updated) {
      set(
        produce<ThingsState>(({ thingsByID }) => {
          if (thingsByID) {
            thingsByID[thing.id] = thing;
          }
        }),
      );
    }
    return updated;
  },
  resetThings: (things) => {
    const newThingsByID = Object.fromEntries(
      things.map((thing) => [thing.id, thing] as const),
    );
    set(
      produce<ThingsState>((draft) => {
        const thingsByID = draft.thingsByID;
        if (thingsByID) {
          resetByIDDictionary(
            newThingsByID,
            thingsByID,
            (thing) => thing.updated_at,
          );
        } else {
          draft.thingsByID = newThingsByID;
        }
      }),
    );
  },
}));

export interface ThingsState {
  // properties
  thingsByID: Readonly<Record<string, Thing>> | undefined;

  // Immutable actions
  addThing: (thing: Thing) => boolean;
  removeThing: (thing: Thing) => boolean;
  updateThing: (newThing: Thing) => boolean;
  resetThings: (things: ReadonlyArray<Readonly<Thing>>) => void;
}

export type Thing = dataProtocol.RuntimeOf<protocol.data.things.Thing>;

const resetByIDDictionary = <T>(
  newItems: Record<string, T>,
  currentItems: Record<string, T>,
  getUpdatedAt: (item: T) => Date,
) => {
  // Update existing, remove deleted
  for (const [id, thing] of Object.entries(currentItems)) {
    const newThing = newItems[id];
    if (newThing) {
      if (getUpdatedAt(newThing) > getUpdatedAt(thing)) {
        currentItems[id] = newThing;
      }
      delete newItems[id];
    } else {
      delete currentItems[id];
    }
  }
  // Add new
  for (const [id, newThing] of Object.entries(newItems)) {
    currentItems[id] = newThing;
  }
};

export const getSortedThings = (thingsByID: Record<string, Thing>) => {
  const values = Object.values(thingsByID);
  values.sort((x, y) => y.updated_at.valueOf() - x.updated_at.valueOf());
  return values;
};
