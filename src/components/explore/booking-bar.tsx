"use client";
import { CalendarCheck, Mail, MessageCircle, Phone } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useI18n } from "@/features/i18n/provider";
import { contactHref } from "@/features/places/presentation";
import type { Place } from "@/features/places/types";

type ContactField = NonNullable<Place["contactFields"]>[number];
type Action = {
  id: string;
  label: string;
  value: string;
  href: string;
  icon: LucideIcon;
};

// Order of preference; the bar shows at most three channels that have data.
const channels: { id: string; type: string; icon: LucideIcon }[] = [
  { id: "booking_url", type: "url", icon: CalendarCheck },
  { id: "phone", type: "phone", icon: Phone },
  { id: "whatsapp", type: "phone", icon: MessageCircle },
  { id: "email", type: "email", icon: Mail },
];

export function bookingActions(
  fields: ContactField[],
  t: (text: string) => string,
): Action[] {
  const labels: Record<string, string> = {
    booking_url: t("Rezervă online"),
    phone: t("Sună"),
    whatsapp: "WhatsApp",
    viber: "Viber",
    email: t("Email"),
  };
  return channels
    .flatMap((channel) => {
      const value = fields.find((f) => f.id === channel.id)?.value?.trim();
      const href = value && contactHref(channel.type, value, channel.id);
      return href
        ? [
            {
              id: channel.id,
              label: labels[channel.id],
              value,
              href,
              icon: channel.icon,
            },
          ]
        : [];
    })
    .slice(0, 3);
}

/**
 * Reservation and contact shortcuts that stay visible while the visitor
 * scrolls the details panel. Renders nothing when the place has no channel.
 */
export function BookingBar({
  place,
  fields,
  onDemo,
}: {
  place: Place;
  fields: ContactField[];
  onDemo: (message: string) => void;
}) {
  const { t } = useI18n();
  const actions = bookingActions(fields, t);
  if (!actions.length) return null;
  return (
    <div
      className={`booking-bar booking-bar-${actions.length}`}
      role="group"
      aria-label={t("Rezervări și contact")}
    >
      {actions.map((action, index) => (
        <a
          key={action.id}
          href={action.href}
          className={`booking-action ${index === 0 ? "primary" : ""} ${action.id}`}
          target={action.href.startsWith("http") ? "_blank" : undefined}
          rel="noopener noreferrer"
          onClick={(e) => {
            if (place.demo === false) return;
            e.preventDefault();
            onDemo(
              `${action.label} · ${t("contact demonstrativ")} · ${action.value}`,
            );
          }}
        >
          <action.icon size={17} />
          <span>{action.label}</span>
        </a>
      ))}
    </div>
  );
}
