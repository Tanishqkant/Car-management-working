const mongoose = require("mongoose");

const parkingSchema = new mongoose.Schema(
  {
    carNumber: {
      type: String,
      required: true,
      uppercase: true,
      trim: true,
    },

    phone: {
      type: String,
      required: true,
      trim: true,
    },

    slotNumber: {
      type: String,
      required: true,
    },

    status: {
      type: String,
      enum: ["Occupied", "Free"],
      default: "Occupied",
    },

    isResident: {
      type: Boolean,
      default: null,
    },

    entryTime: {
      type: Date,
      default: Date.now,
    },

    exitTime: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  },
);

module.exports = mongoose.model("Parking", parkingSchema);
