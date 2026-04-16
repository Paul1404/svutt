import { api } from "@/lib/api/app";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const handler = (req: Request) => api.fetch(req);

export { handler as GET, handler as POST, handler as PATCH, handler as PUT, handler as DELETE };
