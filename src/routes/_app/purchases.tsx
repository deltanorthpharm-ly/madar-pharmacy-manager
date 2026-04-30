import { createFileRoute } from "@tanstack/react-router";
import { Placeholder } from "./pos";
export const Route = createFileRoute("/_app/purchases")({
  component: () => <Placeholder title="المشتريات" round="الجولة 4" />,
});
