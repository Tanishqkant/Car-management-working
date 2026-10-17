require("dotenv").config();

const express = require("express");
const mongoose = require("mongoose");
const path = require("path");
const parkingRoutes = require("./routes/parkingroutes");

const app = express();
const PORT = process.env.PORT || 5000;

app.use(express.json({ limit: "2mb" }));

// Serve the frontend files from the public folder.
app.use(express.static(path.join(__dirname, "public")));

// Parking API endpoints.
app.use("/api/parking", parkingRoutes);

// Friendly health-check endpoint.
app.get("/api/health", (req, res) => {
  res.json({
    status: "OK",
    message: "Track It backend is running.",
  });
});

async function startServer() {
  try {
    if (!process.env.MONGO_URI) {
      throw new Error("MONGO_URI is missing from the .env file.");
    }

    await mongoose.connect(process.env.MONGO_URI);
    console.log("Connected to MongoDB.");

    app.listen(PORT, () => {
      console.log(`Track It is running at http://localhost:${PORT}`);
    });
  } catch (error) {
    console.error("Server startup failed:", error.message);
    process.exit(1);
  }
}

startServer();
