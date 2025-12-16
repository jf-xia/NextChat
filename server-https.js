const https = require("https");
const fs = require("fs");
const next = require("next");

const host = "tb0808a0.hsu.edu.hk";
const port = 8000;

const dev = process.env.NODE_ENV !== "production";
const app = next({ dev });
const handle = app.getRequestHandler();

app.prepare().then(() => {
  const options = {
    key: fs.readFileSync("./docker/nginx/ssl/private/hsu.edu.hk.key"),
    cert: fs.readFileSync("./docker/nginx/ssl/certs/STAR_hsu_edu_hk.crt"),
  };

  https
    .createServer(options, (req, res) => {
      handle(req, res);
    })
    .listen(port, host, () => {
      console.log(`> Ready on https://${host}:${port}  (dev=${dev})`);
    });
});