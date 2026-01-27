const express = require("express");
const fetch = require("node-fetch");
const { exec } = require("child_process");
const fs = require("fs");
const path = require("path");
const { v4: uuid } = require("uuid");
const cors = require("cors");

const app = express();

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

    // VERY SIMPLE concat attempt (diagnostic)
    const listFile = path.join(workDir, "list.txt");
    fs.writeFileSync(
      listFile,
      inputFiles.map(f => `file '${f}'`).join("\n")
    );

    const cmd = `
      ffmpeg -y
      -loglevel error
      -f concat -safe 0
      -i ${listFile}
      -pix_fmt yuv420p
      -c:v libx264
      -c:a aac
      ${outputFile}
    `.replace(/\s+/g, " ");

    exec(cmd, (err, stdout, stderr) => {
      console.error("FFmpeg STDOUT:", stdout);
      console.error("FFmpeg STDERR:", stderr);

      if (err) {
        return res.status(500).json({
          error: "FFmpeg failed",
          details: stderr || err.message
        });
      }

      res.download(outputFile, "memory-maker.mp4");
    });

  } catch (err) {
    console.error("Exporter error:", err);
    res.status(500).json({ error: err.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Video exporter running on port ${PORT}`);
});
