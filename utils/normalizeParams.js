function normalizeSearchParams(intent = {}, previousIntent = {}) {
  return {
    is_search: intent.is_search ?? previousIntent.is_search ?? false,
    location: intent.location ?? previousIntent.location ?? null,
    bedrooms: intent.bedrooms ?? previousIntent.bedrooms ?? null,
    bathrooms: intent.bathrooms ?? previousIntent.bathrooms ?? null,
    max_price: intent.max_price ?? previousIntent.max_price ?? null,
    min_price: intent.min_price ?? previousIntent.min_price ?? null,
    property_type: intent.property_type ?? previousIntent.property_type ?? null,
    features: intent.features?.length
      ? intent.features
      : previousIntent.features ?? [],
    limit: intent.limit ?? previousIntent.limit ?? 5,
  };
}

module.exports = {
  normalizeSearchParams,
};
