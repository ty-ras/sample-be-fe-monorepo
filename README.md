# Typesafe REST API Specification Sample - Backend & Frontend Monorepo

[![CI Pipeline](https://github.com/ty-ras/sample-be-fe-monorepo/actions/workflows/ci.yml/badge.svg)](https://github.com/ty-ras/sample-be-fe-monorepo/actions/workflows/ci.yml)

![Animation of Protocol Change Cascade](https://raw.githubusercontent.com/ty-ras/sample-be-fe-monorepo/main/doc/protocol-usage.gif)

The Typesafe REST API Specification (TyRAS) is a family of libraries used to enable seamless development of Backend and/or Frontend which communicate via HTTP protocol.
The protocol specification is checked both at compile-time and run-time to verify that communication indeed adhers to the protocol.
This all is done in such way that it does not make development tedious or boring, but instead robust and fun!

This particular repository contains sample setup on having backend and frontend in the same repo.
The synergies of agile development of communication protcol between backend and frontend are fully utilized, as both are written in TypeScript.
Having both in TypeScript is not a requirement to use TyRAS tho - the benefits related to compile- and runtime safety are obtained already when one of them is written in TypeScript and using TyRAS libraries.

Furthermore, TyRAS can be used also for server-to-server scenarios, where there is no visible frontend to the user.
This sample contains the frontend only as an example.

# Running the Sample

![Animation of Frontend Usage](https://raw.githubusercontent.com/ty-ras/sample-be-fe-monorepo/main/doc/fe-usage.gif)

Navigate to this Git repo root in command line, and simply invoke `environment/start.sh`.
The environment requires Docker to be installed - no other tooling is necessary.
```sh
cd <this git root>
./environment/start.sh
```

If you're running on Windows (either Git Bash or WSL), add `--legacy-watch` as parameter.
```sh
cd <this git root>
./environment/start.sh --legacy-watch
```

The command will start a Docker Compose project, which consists of:
- Local AWS Cognito ["good enough" emulator](https://github.com/jagregory/cognito-local),
- [PostgreSQL](https://www.postgresql.org) database (see [migrations](./db/migrations)),
- The [backend component](./backend) of this sample, and
- The [frontend component](./frontend) of this sample.

Notice that the command will take care of installing all dependencies, building if necessary, running migrations, etc.

After short while, there will the following text:
```
tyras-be-and-fe-frontend-1   |
tyras-be-and-fe-frontend-1   |   VITE v3.1.8  ready in 4092 ms
tyras-be-and-fe-frontend-1   |
tyras-be-and-fe-frontend-1   |   ➜  Local:   http://localhost:4002/
tyras-be-and-fe-frontend-1   |   ➜  Network: http://172.25.0.2:4002/
tyras-be-and-fe-backend-1    | Server started
```

At this point, open the browser and navigate to `http://localhost:4002` to try out the sample!
Notice that the sample is stateless - when the docker compose project is shut down, all the data is gone from DB.

# Exploring the Code
At the heart of the sample is the [protocol specification](./protocol).
It contains one [TypeScript file](./protocol/src/protocol.d.ts), which fully specifies all the endpoints and their HTTP properties that are used for communicating between frontend and backend.
The protocol is about imaginary "things" which are stored in database, and can be managed by frontend UI.

This file is then copied by [script which starts development environment](./environment/start.sh) to both backend and frontend.
On any modification to this 'ground truth' file, the file will be again automatically copied to both backend and frontend for as long as development environment is up and running.

The [backend code](./backend) is a separate Node server application.
It demonstrates setting up [HTTP endpoints](./backend/src/api/endpoints) adhering to protocol specification, along with [HTTP-agnostic services](./backend/src/services/) to actually connect to database and execute commands.
The backend configuration is accessed from environment variable and code for it is in [config folder](./backend/src/config/).
This configuration is then used to [set up HTTP server](./backend/src/server/).

The [frontend code](./frontend/) is [Chakra UI](https://chakra-ui.com) [React](https://reactjs.org) app served by [Vite](https://vitejs.dev).
The backend calls are abstracted behind RPC-like interface, and authorization is a real JWT-token-based one that can be used also in cloud services.
The UI contains [header](./frontend/src/Header) and [content](./frontend/src/Content), where the content is split to [CRUD-manager for things](./frontend/src/Content/CRUD) and [Swagger UI component](./frontend/src/Content/APIDoc.tsx) to demonstrate how there is different OpenAPI definition visible depending on whether the user is authenticated or not.
The configuration for frontend is similarly obtained from environment variable and parsed in [config part](./frontend/src/config).
