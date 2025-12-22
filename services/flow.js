const FLOW = {
  RECOMMEND: {
    id: "RECOMMEND",
    text: "Find your next home\nAnswer a few questions and I’ll show you matching homes.",
    options: ["Start"],
    next: { Start: "LOCATION" },
    inputType: null,
  },
  LOCATION: {
    id: "LOCATION",
    text: "Pick your preferred location:",
    options: ["Lagos", "Abuja", "Paris", "London"],
    next: {
      Lagos: "PROPERTY_TYPE",
      Abuja: "PROPERTY_TYPE",
      Paris: "PROPERTY_TYPE",
      London: "PROPERTY_TYPE",
    },
    inputType: "radio",
    storeKey: "location",
  },
  PROPERTY_TYPE: {
    id: "PROPERTY_TYPE",
    text: "Choose property type:",
    options: ["House", "Apartment", "Villa", "Condo", "Duplex", "Other"],
    next: {
      House: "BEDROOMS",
      Apartment: "BEDROOMS",
      Villa: "BEDROOMS",
      Condo: "BEDROOMS",
      Duplex: "BEDROOMS",
      Other: "BEDROOMS",
    },
    inputType: "radio",
    storeKey: "property_type",
  },
  BEDROOMS: {
    id: "BEDROOMS",
    text: "How many bedrooms?",
    options: ["1", "2", "3", "4+"],
    next: {
      1: "REVIEW",
      2: "REVIEW",
      3: "REVIEW",
      "4+": "REVIEW",
    },
    inputType: "radio",
    storeKey: "bedrooms",
  },
  REVIEW: {
    id: "REVIEW",
    text: (session) =>
      `Please review your search details:\nLocation: ${session.location}\nProperty Type: ${session.property_type}\nBedrooms: ${session.bedrooms}`,
    options: ["Submit"],
    next: { Submit: "END" },
    inputType: null,
  },
  END: {
    id: "END",
    text: "Thanks! Searching homes now...",
    options: [],
    next: {},
    inputType: null,
  },
};

module.exports = FLOW;
