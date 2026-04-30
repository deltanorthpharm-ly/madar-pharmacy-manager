import { createFileRoute } from "@tanstack/react-router";
import { Placeholder } from "./pos";
export const Route = createFileRoute("/_app/inventory")({
  component: () => <Placeholder title="المخزون" round="الجولة 2" />,
});
