const express = require("express");
const mongoose = require("mongoose");
const Parking = require("../models/parking");
// const { sendVisitorSMS } = require("../services/smsService");

const router = express.Router();

const ALL_SLOTS = ["A1", "A2", "A3", "B1", "B2"];

function normalizeCarNumber(value) {
  return String(value || "")
    .replace(/[^a-zA-Z0-9]/g, "")
    .toUpperCase();
}

function isValidIndianPlate(number) {
  const patterns = [
    /^[A-Z]{2}\d{2}[A-Z]{2}\d{4}$/,
    /^[A-Z]{2}\d{2}[A-Z]\d{4}$/,
    /^[A-Z]{3}\d{4}$/,
  ];

  return patterns.some((pattern) => pattern.test(number));
}

function isValidPhone(phone) {
  // Accepts Indian mobile numbers with an optional +91 prefix.
  return /^(?:\+91)?[6-9]\d{9}$/.test(String(phone || "").trim());
}

// GET: Retrieve parking history for the admin.
router.get("/", async (req, res) => {
  try {
    const records = await Parking.find().sort({ entryTime: -1 });
    res.json(records);
  } catch (error) {
    console.error("Could not retrieve parking records:", error);
    res.status(500).json({ message: "Could not load parking records." });
  }
});

// POST: Register a vehicle and allocate a free slot.
router.post("/entry", async (req, res) => {
  try {
    const carNumber = normalizeCarNumber(req.body.carNumber);
    const phone = String(req.body.phone || "").trim();
    const isResident = req.body.isResident;

    if (!isValidIndianPlate(carNumber)) {
      return res.status(400).json({
        message: "Enter a valid vehicle number.",
      });
    }

    if (!isValidPhone(phone)) {
      return res.status(400).json({
        message: "Enter a valid Indian mobile number.",
      });
    }

    if (typeof isResident !== "boolean") {
      return res.status(400).json({
        message: "Please select Resident or Visitor.",
      });
    }

    // Prevent the same vehicle from having two active entries.
    const existingVehicle = await Parking.findOne({
      carNumber,
      status: "Occupied",
    });

    if (existingVehicle) {
      return res.status(409).json({
        message: `This vehicle is already parked in slot ${existingVehicle.slotNumber}.`,
      });
    }

    const occupiedRecords = await Parking.find({
      status: "Occupied",
    }).select("slotNumber");

    const occupiedSlots = new Set(
      occupiedRecords.map((record) => record.slotNumber),
    );

    const slotNumber = ALL_SLOTS.find((slot) => !occupiedSlots.has(slot));

    if (!slotNumber) {
      return res.status(409).json({
        message: "All parking slots are full.",
      });
    }

    const record = await Parking.create({
      carNumber,
      phone,
      slotNumber,
      status: "Occupied",
      isResident,
      entryTime: new Date(),
    });

    let smsStatus = "not_requested";

    // Only visitors receive an SMS in this example.
    if (!isResident) {
      try {
        const result = await sendVisitorSMS(phone, carNumber, slotNumber);

        smsStatus = result.skipped ? "not_configured" : "submitted";
      } catch (smsError) {
        // An SMS failure must not cancel a valid parking entry.
        console.error("SMS failed:", smsError.message);
        smsStatus = "failed";
      }
    }

    return res.status(201).json({
      message: isResident
        ? "Resident entry registered."
        : "Visitor entry registered.",
      record,
      smsStatus,
    });
  } catch (error) {
    console.error("Could not register entry:", error);
    res.status(500).json({
      message: "Could not register the vehicle.",
    });
  }
});

// PATCH: Admin marks a vehicle as exited and frees its slot.
router.patch("/:id/exit", async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({
        message: "Invalid parking record ID.",
      });
    }

    const record = await Parking.findById(req.params.id);

    if (!record) {
      return res.status(404).json({
        message: "Parking record not found.",
      });
    }

    if (record.status === "Free") {
      return res.status(409).json({
        message: "This vehicle has already exited.",
      });
    }

    record.status = "Free";
    record.exitTime = new Date();

    await record.save();

    res.json({
      message: `Slot ${record.slotNumber} is now free.`,
      record,
    });
  } catch (error) {
    console.error("Could not exit vehicle:", error);
    res.status(500).json({
      message: "Could not process vehicle exit.",
    });
  }
});

module.exports = router;
