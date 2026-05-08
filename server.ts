import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import * as cheerio from "cheerio";

async function startServer() {
  const app = express();
  const PORT = parseInt(process.env.PORT || "8888", 10);

  app.use(express.json());

  // API Route for scraping a website
  app.post("/api/scrape", async (req, res) => {
    try {
      const { url } = req.body;
      if (!url) {
        return res.status(400).json({ error: "URL is required" });
      }

      console.log("Scraping URL:", url);
      const response = await fetch(url, {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36",
        },
      });

      if (!response.ok) {
        return res
          .status(response.status)
          .json({ error: `Failed to fetch URL: ${response.statusText}` });
      }

      const html = await response.text();
      const $ = cheerio.load(html);

      // Remove script, style, and noscript tags to clean up text
      $("script").remove();
      $("style").remove();
      $("noscript").remove();
      $("header").remove();
      $("footer").remove();
      $("nav").remove();

      // Extract text content
      const text = $("body").text().replace(/\s+/g, " ").trim();

      res.json({ text: text.substring(0, 15000) }); // Limit to 15k characters for context window
    } catch (error) {
      console.error("Error scraping:", error);
      res.status(500).json({ error: "Failed to scrape website" });
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
    const distPath = path.join(process.cwd(), "dist");
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
