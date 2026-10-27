import { notFound, redirect } from "next/navigation";
import { requireActor, requireAdmin, canConfigure } from "@/server/access";
import { adminData } from "@/server/admin";
import type { AdminData } from "@/components/admin/types";
import { CategoriesPage, CategoryForm } from "@/components/admin/categories";
import { FormBuilder } from "@/components/admin/form-builder";
import { TeamPage, InviteForm, MemberForm } from "@/components/admin/team";
import {
  ContentPage,
  ListingEditorPage,
  ListingDetail,
} from "@/components/admin/content";
import {
  FormsPage,
  MediaPage,
  MediaEdit,
  MediaUpload,
  UsersPage,
  UserEdit,
  SettingsPage,
} from "@/components/admin/resources";
import { ActivityPage } from "@/components/admin/activity";
import { latestItems } from "@/modules/catalog/admin-utils";
import {
  IntegrationForm,
  IntegrationsPage,
  type IntegrationRow,
  type IntegrationStat,
} from "@/components/admin/integrations";
import {
  TelegramPage,
  type TelegramOverview,
} from "@/components/admin/notifications";
import {
  excludableListings,
  integrationDetail,
  listIntegrations,
} from "@/server/integrations";
import { catalogConfig } from "@/server/catalog";
import { telegramOverview } from "@/server/telegram";
const plain = <T,>(value: unknown) => JSON.parse(JSON.stringify(value)) as T;
export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ section: string; segments?: string[] }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { section, segments = [] } = await params;
  const search = await searchParams;
  const query = (key: string) =>
    typeof search[key] === "string" ? (search[key] as string) : "";
  if (
    ![
      "content",
      "locations",
      "experiences",
      "moderation",
      "categories",
      "forms",
      "team",
      "media",
      "users",
      "activity",
      "settings",
      "integrations",
      "notifications",
    ].includes(section)
  )
    notFound();
  const actor = await requireActor();
  requireAdmin(actor);
  if (
    ["categories", "forms", "users", "integrations", "notifications"].includes(
      section,
    ) &&
    !canConfigure(actor)
  )
    redirect("/admin");
  if (section === "team" && actor.role !== "owner") redirect("/admin");
  if (section === "notifications" && !segments.length)
    return (
      <TelegramPage
        overview={plain<TelegramOverview>(await telegramOverview(actor))}
      />
    );
  if (section === "integrations") {
    const baseUrl = process.env.BETTER_AUTH_URL ?? "http://localhost:3000";
    if (!segments.length)
      return (
        <IntegrationsPage
          rows={plain(await listIntegrations(actor))}
          baseUrl={baseUrl}
        />
      );
    if (segments.length !== 1) notFound();
    const [config, listings] = await Promise.all([
      catalogConfig(true),
      excludableListings(),
    ]);
    const regions = [
      ...new Set(
        config.flatMap(
          (c) =>
            c.template?.fields.find((f) => f.id === "region")?.options ?? [],
        ),
      ),
    ];
    const shared = {
      categories: config.map((c) => ({
        id: c.id,
        name: c.name,
        kind: c.kind,
        active: c.active,
      })),
      regions,
      listings,
      baseUrl,
    };
    if (segments[0] === "add") return <IntegrationForm {...shared} />;
    const detail = await integrationDetail(actor, segments[0]);
    if (!detail) notFound();
    const integration = plain<IntegrationRow>(detail.integration);
    return (
      <IntegrationForm
        key={integration.version}
        {...shared}
        integration={integration}
        stats={plain<IntegrationStat[]>(detail.stats)}
        notice={
          query("created")
            ? "Integrarea a fost creată. Copiază codul iframe și trimite-l partenerului."
            : query("saved")
              ? "Salvat. Modificările apar pe site-ul partenerului în cel mult un minut."
              : query("rotated")
                ? "A fost generat un cod nou. Codul vechi nu mai funcționează."
                : ""
        }
      />
    );
  }
  const data = JSON.parse(JSON.stringify(await adminData(actor))) as AdminData;
  if (section === "categories") {
    if (!segments.length)
      return (
        <CategoriesPage
          key={query("saved")}
          data={data}
          saved={query("saved")}
        />
      );
    if (segments[0] === "add" && segments.length === 1)
      return (
        <CategoryForm
          data={data}
          copy={data.config.find((c) => c.id === query("copy"))}
        />
      );
    const category = data.config.find((c) => c.id === segments[0]);
    if (category && segments[1] === "edit" && segments.length === 2)
      return <CategoryForm data={data} category={category} />;
  }
  if (section === "forms") {
    if (!segments.length) return <FormsPage data={data} />;
    const category = data.config.find((c) => c.id === segments[0]);
    if (category && segments.length === 1)
      return (
        <FormBuilder
          key={category.id}
          category={category}
          created={query("created") === "1"}
        />
      );
  }
  if (section === "team") {
    if (!segments.length)
      return (
        <TeamPage
          key={query("tab")}
          data={data}
          invites={query("tab") === "invitations"}
        />
      );
    if (segments[0] === "invite" && segments.length === 1)
      return <InviteForm people={data.people} />;
    const person = data.people.find((p) => p.id === segments[0]);
    if (
      person &&
      person.role !== "owner" &&
      segments[1] === "edit" &&
      segments.length === 2
    )
      return <MemberForm person={person} />;
  }
  if (section === "content" && !segments.length)
    return (
      <ContentPage
        data={data}
        query={query("q")}
        category={query("category")}
        quality={query("quality")}
      />
    );
  if (section === "locations" || section === "experiences") {
    const kind = section === "experiences" ? "experience" : "location";
    if (!segments.length)
      return (
        <ContentPage
          data={data}
          kind={kind}
          query={query("q")}
          category={query("category")}
          quality={query("quality")}
        />
      );
    if (segments[0] === "add" && segments.length === 1)
      return <ListingEditorPage data={data} kind={kind} />;
    const item = latestItems(data).find(
      (i) => i.listing.id === segments[0] && i.listing.kind === kind,
    );
    if (item && segments.length === 1)
      return <ListingDetail data={data} item={item} />;
    if (item && segments[1] === "edit" && segments.length === 2)
      return <ListingEditorPage data={data} kind={kind} item={item} />;
  }
  if (section === "moderation") {
    if (!segments.length) return <ContentPage data={data} moderation />;
    const item = data.items.find((i) => i.revision.id === segments[0]);
    if (item && segments.length === 1)
      return <ListingDetail data={data} item={item} review />;
  }
  if (section === "media") {
    if (!segments.length) return <MediaPage data={data} />;
    if (segments[0] === "add" && segments.length === 1) {
      if (!canConfigure(actor)) redirect("/admin/media");
      return <MediaUpload />;
    }
    const file = data.media.find((f) => f.id === segments[0]);
    if (file && segments[1] === "edit" && segments.length === 2)
      return <MediaEdit data={data} file={file} />;
  }
  if (section === "users") {
    if (!segments.length) return <UsersPage data={data} />;
    const person = data.people.find((p) => p.id === segments[0]);
    if (person && segments[1] === "edit" && segments.length === 2)
      return <UserEdit data={data} person={person} />;
  }
  if (section === "activity" && !segments.length)
    return <ActivityPage data={data} />;
  if (section === "settings" && !segments.length)
    return <SettingsPage data={data} />;
  notFound();
}
