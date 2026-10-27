"use client";
import { useState } from "react";
import type { AdminData } from "./types";
import { DataTable, PageTitle, dateTime } from "./shared";
const labels: Record<string, string> = {
  "draft.saved": "Ciornă salvată",
  "revision.submitted": "Propunere trimisă spre verificare",
  "revision.approved": "Conținut aprobat și publicat",
  "revision.changes": "Corectări solicitate",
  "revision.rejected": "Propunere respinsă",
  "listing.suspended": "Fișă retrasă de pe site",
  "listing.archive": "Fișă arhivată",
  "listing.restore": "Fișă restabilită",
  "category.saved": "Categorie actualizată",
  "template.published": "Versiune de formular publicată",
  "team.invited": "Invitație trimisă",
  "team.accepted": "Invitație acceptată",
  "team.revoked": "Acces administrativ revocat",
  "team.updated": "Membru al echipei actualizat",
  "invitation.resend": "Invitație retrimisă",
  "invitation.cancel": "Invitație anulată",
  "media.updated": "Fișier actualizat",
  "media.archived": "Fișier arhivat",
  "media.restored": "Fișier restabilit",
};
export const actionLabel = (action: string) => labels[action] ?? action;
export function ActivityPage({ data }: { data: AdminData }) {
  const [scope, setScope] = useState("");
  const events = data.events.filter(
    (e) => !scope || e.action.startsWith(scope),
  );
  return (
    <>
      <PageTitle
        title="Jurnal de activitate"
        description="Urmărește cine a schimbat conținutul, formularele și accesul în platformă."
      />
      <DataTable
        rows={events}
        rowKey={(e) => e.id}
        searchText={(e) =>
          `${actionLabel(e.action)} ${e.actorName} ${e.resourceId}`
        }
        searchPlaceholder="Caută o acțiune sau un membru…"
        exportName="activitate"
        filters={
          <select
            aria-label="Tip de activitate"
            value={scope}
            onChange={(e) => setScope(e.target.value)}
          >
            <option value="">Toate acțiunile</option>
            <option value="revision.">Moderare</option>
            <option value="category.">Categorii</option>
            <option value="template.">Formulare</option>
            <option value="team.">Echipă</option>
            <option value="media.">Media</option>
          </select>
        }
        columns={[
          {
            id: "action",
            label: "Acțiune",
            render: (e) => (
              <div className="ad-cell-title">
                <strong>{actionLabel(e.action)}</strong>
                <small>{e.action}</small>
              </div>
            ),
            sort: (e) => actionLabel(e.action),
          },
          {
            id: "author",
            label: "Autor",
            render: (e) => e.actorName ?? "Sistem",
            sort: (e) => e.actorName ?? "Sistem",
          },
          {
            id: "resource",
            label: "Resursă",
            render: (e) => (
              <span className="ad-resource-id" title={e.resourceId}>
                {e.resourceId}
              </span>
            ),
            sort: (e) => e.resourceId,
          },
          {
            id: "date",
            label: "Data și ora",
            render: (e) => dateTime(e.createdAt),
            sort: (e) => e.createdAt,
          },
        ]}
      />
    </>
  );
}
