import create from "zustand";
import produce from "immer";
import type * as protocol from "../../protocol";
import type * as dataProtocol from "@ty-ras/protocol";

export const useState = create<ThingsState>((set, get) => ({
  things: undefined,
  addThing: (thing) =>
    set(
      produce<ThingsState>((draft) => {
        draft.things?.push(thing);
      }),
    ),
  removeThing: (id) =>
    set(
      produce<ThingsState>(({ things }) => {
        if (things) {
          const idx = things.findIndex((thing) => thing.id === id);
          if (idx >= 0) {
            things.splice(idx, 1);
          }
        }
      }),
    ),
  updateThing: (newThing) =>
    set(
      produce<ThingsState>(({ things }) => {
        if (things) {
          const idx = things.findIndex((thing) => thing.id === newThing.id);
          if (idx >= 0) {
            things[idx] = newThing;
          }
        }
      }),
    ),
  resetThings: (things) => {
    const currentThings = get().things;
    set({
      things:
        currentThings === undefined
          ? things
          : appendNewElements(currentThings, things, (t) => t.id),
    });
  },
}));

export interface ThingsState {
  // Mutable properties
  things: ReadonlyArray<Readonly<Thing>> | undefined;

  // Immutable actions
  addThing: (thing: Thing) => void;
  removeThing: (id: string) => void;
  updateThing: (newThing: Thing) => void;
  resetThings: (things: ReadonlyArray<Readonly<Thing>>) => void;
}

export type Thing = dataProtocol.RuntimeOf<protocol.data.things.Thing>;

/**
 * This function performs a least-modifying merge for two arrays of items which have some ID.
 * Neither of the arrays are modified, but instead a new array is returned.
 *
 * The order of the returned array is such that all non-removed elements are in same order as in `currentItems`.
 *
 * @param currentItems The pre-existing items.
 * @param seenItems The newly seen items.
 * @param getID The callback to get ID from item.
 */
const appendNewElements = <T>(
  currentItems: ReadonlyArray<T>,
  seenItems: ReadonlyArray<T>,
  getID: (item: T) => string,
) => {
  const dict = Object.fromEntries(
    seenItems.map((item) => [getID(item), item] as const),
  );
  let idx = 0;
  const newItems: Array<T> = [];
  while (idx < currentItems.length) {
    const currentItem = currentItems[idx];
    const id = getID(currentItem);
    if (id in dict) {
      delete dict[id];
      newItems.push(currentItem);
    } else {
      ++idx;
    }
  }
  newItems.push(...Object.values(dict));
  return newItems;
};
