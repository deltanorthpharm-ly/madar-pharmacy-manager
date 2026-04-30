import { createFileRoute } from "@tanstack/react-router";
import { Placeholder } from "@/components/placeholder";
export const Route = createFileRoute("/_app/suppliers")({
  component: () => <Placeholder title="الموردين" round="الجولة 4" />,
});
