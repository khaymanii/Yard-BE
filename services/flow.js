// services/flow.js

const FLOW = {
  RECOMMEND: {
    id: "RECOMMEND",
    text:
      "Find your next home 🏠\n" +
      "Answer a few questions and I’ll show you matching homes.",
    options: ["Start"],
    next: { Start: "LOCATION" },
  },

  LOCATION: {
    id: "LOCATION",
    text: "Pick your preferred location:",
    options: ["Lagos", "Abuja", "Paris", "London"],
    storeKey: "location",
    next: {
      Lagos: "PROPERTY_TYPE",
      Abuja: "PROPERTY_TYPE",
      Paris: "PROPERTY_TYPE",
      London: "PROPERTY_TYPE",
    },
  },

  PROPERTY_TYPE: {
    id: "PROPERTY_TYPE",
    text: "Choose property type:",
    options: ["House", "Apartment", "Villa", "Condo", "Duplex", "Other"],
    storeKey: "property_type",
    next: {
      House: "BEDROOMS",
      Apartment: "BEDROOMS",
      Villa: "BEDROOMS",
      Condo: "BEDROOMS",
      Duplex: "BEDROOMS",
      Other: "BEDROOMS",
    },
  },

  BEDROOMS: {
    id: "BEDROOMS",
    text: "How many bedrooms?",
    options: ["1", "2", "3", "4+"],
    storeKey: "bedrooms",
    next: {
      1: "REVIEW",
      2: "REVIEW",
      3: "REVIEW",
      "4+": "REVIEW",
    },
  },

  REVIEW: {
    id: "REVIEW",
    text: (answers) =>
      `Please review your search details:\n` +
      `Location: ${answers.location}\n` +
      `Property Type: ${answers.property_type}\n` +
      `Bedrooms: ${answers.bedrooms}`,
    options: ["Submit"],
    next: { Submit: "END" },
  },

  END: {
    id: "END",
    text: "Thanks! Searching homes now...",
    options: [],
  },
};

module.exports = FLOW;
