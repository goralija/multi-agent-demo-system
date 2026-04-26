import { App } from "@/App";
import type { QueryClient } from "@tanstack/react-query";
import { Outlet, createRootRouteWithContext, createRoute } from "@tanstack/react-router";

interface RouterContext {
  queryClient: QueryClient;
}

const rootRoute = createRootRouteWithContext<RouterContext>()({
  component: () => <Outlet />,
});

const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/",
  component: App,
});

export const routeTree = rootRoute.addChildren([indexRoute]);
