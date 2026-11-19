import { ENTITIES } from "../lib/entities";
import { useEnsTexts } from "../lib/ens";
import StructureContent from "../components/StructureContent";

export default function Structure() {
  const names = ENTITIES.filter((e) => e.kind === "treasury")
    .map((e) => e.ens).filter((name): name is string => !!name);
  const { data: texts } = useEnsTexts(names);
  return <StructureContent texts={texts} />;
}
