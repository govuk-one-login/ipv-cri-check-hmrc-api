import express from "express";
import bodyParser from "body-parser";
import { Logger } from "@aws-lambda-powertools/logger";
import { Constants } from "./utils/Constants";
import { credentialIssueRouter } from "./routes/CredentialIssueRouter";

const logger = new Logger({
  logLevel: "DEBUG",
  serviceName: "LocalContractAPI",
});

const app = express();
app.use(express.json());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

const port = Constants.LOCAL_APP_PORT;

app.listen(port, () => {
  logger.debug(`Contract testing app listening on port ${port}`);
});

app.use(Constants.CREDENTIAL_ISSUE, credentialIssueRouter);
