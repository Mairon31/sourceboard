import { data, type MetaFunction } from "react-router";
import { NotFoundPage } from "../components/product/NotFoundPage";

export function loader() {
  return data(null, { status: 404 });
}

export const meta: MetaFunction = () => [
  { title: "Page not found · SourceBoard" },
  { name: "robots", content: "noindex, nofollow" },
];

export default function NotFoundRoute() {
  return <NotFoundPage />;
}
