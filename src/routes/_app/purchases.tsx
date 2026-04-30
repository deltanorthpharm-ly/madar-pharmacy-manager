import { createFileRoute } from "@tanstack/react-router";
import { Placeholder } from "@/components/placeholder";
export const Route = createFileRoute("/_app/purchases")({
  component: () => <Placeholder title="المشتريات" round="الجولة 4" />,
});
