import Header from "./Header";
import Content from "./Content";
import env from "./environment";
const App = () => (
  <>
    <Header />
    <Content
      apiDocs={{
        url: `${env.backend}/openapi`,
      }}
    />
  </>
);

export default App;
