# Typesafe REST API Specification Sample - Backend & Frontend Monorepo

[![CI Pipeline](https://github.com/ty-ras/sample-be-fe-monorepo/actions/workflows/ci.yml/badge.svg)](https://github.com/ty-ras/sample-be-fe-monorepo/actions/workflows/ci.yml)

![Animation of Frontend Usage](https://raw.githubusercontent.com/ty-ras/sample-be-fe-monorepo/issue/2-add-crud/doc/fe-usage.gif)

The Typesafe REST API Specification (TyRAS) is a family of libraries used to enable seamless development of Backend and/or Frontend which communicate via HTTP protocol.
The protocol specification is checked both at compile-time and run-time to verify that communication indeed adhers to the protocol.
This all is done in such way that it does not make development tedious or boring, but instead robust and fun!

This particular repository contains sample setup on having backend and frontend in the same repo.
The synergies of agile development of communication protcol between backend and frontend are fully utilized, as both are written in TypeScript.
Having both in TypeScript is not a requirement to use TyRAS tho - the benefits related to compile- and runtime safety are obtained already when one of them is written in TypeScript and using TyRAS libraries.

# Running the Sample
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

At this point, open the browser and naviate to `http://localhost:4002` to try out the sample!
