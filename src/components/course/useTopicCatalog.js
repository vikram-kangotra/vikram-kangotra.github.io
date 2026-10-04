import { useEffect, useState } from 'react';

let cachedCatalog;
let pendingCatalog;
function loadCatalog() {
  if (cachedCatalog) return Promise.resolve(cachedCatalog);
  if (!pendingCatalog) pendingCatalog = fetch('/course/topic-catalog.json')
    .then(response => { if (!response.ok) throw new Error('Topic search is unavailable.'); return response.json(); })
    .then(catalog => { if (!Array.isArray(catalog)) throw new Error('Invalid topic index.'); cachedCatalog = catalog; return catalog; })
    .finally(() => { pendingCatalog = null; });
  return pendingCatalog;
}

export default function useTopicCatalog(enabled) {
  const [catalog, setCatalog] = useState(cachedCatalog || []);
  const [error, setError] = useState(false);
  useEffect(() => {
    if (!enabled || catalog.length) return;
    let active = true;
    setError(false);
    loadCatalog().then(items => { if (active) setCatalog(items); }).catch(() => { if (active) setError(true); });
    return () => { active = false; };
  }, [enabled, catalog.length]);
  return { catalog, loading: enabled && !catalog.length && !error, error };
}
