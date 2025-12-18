export function normalizeSearchParams(p = {}) {
  return {
    is_search: Boolean(p.is_search),
    location: p.location || null,
    bedrooms: p.bedrooms ? Number(p.bedrooms) : null,
    bathrooms: p.bathrooms ? Number(p.bathrooms) : null,
    max_price: p.max_price ? Number(p.max_price) : null,
    min_price: p.min_price ? Number(p.min_price) : null,
    property_type: p.property_type || null,
    features: Array.isArray(p.features) ? p.features : [],
    limit: p.limit || 5,
  };
}
