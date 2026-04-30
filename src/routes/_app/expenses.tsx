import { createFileRoute } from "@tanstack/react-router";
import { Placeholder } from "./pos";
export const Route = createFileRoute("/_app/expenses")({
  component: () => <Placeholder title="المصاريف" round="الجولة 4" />,
});
