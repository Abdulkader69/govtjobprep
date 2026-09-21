import { useEffect } from "react";

const SITE = "প্রস্তুতি";
const DEFAULT_TITLE = document.title;
const DEFAULT_DESC = document.querySelector('meta[name="description"]')?.content ?? "";

/**
 * Per-route <title> and description. index.html carries the site-wide tags
 * (crawlers that do not run JavaScript see those); this keeps the tab title
 * and the description in step with the page a person is actually on.
 */
export function usePageMeta(title, description) {
  useEffect(() => {
    document.title = title ? `${title} — ${SITE}` : DEFAULT_TITLE;
    const meta = document.querySelector('meta[name="description"]');
    if (meta) meta.content = description ?? DEFAULT_DESC;
    return () => {
      document.title = DEFAULT_TITLE;
      if (meta) meta.content = DEFAULT_DESC;
    };
  }, [title, description]);
}
