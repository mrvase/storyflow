import { staticParams } from "../../../staticParams";

export { default } from "../page";

export async function generateStaticParams() {
  return await staticParams(3);
}

export const dynamic = "force-static";
export const dynamicParams = false;
