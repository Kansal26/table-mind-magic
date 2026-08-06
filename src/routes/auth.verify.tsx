import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/auth/verify")({
  beforeLoad: () => {
    throw redirect({
      to: "/auth/login",
    });
  },
});