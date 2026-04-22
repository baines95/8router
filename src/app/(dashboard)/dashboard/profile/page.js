import ProfilePageClient from "./ProfilePageClient";
import { getSettings } from "@/lib/localDb";
import { getMachineId } from "@/shared/utils/machine";

export default async function ProfilePage() {
  const [settings, machineId] = await Promise.all([
    getSettings(),
    getMachineId(),
  ]);

  const initialData = {
    settings,
    machineId,
  };

  return <ProfilePageClient initialData={initialData} />;
}
