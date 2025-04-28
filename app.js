const express = require("express");
const bodyParser = require("body-parser");
const cors = require("cors"); 
const recordsRoutes = require("./routes/route");

const app = express();

app.use(cors()); 
app.use(bodyParser.json());
app.use("/api", recordsRoutes);

// Added by DevOps Team
app.get("/", (req, res) => {
  res.send("Euro Shine Backend is running :rocket:");
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`🚀 Server running at http://localhost:${PORT}`);
});
