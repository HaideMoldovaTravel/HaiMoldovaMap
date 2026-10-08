import { messages, type Locale } from "./messages";
export function translate(
  text: string | undefined,
  locale: Locale,
  params: Record<string, string | number> = {},
): string {
  if (!text) return "";
  const key = messages[text]
    ? text
    : Object.keys(messages).find(
        (key) => messages[key].en === text || messages[key].ru === text,
      ) || text;
  const value = locale === "ro" ? key : messages[key]?.[locale] || key;
  return value.replace(/\{\{(\w+)\}\}/g, (_, name: string) =>
    String(params[name] ?? `{{${name}}}`),
  );
}
