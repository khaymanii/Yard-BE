// services/flow.js

const FLOW = {
  WELCOME: {
    id: "WELCOME",
    text: "👋 Welcome to Yard Property Search!\n\nI'll help you find your perfect home and schedule inspections.\n\nType the number of your choice:",
    options: ["1. Start Search", "2. View My Appointments", "3. Help"],
    numbered: true,
    next: {
      1: "LOCATION",
      2: "VIEW_APPOINTMENTS",
      3: "HELP",
    },
  },

  HELP: {
    id: "HELP",
    text:
      "🆘 Help & Commands\n\n" +
      "• Type 'restart' - Start over\n" +
      "• Type 'menu' - Main menu\n" +
      "• Type 'cancel' - Cancel current action\n\n" +
      "Need human assistance? Contact: infoyardhelp@yard.com",
    options: ["1. Back to Menu"],
    numbered: true,
    next: {
      1: "WELCOME",
    },
  },

  LOCATION: {
    id: "LOCATION",
    text: "📍 Where would you like to search?\n\nType the number:",
    options: ["1. Lagos", "2. Abuja", "3. Port Harcourt", "4. Ibadan"],
    numbered: true,
    storeKey: "location",
    next: {
      1: "PROPERTY_TYPE",
      2: "PROPERTY_TYPE",
      3: "PROPERTY_TYPE",
      4: "PROPERTY_TYPE",
    },
    // Map numbers back to actual values
    valueMap: {
      1: "Lagos",
      2: "Abuja",
      3: "Port Harcourt",
      4: "Ibadan",
    },
  },

  PROPERTY_TYPE: {
    id: "PROPERTY_TYPE",
    text: "🏘️ What type of property?\n\nType the number:",
    options: ["1. House", "2. Apartment", "3. Villa", "4. Duplex"],
    numbered: true,
    storeKey: "property_type",
    next: {
      1: "BEDROOMS",
      2: "BEDROOMS",
      3: "BEDROOMS",
      4: "BEDROOMS",
    },
    valueMap: {
      1: "House",
      2: "Apartment",
      3: "Villa",
      4: "Duplex",
    },
  },

  BEDROOMS: {
    id: "BEDROOMS",
    text: "🛏️ How many bedrooms?\n\nType the number:",
    options: ["1. One", "2. Two", "3. Three", "4. Four", "5. Five+"],
    numbered: true,
    storeKey: "bedrooms",
    next: {
      1: "REVIEW",
      2: "REVIEW",
      3: "REVIEW",
      4: "REVIEW",
      5: "REVIEW",
    },
    valueMap: {
      1: 1,
      2: 2,
      3: 3,
      4: 4,
      5: 5,
    },
  },

  REVIEW: {
    id: "REVIEW",
    text: (answers) => {
      return (
        `📋 Review Your Search\n\n` +
        `📍 Location: ${answers.location || "Not set"}\n` +
        `🏘️ Property: ${answers.property_type || "Not set"}\n` +
        `🛏️ Bedrooms: ${answers.bedrooms || "Not set"}\n\n` +
        `Type the number:`
      );
    },
    options: ["1. Search Now", "2. Modify Search", "3. Cancel"],
    numbered: true,
    next: {
      2: "LOCATION",
      3: "WELCOME",
    },
    // 1 is handled in webhook (search trigger)
  },

  SELECT_LISTING: {
    id: "SELECT_LISTING",
    text: "🏡 Select a property to schedule inspection\n\nReply with the number (e.g., 1 or 2 or 3):",
    inputType: "number",
    storeKey: "selected_listing_index",
  },

  APPOINTMENT_DATE: {
    id: "APPOINTMENT_DATE",
    text: "📅 Choose your preferred inspection date\n\nReply with the number (e.g., 1 or 2 or 3):",
    inputType: "dynamic_date",
    numbered: true,
    storeKey: "appointment_date",
  },

  APPOINTMENT_TIME: {
    id: "APPOINTMENT_TIME",
    text: "⏰ Select your preferred time\n\nReply with the number (e.g., 1 or 2 or 3):",
    options: ["1. 9:00 AM", "2. 11:00 AM", "3. 2:00 PM", "4. 4:00 PM"],
    numbered: true,
    storeKey: "appointment_time",
    next: {
      1: "CONTACT_INFO",
      2: "CONTACT_INFO",
      3: "CONTACT_INFO",
      4: "CONTACT_INFO",
    },
    valueMap: {
      1: "9:00 AM",
      2: "11:00 AM",
      3: "2:00 PM",
      4: "4:00 PM",
    },
  },

  CONTACT_INFO: {
    id: "CONTACT_INFO",
    text: "👤 Please provide your full name:\n\n(Reply with your full name)",
    inputType: "text",
    storeKey: "contact_name",
  },

  CONFIRM_APPOINTMENT: {
    id: "CONFIRM_APPOINTMENT",
    text: (answers) =>
      `✅ Confirm Your Inspection Appointment\n\n` +
      `🏡 Property: ${
        answers.selected_listing_address || "Selected property"
      }\n` +
      `📅 Date: ${
        answers.appointment_date_display || answers.appointment_date
      }\n` +
      `⏰ Time: ${answers.appointment_time}\n` +
      `👤 Name: ${answers.contact_name}\n\n` +
      `Type the number:`,
    options: ["1. Confirm & Book", "2. Cancel"],
    numbered: true,
    next: {
      2: "WELCOME",
    },
    // 1 is handled in webhook (confirmation trigger)
  },

  APPOINTMENT_CONFIRMED: {
    id: "APPOINTMENT_CONFIRMED",
    text: (answers) =>
      `🎉 Appointment Confirmed!\n\n` +
      `Your inspection has been scheduled:\n\n` +
      `📍 ${answers.selected_listing_address}\n` +
      `📅 ${answers.appointment_date_display}\n` +
      `⏰ ${answers.appointment_time}\n\n` +
      `You'll receive a confirmation SMS shortly.\n\n` +
      `Reply with the number:`,
    options: [
      "1. Search More Properties",
      "2. View My Appointments",
      "3. Done",
    ],
    numbered: true,
    next: {
      1: "LOCATION",
      2: "VIEW_APPOINTMENTS",
      3: "THANK_YOU",
    },
  },

  VIEW_APPOINTMENTS: {
    id: "VIEW_APPOINTMENTS",
    text: "📋 Your Scheduled Appointments\n\n(Loading your appointments...)\n\nReply with the number (e.g., 1 or 2 or 3):",
    options: ["1. Schedule New Inspection", "2. Back to Menu"],
    numbered: true,
    next: {
      1: "LOCATION",
      2: "WELCOME",
    },
  },

  NO_LISTINGS_FOUND: {
    id: "NO_LISTINGS_FOUND",
    text:
      "😔 No Properties Found\n\n" +
      "We couldn't find any properties matching your criteria.\n\n" +
      "Type the number:",
    options: ["1. Modify Search", "2. Start New Search", "3. Main Menu"],
    numbered: true,
    next: {
      1: "LOCATION",
      2: "LOCATION",
      3: "WELCOME",
    },
  },

  THANK_YOU: {
    id: "THANK_YOU",
    text:
      "👋 Thank you for using Yard Property Search!\n\n" +
      "Type *'menu'* anytime to return to the main menu.\n\n" +
      "Have a great day! 🏡",
    options: [],
  },

  // Error/Edge case screens
  SESSION_EXPIRED: {
    id: "SESSION_EXPIRED",
    text: "⏱️ Your session has expired.\n\nLet's start afresh!\n\nReply with the number (e.g., 1):",
    options: ["1. Start Over"],
    numbered: true,
    next: {
      1: "WELCOME",
    },
  },

  INVALID_INPUT: {
    id: "INVALID_INPUT",
    text: "❌ Invalid Input\n\nPlease enter a valid number from the options.\n\nType *'menu'* to return to main menu.",
    options: [],
  },
};

module.exports = FLOW;
