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
    idleTimeBeforeEvict: 10 * 60 * 1000, // 10minutes
    resource: {
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
    },
  });
