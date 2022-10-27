import create from "zustand";
import produce from "immer";
import type * as protocol from "../../protocol";
import type * as dataProtocol from "@ty-ras/protocol";

export const useState = create<ThingsState>((set) => ({
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
  resetThings: (things) => set({ things }),
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
