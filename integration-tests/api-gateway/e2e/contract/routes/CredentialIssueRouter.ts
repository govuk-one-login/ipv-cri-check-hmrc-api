import express from "express";
import asyncify from "express-asyncify";
import { Constants } from "../utils/Constants";
import { Logger } from "@aws-lambda-powertools/logger";

const logger = new Logger({
	logLevel: "DEBUG",
	serviceName: "NinoCriProvider",
});

export const credentialIssueRouter = asyncify(express.Router());
credentialIssueRouter.post("/", async (req, res) => {		

    logger.info("Starting");
    const myHeaders = new Headers();
    for (const [key, value] of Object.entries(req.headers)) {
        logger.info("Adding Header key: " + key + " value: " + value);
        myHeaders.append(key, value as string);
    }

    // let auth:string = req.headers.authorization ?? '';
    // let apikey:string = req.headers["x-api-key"] as string ?? '';
    // myHeaders.append("Authorization", auth);
    // myHeaders.append("x-api-key", apikey);

    const response = await fetch("https://j03oqv9b8a.execute-api.eu-west-2.amazonaws.com/localdev/credential/issue", {
        method: req.method,
        headers: myHeaders,
        body: req.body,
    })
    logger.info("Res: " + response.status);
	res.status(response.status);
    res.setHeader(Constants.HTTP_CONTENT_TYPE_HEADER, Constants.JSON_CONTENT_TYPE);
	res.send(response.body);	

    // res.status(200);
	// res.setHeader(Constants.HTTP_CONTENT_TYPE_HEADER, Constants.JSON_CONTENT_TYPE);
	// res.send(req.headers);	
});
