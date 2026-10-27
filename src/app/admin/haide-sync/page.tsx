import { requireActor, requireAdmin } from "@/server/access";
import { haideSyncOverview } from "@/server/haide/sync";
import {
  HaideSyncPanel,
  type HaideOverview,
} from "@/components/admin/haide-sync";
export default async function Page() {
  requireAdmin(await requireActor(), true);
  return (
    <HaideSyncPanel
      initial={
        JSON.parse(JSON.stringify(await haideSyncOverview())) as HaideOverview
      }
    />
  );
}
