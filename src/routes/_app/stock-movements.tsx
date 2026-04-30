import { createFileRoute } from "@tanstack/react-router";
import { Placeholder } from "./pos";
export const Route = createFileRoute("/_app/stock-movements")({
  component: () => <Placeholder title="حركات المخزون" round="الجولة 2" />,
});
