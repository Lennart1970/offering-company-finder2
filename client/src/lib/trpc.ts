import { createTRPCReact } from "@trpc/react-query";
import type { inferRouterInputs } from "@trpc/server";
import type { AppRouter } from "../../../server/routers";

export const trpc = createTRPCReact<AppRouter>();
export type RouterInputs = inferRouterInputs<AppRouter>;
