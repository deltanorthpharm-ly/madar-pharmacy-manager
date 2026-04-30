import { createFileRoute } from "@tanstack/react-router";
import { Placeholder } from "./pos";
export const Route = createFileRoute("/_app/products")({
  component: () => <Placeholder title="المنتجات" round="الجولة 2" />,
});
