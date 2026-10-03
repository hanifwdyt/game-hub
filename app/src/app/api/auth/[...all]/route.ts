import { toNextJsHandler } from "better-auth/next-js";
import { auth, authReady } from "@/lib/auth";

const h = toNextJsHandler(auth);
export const GET = async (req: Request) => { await authReady(); return h.GET(req); };
export const POST = async (req: Request) => { await authReady(); return h.POST(req); };
