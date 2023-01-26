import { staticParams } from "../staticParams";

export { default } from "../page";

export async function generateStaticParams() {
  return staticParams(["priser"]);
}

export const dynamic = "force-static";
export const dynamicParams = false;
