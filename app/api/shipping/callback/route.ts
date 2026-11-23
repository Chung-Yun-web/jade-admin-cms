import { POST as logisticsCallbackPost } from "../logistics-callback/route";

export const revalidate = 0;

export async function POST(req: any) {
  return logisticsCallbackPost(req);
}
