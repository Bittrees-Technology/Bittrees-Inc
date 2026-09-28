import { useLocation } from "react-router";
import { useRouteMeta } from "../lib/routeMeta";
import { routeSeo } from "../lib/seo";
export default function PageMeta() {
  const { pathname } = useLocation();
  useRouteMeta(routeSeo(pathname));
  return null;
}
