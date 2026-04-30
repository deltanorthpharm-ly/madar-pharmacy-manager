import { createFileRoute } from "@tanstack/react-router";
import { Placeholder } from "./pos";
export const Route = createFileRoute("/_app/customers")({
  component: () => <Placeholder title="العملاء" round="الجولة 4" />,
});
