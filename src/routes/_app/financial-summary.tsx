import { createFileRoute } from "@tanstack/react-router";
import { Placeholder } from "./pos";
export const Route = createFileRoute("/_app/financial-summary")({
  component: () => <Placeholder title="الملخص المالي" round="الجولة 8" />,
});
