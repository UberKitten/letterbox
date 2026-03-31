import { defineConfig } from "vite";
import solidPlugin from "vite-plugin-solid";
import fs from "fs";
import path from "path";

const certDir = path.resolve(__dirname, "../certs");
const keyPath = path.join(certDir, "key.pem");
const certsExist = fs.existsSync(keyPath);

export default defineConfig({
  plugins: [solidPlugin()],
  server: {
    port: 3000,
    host: "0.0.0.0",
    ...(certsExist && {
      https: {
        key: fs.readFileSync(keyPath),
        cert: fs.readFileSync(path.join(certDir, "cert.pem")),
      },
    }),
    proxy: {
      "/auth": {
        target: "https://localhost:8787",
        secure: false,
      },
      "/api": {
        target: "https://localhost:8787",
        secure: false,
      },
    },
  },
  build: {
    target: "esnext",
  },
});
