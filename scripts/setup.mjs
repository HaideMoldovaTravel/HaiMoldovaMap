import { existsSync, writeFileSync } from "node:fs";
import { randomBytes } from "node:crypto";
if (existsSync(".env")) {
  console.log(".env already exists; no credentials were changed.");
  process.exit(0);
}
const secret = () => randomBytes(24).toString("hex");
const postgres = secret();
const minio = secret();
writeFileSync(
  ".env",
  `# Local development only. Never commit this file.\nAPP_ENV=development\nAPP_PORT=3000\nBETTER_AUTH_URL=http://localhost:3000\nBETTER_AUTH_SECRET=${secret()}\nPOSTGRES_USER=hai_moldova\nPOSTGRES_PASSWORD=${postgres}\nPOSTGRES_DB=hai_moldova\nDATABASE_URL=postgresql://hai_moldova:${postgres}@localhost:5432/hai_moldova\nS3_ENDPOINT=http://localhost:9000\nS3_REGION=us-east-1\nS3_BUCKET=hai-moldova\nS3_ACCESS_KEY=hai-moldova-local\nS3_SECRET_KEY=${minio}\nADMIN_EMAIL=admin@haimoldova.local\nADMIN_PASSWORD=${secret()}\nSEED_DEMO=true\nMAIL_TRANSPORT=mailpit\nSMTP_HOST=localhost\nSMTP_PORT=1025\nEMAIL_FROM=Hai Moldova <noreply@haimoldova.local>\nRESEND_API_KEY=\nPHOTON_URL=https://photon.komoot.io\nOSRM_URL=https://router.project-osrm.org\n`,
  { mode: 0o600, flag: "wx" },
);
console.log(
  "Created a private .env with unique local credentials. Admin credentials are in ADMIN_EMAIL and ADMIN_PASSWORD. Run npm run docker:up.",
);
