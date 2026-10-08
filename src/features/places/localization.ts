import type { Place } from "./types";
import type { Locale } from "@/features/i18n/messages";
import { translate } from "@/features/i18n/translate";
const content: Record<string, { en: [string, string]; ru: [string, string] }> =
  {
    purcari: {
      en: [
        "Château Purcari",
        "A getaway among vineyards, stories and fine wines. Discover Moldova’s winemaking tradition in a place where time takes on a different rhythm.",
      ],
      ru: [
        "Château Purcari",
        "Отдых среди виноградников, историй и коллекционных вин. Откройте винодельческие традиции Молдовы в месте, где время течёт по-другому.",
      ],
    },
    asconi: {
      en: [
        "Asconi Winery",
        "Traditional houses, carefully prepared local dishes and wines from the heart of Moldova. A welcoming place to spend a day with the people you love.",
      ],
      ru: [
        "Винодельня Asconi",
        "Традиционные дома, домашние блюда и вина из сердца Молдовы. Уютное место для отдыха с близкими.",
      ],
    },
    orhei: {
      en: [
        "Old Orhei",
        "A landscape that stays with you. Explore trails above the Răut River, villages with living traditions and a monastery carved into the rock.",
      ],
      ru: [
        "Старый Орхей",
        "Пейзаж, который остаётся в сердце. Тропы над рекой Реут, сёла с живыми традициями и монастырь, вырубленный в скале.",
      ],
    },
    cricova: {
      en: [
        "Cricova Wine Cellars",
        "A journey through an underground wine city. Impressive galleries and a tasting experience for lovers of stories and flavours.",
      ],
      ru: [
        "Винные подвалы Крикова",
        "Путешествие по подземному городу вина. Впечатляющие галереи и дегустация для ценителей историй и вкусов.",
      ],
    },
    eco: {
      en: [
        "Eco Resort Butuceni",
        "Quiet mornings, charming cottages and the flavours of childhood. A guesthouse where local hospitality is part of every experience.",
      ],
      ru: [
        "Eco Resort Butuceni",
        "Тихие утра, уютные домики и вкусы детства. Гостевой дом, где местное гостеприимство сопровождает каждое впечатление.",
      ],
    },
    codru: {
      en: [
        "Codrii Nature Reserve",
        "Take a deep breath and leave the city behind. Trails through ancient forests and fascinating biodiversity in the heart of nature.",
      ],
      ru: [
        "Заповедник Кодры",
        "Вдохните глубже и оставьте город позади. Тропы среди вековых лесов и удивительное разнообразие природы.",
      ],
    },
    milesti: {
      en: [
        "Mileștii Mici",
        "Discover underground galleries and an impressive wine collection. A tour for those who want to explore Moldova through its winemaking tradition.",
      ],
      ru: [
        "Милештий Мичь",
        "Подземные галереи и впечатляющая коллекция вин. Экскурсия для тех, кто хочет познакомиться с винодельческими традициями Молдовы.",
      ],
    },
    soroca: {
      en: [
        "Soroca Fortress",
        "A stop on the banks of the Dniester, among historic walls and views across the river.",
      ],
      ru: [
        "Сорокская крепость",
        "Остановка на берегу Днестра: исторические стены и прекрасные виды на реку.",
      ],
    },
    saharna: {
      en: [
        "Saharna Waterfalls",
        "A walk through a green gorge, with waterfalls and plenty of stops to enjoy nature.",
      ],
      ru: [
        "Водопады Сахарна",
        "Прогулка по зелёному ущелью с водопадами и остановками, чтобы насладиться природой.",
      ],
    },
    valeni: {
      en: [
        "Grandma’s House",
        "A welcoming home in southern Moldova, with homemade bread and stories from your hosts.",
      ],
      ru: [
        "Дом бабушки",
        "Гостеприимный дом на юге Молдовы: домашний хлеб и истории хозяев.",
      ],
    },
    kayak: {
      en: [
        "Kayaking on the Dniester",
        "See Moldova from the water. A relaxing paddling experience with a guide and equipment included.",
      ],
      ru: [
        "На каяке по Днестру",
        "Посмотрите на Молдову с воды. Спокойная прогулка на каяке с гидом и снаряжением.",
      ],
    },
    han: {
      en: [
        "Vasile’s Inn",
        "Placinte, mămăligă and seasonal dishes in a warm atmosphere inspired by the Moldovan countryside.",
      ],
      ru: [
        "Трактир Василе",
        "Плацинды, мамалыга и сезонные блюда в тёплой атмосфере молдавской деревни.",
      ],
    },
  };
export function localizePlace(place: Place, locale: Locale): Place {
  const copy = locale === "ro" ? null : content[place.id]?.[locale];
  return {
    ...place,
    name: copy?.[0] || place.name,
    description: copy?.[1] || place.description,
    tags: place.tags.map((tag) => translate(tag, locale)),
    priceLabel: translate(place.priceLabel, locale),
    hours: translate(place.hours, locale),
  };
}
