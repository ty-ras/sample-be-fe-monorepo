import { Box } from "@chakra-ui/react";
import APIDoc, { APIDocProperties } from "./APIDoc";

const Content = ({ apiDocs }: ContentProps) => (
  <Box>
    <APIDoc {...apiDocs} />
  </Box>
);

export interface ContentProps {
  apiDocs: APIDocProperties;
}

export default Content;
