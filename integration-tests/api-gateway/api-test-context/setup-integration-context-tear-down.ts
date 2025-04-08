import fs from "fs";
import path from "path";

export default async function globalTeardown() {
  const filePath = path.join(__dirname, "integration-context.json");

  if (fs.existsSync(filePath)) {
    fs.unlinkSync(filePath);
  }
}
