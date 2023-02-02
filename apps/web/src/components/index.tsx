import { Content } from "./Content";
import { Nav } from "./Nav";
import { createFullConfig } from "@storyflow/react/config";
import { Header } from "./Header/Header";
import { Link } from "./Link";

export const [config, library, stories] = createFullConfig({
  name: "sf",
  label: "Storyflow",
  components: {
    Content,
    Header,
    Nav,
    Link,
  },
});

/*
console.log(
  "CONFIG",
  util.inspect({ config, library, stories }, { colors: true, depth: null })
);
*/
