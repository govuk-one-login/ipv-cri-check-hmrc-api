import { promises as fs } from "fs";
import path from "path";

export const loadIntegrationContext = async () => {
  const filePath = path.join(__dirname, "integration-context.json");
  const data = await fs.readFile(filePath, "utf-8");
  return JSON.parse(data);
};
