export interface APIGetThings {
  method: "GET";
  responseBody: Array<DataThing>;
}

export interface DataThing {
  id: string;
}