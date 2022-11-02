import create from "zustand";
import produce from "immer";
import type * as protocol from "../../../protocol";
import type * as dataProtocol from "@ty-ras/protocol";

export const useState = create<ThingsState>((set, get) => ({
  thingsByID: undefined,
  addThing: (thing) => {
    const thingsByID = get().thingsByID;
    const existingThing = thingsByID?.get(thing.id);
    const added = !existingThing;
    if (added) {
      set(
        produce<ThingsState>((draft) => {
          const draftThings = draft.thingsByID ?? new Map();
          draftThings.set(thing.id, thing);
          draft.thingsByID = draftThings;
        }),
      );
    }
    return added;
  },
  removeThing: (thing) => {
    const thingsByID = get().thingsByID;
    const existingThing = thingsByID?.get(thing.id);
    const removed =
      !!existingThing && existingThing.updated_at <= thing.updated_at;
    if (removed) {
      set(
        produce<ThingsState>(({ thingsByID }) => {
          if (thingsByID) {
            thingsByID.delete(thing.id);
          }
        }),
      );
    }
    return removed;
  },
  updateThing: (thing) => {
    const thingsByID = get().thingsByID;
    const existingThing = thingsByID?.get(thing.id);
    const updated =
      !!existingThing && existingThing.updated_at <= thing.updated_at;
    if (updated) {
      set(
        produce<ThingsState>(({ thingsByID }) => {
          if (thingsByID) {
            thingsByID.set(thing.id, thing);
          }
        }),
      );
    }
    return updated;
  },
  resetThings: (things) => {
    const newThingsByID = new Map(
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
  thingsByID: Map<string, Thing> | undefined;

  // Immutable actions
  addThing: (thing: Thing) => boolean;
  removeThing: (thing: Thing) => boolean;
  updateThing: (newThing: Thing) => boolean;
  resetThings: (things: ReadonlyArray<Readonly<Thing>>) => void;
}

export type Thing = dataProtocol.RuntimeOf<protocol.data.things.Thing>;

const resetByIDDictionary = <T>(
  newItems: Map<string, T>,
  currentItems: Map<string, T>,
  getUpdatedAt: (item: T) => Date,
) => {
  // Update existing, remove deleted
  const deletableCurrentItemIDs: Array<string> = [];
  for (const [id, thing] of currentItems) {
    const newThing = newItems.get(id);
    if (newThing) {
      if (getUpdatedAt(newThing) > getUpdatedAt(thing)) {
        currentItems.set(id, newThing);
      }
      newItems.delete(id);
    } else {
      deletableCurrentItemIDs.push(id);
    }
  }
  deletableCurrentItemIDs.forEach((deletableCurrentItemID) =>
    currentItems.delete(deletableCurrentItemID),
  );
  // Add new
  newItems.forEach((newThing, id) => currentItems.set(id, newThing));
};

export const getSortedThings = (thingsByID: Map<string, Thing>) => {
  const values = Array.from(thingsByID.values());
  values.sort((x, y) => y.updated_at.valueOf() - x.updated_at.valueOf());
  return values;
};
