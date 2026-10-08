import { places } from "./data";
export interface PlaceContacts {
  phone: string;
  email: string;
  website: string;
  address: string;
  whatsapp: string;
  viber: string;
  demo: true;
}
// Reserved .example domains and illustrative numbers avoid impersonating real venues.
export const mockContacts: Record<string, PlaceContacts> = Object.fromEntries(
  places.map((place, index) => {
    const phone = `+373 00 000 ${String(index + 101)}`;
    return [
      place.id,
      {
        phone,
        email: `rezervari@${place.id}.example`,
        website: `${place.id}.example`,
        address: place.village,
        whatsapp: phone,
        viber: phone,
        demo: true,
      },
    ];
  }),
);
