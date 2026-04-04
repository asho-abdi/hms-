/** Whether value can be used as an <img src> (absolute http(s) or app-served upload path). */
export function isDisplayableImageUrl(url) {
  if (!url || typeof url !== 'string') return false;
  const t = url.trim();
  if (!t) return false;
  if (/^https?:\/\//i.test(t)) return true;
  return t.startsWith('/uploads/');
}
