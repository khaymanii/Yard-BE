// services/flow.js

const FLOW = {
  RECOMMEND: {
    id: "RECOMMEND",
    text: "Looking for your next home? 🏠\nAnswer a few questions and I’ll show you matching homes.",
    options: ["Start"],
    next: { start: "LOCATION" }, // normalized to lowercase
    inputType: "command", // ensures we know it's a command
    storeKey: null,
  },

  LOCATION: {
    id: "LOCATION",
    text: "Hello there, Pick your preferred location:",
    options: ["Lagos", "Abuja", "Paris", "London"],
    storeKey: "location",
    next: {
      lagos: "PROPERTY_TYPE",
      abuja: "PROPERTY_TYPE",
      paris: "PROPERTY_TYPE",
      london: "PROPERTY_TYPE",
    },
  },

  PROPERTY_TYPE: {
    id: "PROPERTY_TYPE",
    text: "Choose property type:",
    options: ["House", "Apartment", "Villa", "Duplex"],
    storeKey: "property_type",
    next: {
      house: "BEDROOMS",
      apartment: "BEDROOMS",
      villa: "BEDROOMS",
      duplex: "BEDROOMS",
    },
  },

  BEDROOMS: {
    id: "BEDROOMS",
    text: "How many bedrooms?",
    options: ["1", "2", "3", "4", "5"],
    storeKey: "bedrooms",
    next: {
      1: "REVIEW",
      2: "REVIEW",
      3: "REVIEW",
      4: "REVIEW",
      5: "REVIEW",
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
    next: { submit: "END" }, // lowercase normalization
  },

  END: {
    id: "END",
    text: "Thanks! Searching homes now...",
    options: [],
  },
};

module.exports = FLOW;
