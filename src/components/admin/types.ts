import type { DashboardData } from "@/components/platform/types";
import type { ContentField } from "@/modules/catalog/schema";
export type AdminData = DashboardData & {
  versions: {
    id: string;
    categoryId: string;
    version: number;
    fields: ContentField[];
    createdAt: string;
  }[];
  media: {
    id: string;
    ownerId: string;
    filename: string;
    purpose: string;
    size: number;
    altText: string;
    archivedAt: string | null;
    createdAt: string;
    ownerName: string;
    references: { id: string; name: string; kind: string }[];
    categoryName: string | null;
    used: boolean;
  }[];
  people: (DashboardData["actor"] & {
    createdAt: string;
    lastSeen: string | null;
  })[];
  invitations: {
    id: string;
    email: string;
    role: string;
    invitedBy: string;
    createdAt: string;
    expiresAt: string;
    acceptedAt: string | null;
    revokedAt: string | null;
  }[];
  events: {
    id: string;
    action: string;
    resourceId: string;
    actorName: string | null;
    createdAt: string;
  }[];
  delivery: { status: string; count: number }[];
  mailProvider: string;
};
