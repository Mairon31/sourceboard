import { DesignSystemDemo } from "../components/demo/DesignSystemDemo";

export function meta() {
  return [
    { title: "SourceBoard" },
    {
      name: "description",
      content: "SourceBoard helps communities find the public source or origin of images.",
    },
  ];
}

export default function IndexRoute() {
  return <DesignSystemDemo />;
}
