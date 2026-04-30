import { createFileRoute } from "@tanstack/react-router";
import { Placeholder } from "./pos";
export const Route = createFileRoute("/_app/edit-log")({
  component: () => <Placeholder title="سجل التعديلات" round="الجولة 6" />,
});
