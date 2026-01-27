const express = require("express");
const fetch = require("node-fetch");
const { execSync } = require("child_process");
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
    const normalizedFiles = [];

    // 1️⃣ Download + normalize each clip
    for (let i = 0; i < videoUrls.length; i++) {
      const rawFile = path.join(workDir, `raw${i}.mp4`);
      const normFile = path.join(workDir, `norm${i}.mp4`);

      const response = await fetch(videoUrls[i]);
      if (!response.ok) throw new Error(`Failed to fetch video ${i}`);

      fs.writeFileSync(rawFile, await response.buffer());

      // Normalize clip (THIS IS THE KEY)
      execSync(
        `ffmpeg -y -i ${rawFile} \
        -vf "scale=1280:-2:force_original_aspect_ratio=decrease,format=yuv420p" \
        -r 30 \
        -c:v libx264 \
        -profile:v baseline \
        -level 3.0 \
        -c:a aac \
        -ac 2 \
        ${normFile}`,
        { stdio: "ignore" }
      );

      normalizedFiles.push(normFile);
    }

    // 2️⃣ Create concat list
    const listFile = path.join(workDir, "list.txt");
    fs.writeFileSync(
      listFile,
      normalizedFiles.map(f => `file '${f}'`).join("\n")
    );

    const outputFile = path.join(workDir, "output.mp4");

    // 3️⃣ Concatenate normalized clips
    execSync(
      `ffmpeg -y -f concat -safe 0 -i ${listFile} -c copy ${outputFile}`,
      { stdio: "ignore" }
    );

    res.download(outputFile, "memory-maker.mp4");

  } catch (err) {
    console.error("Export failed:", err);
    res.status(500).json({ error: "FFmpeg failed" });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Video exporter running on port ${PORT}`);
});
