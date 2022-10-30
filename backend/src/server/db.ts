/* eslint-disable no-console */
import type * as config from "../config";
import * as pooling from "@ty-ras/resource-pool-fp-ts";
import pg from "pg";

export const createDBPool = ({
  dbName,
  role,
  username,
  ...database
}: config.Config["database"]) =>
  pooling.createSimpleResourcePool({
    create: async () => {
      const client = new pg.Client({
        ...database,
        user: username,
        database: dbName,
      });
      await client.connect();
      console.log("Created connection");
      await client.query(`SET ROLE "${role}"`);
      return client;
    },
    destroy: async (client) => {
      console.log("Destroying connection");
      await client.end();
    },
  });
