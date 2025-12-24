// services/flow.js

const FLOW = {
  RECOMMEND: {
    id: "RECOMMEND",
    text: "Looking for your next home? 🏠\nAnswer a few questions and I'll show you matching homes.",
    options: ["Start"],
    next: { start: "LOCATION" },
    inputType: "command",
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
      `\n` +
      `Location: ${answers.location}\n` +
      `Property Type: ${answers.property_type}\n` +
      `Bedrooms: ${answers.bedrooms}`,
    options: ["Submit"],
    // No 'next' property - webhook handles submit directly
  },

  SELECT_LISTING: {
    id: "SELECT_LISTING",
    text: "Which property would you like to schedule an inspection for? Reply with the listing number (e.g., 1, 2, 3):",
    options: [], // Dynamic - handled manually in webhook
    inputType: "number", // Marks this as free-input validation
    storeKey: "selected_listing_index",
  },

  APPOINTMENT_DATE: {
    id: "APPOINTMENT_DATE",
    text: "Great choice! 🏡\n\nWhen would you like to schedule your inspection?\n\nPlease choose a date:",
    options: [], // Will be dynamically generated with next 7 days
    inputType: "date", // Marks this as dynamic date validation
    storeKey: "appointment_date",
  },

  APPOINTMENT_TIME: {
    id: "APPOINTMENT_TIME",
    text: "What time works best for you?",
    options: ["9:00 AM", "11:00 AM", "2:00 PM", "4:00 PM"],
    storeKey: "appointment_time",
    next: {
      "9:00 am": "CONTACT_INFO",
      "11:00 am": "CONTACT_INFO",
      "2:00 pm": "CONTACT_INFO",
      "4:00 pm": "CONTACT_INFO",
    },
  },

  CONTACT_INFO: {
    id: "CONTACT_INFO",
    text: "Almost done! Please provide your full name:",
    options: [], // Free text input
    inputType: "text", // Marks this as free-text validation
    storeKey: "contact_name",
  },

  CONFIRM_APPOINTMENT: {
    id: "CONFIRM_APPOINTMENT",
    text: (answers) =>
      `Please confirm your inspection appointment:\n\n` +
      `Property: ${answers.selected_listing_address || "Selected property"}\n` +
      `Date: ${
        answers.appointment_date_display || answers.appointment_date
      }\n` +
      `Time: ${answers.appointment_time}\n` +
      `Name: ${answers.contact_name}\n\n` +
      `Is this correct?`,
    options: ["Confirm", "Cancel"],
    next: {
      cancel: "LOCATION",
    },
  },

  APPOINTMENT_CONFIRMED: {
    id: "APPOINTMENT_CONFIRMED",
    text: "🎉 Your inspection appointment has been confirmed!\n\nYou'll receive a confirmation message shortly with all the details.\n\nWould you like to search for more properties?",
    options: ["Yes", "No"],
    next: {
      yes: "LOCATION",
      no: "THANK_YOU",
    },
  },

  THANK_YOU: {
    id: "THANK_YOU",
    text: "Thank you for using our service! Feel free to return anytime. 👋",
    options: [],
  },
};

module.exports = FLOW;
