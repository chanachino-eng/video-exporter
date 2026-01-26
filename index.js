const express = require("express");
const fetch = require("node-fetch");
const { exec } = require("child_process");
const fs = require("fs");
const path = require("path");
const { v4: uuid } = require("uuid");

const app = express();
app.use(express.json());

app.post("/export", async (req, res) => {
  const { videoUrls } = req.body;

  if (!videoUrls || videoUrls.length === 0) {
    return res.status(400).json({ error: "No videos provided" });
  }

  const jobId = uuid();
  const workDir = `/tmp/${jobId}`;

  fs.mkdirSync(workDir, { recursive: true });

  try {
    const files = [];

    // Download videos
    for (let i = 0; i < videoUrls.length; i++) {
      const filePath = path.join(workDir, `clip${i}.mp4`);
      const response = await fetch(videoUrls[i]);
      const buffer = await response.buffer();
      fs.writeFileSync(filePath, buffer);
      files.push(filePath);
    }

    // Create FFmpeg concat file
    const listFile = path.join(workDir, "list.txt");
    fs.writeFileSync(
      listFile,
      files.map(f => `file '${f}'`).join("\n")
    );

    const outputFile = path.join(workDir, "output.mp4");

    // Run FFmpeg
    exec(
      `ffmpeg -y -f concat -safe 0 -i ${listFile} -c copy ${outputFile}`,
      (err) => {
        if (err) {
          console.error("FFmpeg error:", err);
          return res.status(500).json({ error: "FFmpeg failed" });
        }

        // Send the final video back
        res.download(outputFile, "memory-maker.mp4");
      }
    );

  } catch (err) {
    console.error("Exporter error:", err);
    res.status(500).json({ error: err.message });
  }
});

// ✅ Render-compatible port handling
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Video exporter running on port ${PORT}`);
});
