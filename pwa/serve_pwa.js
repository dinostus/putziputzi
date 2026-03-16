const http = require("http");
const fs = require("fs");
const path = require("path");

const port = 8080;
const root = __dirname;

const contentTypes = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".webmanifest": "application/manifest+json; charset=utf-8",
  ".svg": "image/svg+xml",
};

http
  .createServer((req, res) => {
    const requestPath = req.url === "/" ? "/index.html" : req.url;
    const filePath = path.join(root, decodeURIComponent(requestPath));

    if (!filePath.startsWith(root)) {
      res.writeHead(403);
      res.end("Forbidden");
      return;
    }

    fs.readFile(filePath, (error, data) => {
      if (error) {
        res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
        res.end("Nicht gefunden");
        return;
      }

      const extension = path.extname(filePath).toLowerCase();
      res.writeHead(200, {
        "Content-Type": contentTypes[extension] || "application/octet-stream",
      });
      res.end(data);
    });
  })
  .listen(port, "0.0.0.0", () => {
    console.log(`Putzplan-App läuft auf http://localhost:${port}`);
  });
