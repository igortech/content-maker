import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";
import axios from "axios";
import { google } from "googleapis";
import { Storage } from "@google-cloud/storage";
import { v4 as uuidv4 } from "uuid";
import fs from "fs";
import os from "os";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: "50mb" }));

  // Local temp storage setup
  const UPLOADS_DIR = path.join(os.tmpdir(), "podcasts-uploads");
  if (!fs.existsSync(UPLOADS_DIR)) {
    fs.mkdirSync(UPLOADS_DIR, { recursive: true });
  }

  // Serve temp assets publicly for Shotstack
  app.use("/temp-assets", express.static(UPLOADS_DIR));

  // API routes
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok" });
  });


  // Local Upload (No GCS version)
  app.post("/api/storage/upload", async (req, res) => {
    try {
      const { data, mimeType, filename } = req.body;
      if (!data || !mimeType || !filename) {
        return res.status(400).json({ error: "Missing data, mimeType or filename" });
      }

      const buffer = Buffer.from(data, "base64");
      const safeFilename = filename.replace(/\//g, "_"); // Flatten structure for local fs
      const filePath = path.join(UPLOADS_DIR, safeFilename);

      // Ensure subdirectory exists if any (though we flattened it)
      fs.writeFileSync(filePath, buffer);
      
      // Verify file existence and size
      const stats = fs.statSync(filePath);
      console.log(`[UPLOAD] Saved: ${filePath}, Size: ${stats.size} bytes, Mime: ${mimeType}`);

      // Construct public URL using the actual request host or APP_URL
      const appUrl = process.env.APP_URL || `https://${req.get("host")}`;
      const url = `${appUrl}/temp-assets/${safeFilename}`;
      console.log(`[UPLOAD] Generated URL: ${url}`);

      res.json({ url });
    } catch (error: any) {
      console.error("Local storage upload error:", error.message);
      res.status(500).json({ error: error.message });
    }
  });

  // Shotstack Proxy
  app.post("/api/shotstack/render", async (req, res) => {
    try {
      const apiKey = process.env.SHOTSTACK_KEY;
      if (!apiKey) {
        return res.status(500).json({ error: "SHOTSTACK_KEY not configured" });
      }

      let env = process.env.SHOTSTACK_ENV || "stage";
      let response;
      
      try {
        response = await axios.post(`https://api.shotstack.io/edit/${env}/render`, req.body, {
          headers: {
            "Content-Type": "application/json",
            "x-api-key": apiKey,
          },
        });
      } catch (err: any) {
        if (err.response?.status === 403 && !process.env.SHOTSTACK_ENV) {
          // Fallback to v1 if stage fails with 403 and no env was explicitly set
          env = "v1";
          response = await axios.post(`https://api.shotstack.io/edit/${env}/render`, req.body, {
            headers: {
              "Content-Type": "application/json",
              "x-api-key": apiKey,
            },
          });
        } else {
          throw err;
        }
      }
      
      res.json(response.data);
    } catch (error: any) {
      console.error("Shotstack render error:", JSON.stringify(error.response?.data || error.message, null, 2));
      res.status(error.response?.status || 500).json(error.response?.data || { error: "Failed to start render" });
    }
  });

  app.get("/api/shotstack/status/:id", async (req, res) => {
    try {
      const apiKey = process.env.SHOTSTACK_KEY;
      if (!apiKey) {
        return res.status(500).json({ error: "SHOTSTACK_KEY not configured" });
      }

      let env = process.env.SHOTSTACK_ENV || "stage";
      let response;
      
      try {
        response = await axios.get(`https://api.shotstack.io/edit/${env}/render/${req.params.id}`, {
          headers: {
            "x-api-key": apiKey,
          },
        });
      } catch (err: any) {
        if (err.response?.status === 403 && !process.env.SHOTSTACK_ENV) {
          env = "v1";
          response = await axios.get(`https://api.shotstack.io/edit/${env}/render/${req.params.id}`, {
            headers: {
              "x-api-key": apiKey,
            },
          });
        } else {
          throw err;
        }
      }
      
      res.json(response.data);
    } catch (error: any) {
      console.error("Shotstack status error:", JSON.stringify(error.response?.data || error.message, null, 2));
      res.status(error.response?.status || 500).json(error.response?.data || { error: "Failed to fetch status" });
    }
  });

  // RSS Proxy for Trend Radar
  app.get("/api/rss-proxy", async (req, res) => {
    const { url } = req.query;
    if (!url || typeof url !== "string") {
      return res.status(400).json({ error: "URL is required" });
    }
    try {
      const response = await axios.get(url, {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
          "Accept": "application/rss+xml, application/xml, text/xml, */*",
          "Accept-Language": "ru-RU,ru;q=0.9,en-US;q=0.8,en;q=0.7",
          "Referer": "https://www.google.com/",
          "Cache-Control": "no-cache"
        },
        timeout: 12000,
        validateStatus: () => true // Handle all status codes manually
      });

      if (response.status >= 400) {
        console.warn(`RSS source [${url}] returned ${response.status}`);
        return res.json({ 
          error: true, 
          status: response.status, 
          message: `Source returned ${response.status}` 
        });
      }

      res.set("Content-Type", "application/xml");
      res.send(response.data);
    } catch (error: any) {
      console.warn(`RSS proxy fetch failed for [${url}]:`, error.message);
      res.json({ 
        error: true, 
        message: error.message 
      });
    }
  });

  // D-id Proxy Routes
  app.get("/api/did/drivers", async (req, res) => {
    try {
      const apiKey = req.headers["authorization"];
      if (!apiKey) {
        return res.status(401).json({ error: "Missing D-id API Key" });
      }
      const response = await axios.get("https://api.d-id.com/clips/presenters", {
        headers: {
          Authorization: apiKey,
          "Content-Type": "application/json",
        },
      });
      res.json(response.data);
    } catch (error: any) {
      console.error("D-id drivers error:", error.response?.data || error.message);
      res.status(error.response?.status || 500).json(error.response?.data || { error: "Failed to fetch drivers" });
    }
  });

  app.post("/api/did/talks", async (req, res) => {
    try {
      const apiKey = req.headers["authorization"];
      if (!apiKey) {
        return res.status(401).json({ error: "Missing D-id API Key" });
      }
      const response = await axios.post("https://api.d-id.com/talks", req.body, {
        headers: {
          Authorization: apiKey,
          "Content-Type": "application/json",
        },
      });
      res.json(response.data);
    } catch (error: any) {
      console.error("D-id talk error:", error.response?.data || error.message);
      res.status(error.response?.status || 500).json(error.response?.data || { error: "Failed to generate talk" });
    }
  });

  app.get("/api/did/talks/:id", async (req, res) => {
    try {
      const apiKey = req.headers["authorization"];
      if (!apiKey) {
        return res.status(401).json({ error: "Missing D-id API Key" });
      }
      const response = await axios.get(`https://api.d-id.com/talks/${req.params.id}`, {
        headers: {
          Authorization: apiKey,
          "Content-Type": "application/json",
        },
      });
      res.json(response.data);
    } catch (error: any) {
      console.error("D-id status error:", error.response?.data || error.message);
      res.status(error.response?.status || 500).json(error.response?.data || { error: "Failed to fetch talk status" });
    }
  });

  app.get("/api/did/presenters", async (req, res) => {
    try {
      const apiKey = req.headers["authorization"];
      if (!apiKey) {
        return res.status(401).json({ error: "Missing D-id API Key" });
      }
      const response = await axios.get("https://api.d-id.com/clips/presenters", {
        headers: {
          Authorization: apiKey,
          "Content-Type": "application/json",
        },
      });
      res.json(response.data);
    } catch (error: any) {
      console.error("D-id presenters error:", error.response?.data || error.message);
      res.status(error.response?.status || 500).json(error.response?.data || { error: "Failed to fetch presenters" });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(__dirname, "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
