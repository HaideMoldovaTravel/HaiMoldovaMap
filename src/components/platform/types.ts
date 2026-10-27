import type { ContentField, ContentValues } from "@/modules/catalog/schema";
export type ActorData = {
  id: string;
  name: string;
  email: string;
  role: string;
  emailVerified: boolean;
};
export type CategoryConfig = {
  id: string;
  name: string;
  nameEn: string;
  color: string;
  kind: string;
  active: boolean;
  order: number;
  description?: string;
  iconAssetId?: string | null;
  template: { id: string; version: number; fields: ContentField[] };
};
export type Item = {
  listing: {
    id: string;
    ownerId: string;
    kind: string;
    status: string;
    publishedRevisionId: string | null;
    demo: boolean;
  };
  revision: {
    id: string;
    listingId: string;
    categoryId: string;
    templateId: string;
    values: ContentValues;
    status: string;
    feedback: string | null;
    parentLocationId: string | null;
    createdAt: string;
  };
  authorName: string;
};
export type DashboardData = {
  actor: ActorData;
  config: CategoryConfig[];
  items: Item[];
  team: ActorData[];
  activity: {
    id: string;
    action: string;
    resourceId: string;
    createdAt: string;
  }[];
};
