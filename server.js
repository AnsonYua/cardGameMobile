import http from "http";
import https from "https";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const port = Number.parseInt(process.env.PORT || "5173", 10);

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const distDir = path.join(__dirname, "dist");
const assetsDir = path.join(distDir, "assets");
const apiBaseUrl = process.env.API_BASE_URL || process.env.BACKEND_URL || "";

const contentTypeByExt = {
  ".html": "text/html; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".svg": "image/svg+xml",
};

const setCacheHeaderForPath = (res, filePath) => {
  if (filePath.startsWith(assetsDir + path.sep) || filePath === assetsDir) {
    res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
    return;
  }
  res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
};

const safeResolvePath = (urlPath) => {
  const decoded = decodeURIComponent(urlPath.split("?")[0] || "/");
  const cleaned = decoded.replace(/^\/+/, "");
  const normalized = path.normalize(cleaned);
  if (normalized.startsWith("..") || path.isAbsolute(normalized)) return null;
  return path.join(distDir, normalized);
};

const sendFile = (res, filePath) => {
  fs.stat(filePath, (err, stat) => {
    if (err || !stat.isFile()) {
      res.statusCode = 404;
      res.end("Not found");
      return;
    }
    const ext = path.extname(filePath).toLowerCase();
    const contentType = contentTypeByExt[ext] || "application/octet-stream";
    res.setHeader("Content-Type", contentType);
    setCacheHeaderForPath(res, filePath);
    const stream = fs.createReadStream(filePath);
    stream.pipe(res);
  });
};

const proxyApiRequest = (req, res) => {
  if (!apiBaseUrl) {
    res.statusCode = 502;
    res.end("API base URL not configured");
    return;
  }
  const target = new URL(apiBaseUrl);
  const isHttps = target.protocol === "https:";
  const client = isHttps ? https : http;

  const upstreamPath = (req.url || "/").replace(/^\/+/, "/");
  const options = {
    protocol: target.protocol,
    hostname: target.hostname,
    port: target.port || (isHttps ? 443 : 80),
    method: req.method,
    path: upstreamPath,
    headers: {
      ...req.headers,
      host: target.host,
    },
  };

  const upstreamReq = client.request(options, (upstreamRes) => {
    res.writeHead(upstreamRes.statusCode || 502, upstreamRes.headers);
    upstreamRes.pipe(res);
  });

  upstreamReq.on("error", () => {
    res.statusCode = 502;
    res.end("API proxy error");
  });

  req.pipe(upstreamReq);
};

const server = http.createServer((req, res) => {
  if (!req.url) {
    res.statusCode = 400;
    res.end("Bad request");
    return;
  }

  if (req.url.startsWith("/api/")) {
    proxyApiRequest(req, res);
    return;
  }

  const resolved = safeResolvePath(req.url);
  if (resolved) {
    fs.stat(resolved, (err, stat) => {
      if (!err && stat.isFile()) {
        sendFile(res, resolved);
        return;
      }
      // Fallback to index.html for SPA routes
      const indexPath = path.join(distDir, "index.html");
      res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
      res.setHeader("Content-Type", "text/html; charset=utf-8");
      fs.createReadStream(indexPath).pipe(res);
    });
    return;
  }
  res.statusCode = 400;
  res.end("Bad request");
});

server.listen(port, "0.0.0.0", () => {
  console.log(`Static server running at http://0.0.0.0:${port}`);
});
