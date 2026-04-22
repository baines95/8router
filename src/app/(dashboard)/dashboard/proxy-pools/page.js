import ProxyPoolsPageClient from "./ProxyPoolsPageClient";
import { getProxyPools, getSettings } from "@/lib/localDb";
import { getMachineId } from "@/shared/utils/machine";

export default async function ProxyPoolsPage() {
  const [proxyPools, settings, machineId] = await Promise.all([
    getProxyPools({ includeUsage: true }),
    getSettings(),
    getMachineId(),
  ]);

  const initialData = {
    proxyPools,
    settings,
    machineId,
  };

  return <ProxyPoolsPageClient initialData={initialData} />;
}
