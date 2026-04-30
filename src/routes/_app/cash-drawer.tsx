import { createFileRoute } from "@tanstack/react-router";
import { Placeholder } from "@/components/placeholder";
export const Route = createFileRoute("/_app/cash-drawer")({
  component: () => <Placeholder title="الخزنة" round="الجولة 5" />,
});
