/* eslint-disable no-console */
import type * as config from "config";
import { resources } from "@ty-ras/backend-node-io-ts-openapi";
import pg from "pg";

export const createDBPool = ({
  dbName,
  role,
  username,
  ...database
}: config.Config["database"]) =>
  resources.createSimpleResourcePool({
    create: async () => {
      const client = new pg.Client({
        ...database,
        user: username,
        database: dbName,
      });
      await client.connect();
      console.info("Created connection");
      await client.query(`SET ROLE "${role}"`);
      return client;
    },
    destroy: async (client) => {
      console.info("Destroying connection");
      await client.end();
    },
  });
