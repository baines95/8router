import CombosPageClient from "./CombosPageClient";
import { getCombos, getSettings, getProviderConnections } from "@/lib/localDb";
import { getMachineId } from "@/shared/utils/machine";

export default async function CombosPage() {
  const [combos, settings, connections, machineId] = await Promise.all([
    getCombos(),
    getSettings(),
    getProviderConnections(),
    getMachineId(),
  ]);

  const initialData = {
    combos,
    settings,
    connections,
    machineId,
  };

  return <CombosPageClient initialData={initialData} />;
}
