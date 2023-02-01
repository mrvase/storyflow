import { Content } from "./Content";
import { Nav } from "./Nav";
import { createFullConfig } from "@storyflow/react/config";
import { Header } from "./Header/Header";
import util from "util";

export const [config, library, stories] = createFullConfig({
  name: "sf",
  label: "Storyflow",
  components: {
    Content,
    Header,
    Nav,
  },
});

/*
console.log(
  "CONFIG",
  util.inspect({ config, library, stories }, { colors: true, depth: null })
);
*/
