import { useEffect } from "react";
import { createRootRoute, HeadContent, Outlet } from "@tanstack/react-router";
import { AppProviders } from "@/components/providers";

export const Route = createRootRoute({
  component: RootComponent,
});

function RootComponent() {
  // A page restored from the back/forward cache can show a stale session. Reload it.
  useEffect(() => {
    const onShow = (event: PageTransitionEvent) => {
      if (event.persisted) window.location.reload();
    };
    window.addEventListener("pageshow", onShow);
    return () => window.removeEventListener("pageshow", onShow);
  }, []);
  return (
    <AppProviders>
      <HeadContent />
      <Outlet />
    </AppProviders>
  );
}
