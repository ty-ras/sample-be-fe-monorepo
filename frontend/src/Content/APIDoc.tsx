import SwaggerUI from "swagger-ui-react";
import "swagger-ui-react/swagger-ui.css";
import * as user from "../services/user";

const APIDoc = ({ url }: APIDocProperties) => {
  // Have this in order to re-render on login/logout
  // This is because the resulting OpenAPI document will be different for logged-in user.
  user.useUserStore((user) => user.username);
  // TODO instead of providing URL, fetch the document using TyRAS libs.
  return <SwaggerUI url={url} />;
};
export interface APIDocProperties {
  url: string;
}

export default APIDoc;
