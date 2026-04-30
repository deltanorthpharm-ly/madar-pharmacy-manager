import { createFileRoute } from "@tanstack/react-router";
import { Placeholder } from "./pos";
export const Route = createFileRoute("/_app/rebuild")({
  component: () => <Placeholder title="إصلاح النظام (Rebuild Engine)" round="الجولة 7" />,
});
