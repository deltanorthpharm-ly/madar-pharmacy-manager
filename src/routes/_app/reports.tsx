import { createFileRoute } from "@tanstack/react-router";
import { Placeholder } from "./pos";
export const Route = createFileRoute("/_app/reports")({
  component: () => <Placeholder title="التقارير" round="الجولة 8" />,
});
