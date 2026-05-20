const fs = require("fs");
const http = require("http");
const path = require("path");

const port = 8080;
const root = path.resolve(process.cwd());

const contentTypes = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".webmanifest": "application/manifest+json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".mp3": "audio/mpeg",
  ".m4a": "audio/mp4",
};

function resolveRequestPath(requestUrl) {
  const url = new URL(requestUrl, `http://localhost:${port}`);
  const pathname = decodeURIComponent(url.pathname);
  const relativePath = pathname === "/" ? "index.html" : pathname.replace(/^\/+/, "");
  const fullPath = path.resolve(root, relativePath);

  if (!fullPath.startsWith(root)) {
    return null;
  }

  return fullPath;
}

const server = http.createServer((request, response) => {
  try {
    if (request.url === "/__debug") {
      response.writeHead(200, { "Content-Type": "application/json; charset=utf-8" });
      response.end(JSON.stringify({ root, indexExists: fs.existsSync(path.join(root, "index.html")) }));
      return;
    }

    const filePath = resolveRequestPath(request.url);

    if (!filePath || !fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) {
      response.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
      response.end(`Nicht gefunden: ${request.url}\nRoot: ${root}`);
      return;
    }

    const extension = path.extname(filePath).toLowerCase();
    response.writeHead(200, {
      "Content-Type": contentTypes[extension] || "application/octet-stream",
      "Cache-Control": "no-store",
    });
    fs.createReadStream(filePath).pipe(response);
  } catch (error) {
    response.writeHead(500, { "Content-Type": "text/plain; charset=utf-8" });
    response.end(`Serverfehler: ${error.message}`);
  }
});

server.listen(port, "0.0.0.0", () => {
  console.log(`Putziputzi lokal: http://127.0.0.1:${port}`);
  console.log(`Im WLAN: http://192.168.0.193:${port}`);
  console.log("Zum Beenden: Fenster schliessen oder Strg+C");
});
