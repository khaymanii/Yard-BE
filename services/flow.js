const FLOW = {
  RECOMMEND: {
    text: "Looking for your next home? 🏠\nAnswer a few questions...",
    options: ["Start"],
    storeKey: null,
    next: "LOCATION",
  },
  LOCATION: {
    text: "Pick your preferred location:",
    options: ["Lagos", "Abuja", "Paris", "London"],
    storeKey: "location",
    next: "PROPERTY_TYPE",
  },
  PROPERTY_TYPE: {
    text: "Choose property type:",
    options: ["House", "Apartment", "Villa", "Duplex"],
    storeKey: "property_type",
    next: "BEDROOMS",
  },
  BEDROOMS: {
    text: "How many bedrooms?",
    options: ["1", "2", "3", "4", "5"],
    storeKey: "bedrooms",
    next: "REVIEW",
  },
  REVIEW: {
    text: (answers) => `Please review your search details:
Location: ${answers.location}
Property Type: ${answers.property_type}
Bedrooms: ${answers.bedrooms}`,
    options: ["Submit"],
    storeKey: null,
    next: {
      Submit: "END", // 👈 This is critical
    },
  },
  END: {
    text: "Fetching listings for you...",
    options: [],
  },
};

module.exports = FLOW;
