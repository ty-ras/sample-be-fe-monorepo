/* eslint-disable no-console */
import type * as config from "../config";
import * as services from "../services";
import pg from "pg";

export const createDBPool = ({
  dbName,
  role,
  username,
  ...database
}: config.Config["database"]) =>
  services.createSimpleResourcePool({
    evictAfterIdle: 10 * 60 * 1000, // 10minutes
    resource: {
      create: async () => {
        const client = new pg.Client({
          ...database,
          user: username,
          database: dbName,
        });
        await client.connect();
        return client;
      },
      destroy: (client) => client.end(),
    },
    inits: {
      afterCreate: async (client) => {
        await client.query(`SET ROLE "${role}"`);
      },
      afterAcquire: () => {
        console.log("Acquired connection");
        return Promise.resolve();
      },
      afterRelease: () => {
        console.log("Released connection");
        return Promise.resolve();
      },
      beforeEvict: () => {
        console.log("Evicting connection");
        return Promise.resolve();
      },
    },
  });
