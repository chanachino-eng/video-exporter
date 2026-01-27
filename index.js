const express = require("express");
const fetch = require("node-fetch");
const { exec } = require("child_process");
const fs = require("fs");
const path = require("path");
const { v4: uuid } = require("uuid");
const cors = require("cors");

const app = express();

// Middleware
app.use(express.json());
app.use(cors());

app.post("/export", async (req, res) => {
  const { videoUrls } = req.body;

  if (!videoUrls || videoUrls.length === 0) {
    return res.status(400).json({ error: "No videos provided" });
  }

  const jobId = uuid();
  const workDir = `/tmp/${jobId}`;
  fs.mkdirSync(workDir, { recursive: true });

  try {
    const inputFiles = [];

    // Download videos
    for (let i = 0; i < videoUrls.length; i++) {
      const filePath = path.join(workDir, `clip${i}.mp4`);
      const response = await fetch(videoUrls[i]);

      if (!response.ok) {
        throw new Error(`Failed to fetch video ${i}`);
      }

      const buffer = await response.buffer();
      fs.writeFileSync(filePath, buffer);
      inputFiles.push(filePath);
    }

    const outputFile = path.join(workDir, "output.mp4");

    // Build FFmpeg input arguments
    const inputArgs = inputFiles.map(f => `-i ${f}`).join(" ");

    // Build concat filter
    const filter = `concat=n=${inputFiles.length}:v=1:a=1`;

    // Run FFmpeg using filter_complex (CORRECT METHOD)
    const cmd = `
      ffmpeg -y ${inputArgs}
      -filter_complex "${filter}"
      -vsync 2
      -movflags +faststart
      -pix_fmt yuv420p
      -c:v libx264
      -c:a aac
      ${outputFile}
    `.replace(/\s+/g, " ");

    exec(cmd, (err) => {
      if (err) {
        console.error("FFmpeg error:", err);
        return res.status(500).json({ error: "FFmpeg failed" });
      }

      res.download(outputFile, "memory-maker.mp4");
    });

  } catch (err) {
    console.error("Exporter error:", err);
    res.status(500).json({ error: err.message });
  }
});

// Render-compatible port
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Video exporter running on port ${PORT}`);
});