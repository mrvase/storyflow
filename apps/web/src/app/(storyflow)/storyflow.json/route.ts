import { storyflowConfig } from "../../../storyflow.config";

export async function GET() {
  return new Response(JSON.stringify(storyflowConfig.public), {
    headers: {
      "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
      "Access-Control-Allow-Headers":
        "Origin, X-Requested-With, Content-Type, Accept, Authorization, Content-Encoding, X-Storyflow-Token",
      "Access-Control-Allow-Credentials": "true",
      "Access-Control-Allow-Origin": "*",
    },
  });
}
