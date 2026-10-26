import { handleContactRequest } from "@/lib/contact/handle-contact-request";

export async function POST(request: Request): Promise<Response> {
  return handleContactRequest(request);
}
