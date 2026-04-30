import { createFileRoute } from "@tanstack/react-router";
import { Placeholder } from "@/components/placeholder";
export const Route = createFileRoute("/_app/edit-log")({
  component: () => <Placeholder title="سجل التعديلات" round="الجولة 6" />,
});
