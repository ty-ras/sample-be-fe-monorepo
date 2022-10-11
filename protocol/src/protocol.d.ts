export interface APIGetThings {
  method: "GET";
  responseBody: Array<DataThing>;
  // Header *functionality* - not the header data content validation
  headers: {
    // Require functionality "auth" using HTTP header "Authorization"
    // The header value will not be visible at runtime to BE handler, instead the state will be required to be of type { username: string } for the "auth" functionality.
    Authorization: "auth";
  };
}

export interface DataThing {
  id: string;
}
