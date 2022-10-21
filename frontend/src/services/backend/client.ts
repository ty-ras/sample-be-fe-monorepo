// TODO encapsulate this as separate TyRAS library
/* eslint-disable @typescript-eslint/restrict-template-expressions */
import * as feCommon from "@ty-ras/data-frontend";
import { Buffer } from "buffer";

export const createCallHTTPEndpoint =
  (schemeHostAndPort: string): feCommon.CallHTTPEndpoint =>
  async ({ headers, url, method, query, ...args }) => {
    const encoding = "utf8";
    const body =
      "body" in args
        ? Buffer.from(JSON.stringify(args.body), encoding)
        : undefined;

    const urlObject = new URL(`${schemeHostAndPort}${url}`);
    if (urlObject.pathname != url) {
      throw new Error(
        `Attempted to provide something else than pathname as URL: ${url}`,
      );
    }
    if (query) {
      urlObject.search = new URLSearchParams(
        Object.entries(query)
          .filter(([, value]) => value !== undefined)
          .flatMap<[string, string]>(([qKey, qValue]) =>
            Array.isArray(qValue)
              ? qValue.map<[string, string]>((value) => [qKey, `${value}`])
              : [[qKey, `${qValue}`]],
          ),
      ).toString();
    }
    const response = await fetch(urlObject, {
      method,
      body,
      headers: {
        // Notice that we allow overriding these specific headers with values in 'headers' below.
        // This is only because this callback is used in tests, and they require such functionality.
        // In reality, the spread of 'headers' should come first, and only then the headers related to body.
        // Even better, we should delete the reserved header names if body is not specified.
        ...(body === undefined
          ? {}
          : {
              ["Content-Type"]: "application/json",
              ["Content-Length"]: `${body.byteLength}`,
              ["Content-Encoding"]: encoding,
            }),
        ...headers,
      },
    });

    // Will throw (TODO verify this) on any response which code is not >= 200 and < 300.
    // So just verify that it is one of the OK or No Content.
    const { status, headers: responseHeaders } = response;
    if (status !== 200 && status !== 204) {
      throw new Error(`Status code ${status} was returned.`);
    }

    const bodyString = await response.text();
    return {
      body: bodyString.length > 0 ? JSON.parse(bodyString) : undefined,
      // TODO multiple entries with same header name!
      headers: Object.fromEntries(responseHeaders.entries()),
    };
  };
