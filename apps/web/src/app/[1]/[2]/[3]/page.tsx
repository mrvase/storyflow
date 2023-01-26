import { staticParams } from "../../../staticParams";

export { default } from "../page";

export async function generateStaticParams() {
  return staticParams(["priser", "test1", "test2"]);
}

export const dynamic = "force-static";
export const dynamicParams = false;
