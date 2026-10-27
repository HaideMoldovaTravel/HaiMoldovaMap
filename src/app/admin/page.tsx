import { requireActor } from "@/server/access";
import { adminData } from "@/server/admin";
import { Overview } from "@/components/admin/overview";
import type { AdminData } from "@/components/admin/types";
export default async function Page() {
  return (
    <Overview
      data={
        JSON.parse(
          JSON.stringify(await adminData(await requireActor())),
        ) as AdminData
      }
    />
  );
}
