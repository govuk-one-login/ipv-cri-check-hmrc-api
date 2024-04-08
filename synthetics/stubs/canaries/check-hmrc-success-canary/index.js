// eslint-disable-next-line @typescript-eslint/no-var-requires
const synthetics = require("Synthetics");
// eslint-disable-next-line @typescript-eslint/no-var-requires
const log = require("SyntheticsLogger");

const recordedScript = async function () {
  const page = await synthetics.getPage();

  const navigationPromise = page.waitForNavigation();

  await synthetics.executeStep("Visit Core Stub", async function () {
    log.info("User about to visit core.stubs.account.gov.uk");
    await page.goto(
      "https://user:XXXXXX@cri.core.stubs.account.gov.uk", //pragma: allowlist secret
      { waitUntil: "domcontentloaded", timeout: 60000 }
    );
    await page.setViewport({ width: 1364, height: 695 });

    log.info(`Arrived at ${page.url()}`);
  });

  log.info("Click on Credential Issuers");
  await synthetics.executeStep(
    "Click on Credential Issuers",
    async function () {
      await page.waitForSelector(
        ".govuk-width-container > #main-content > p > a > .govuk-button"
      );
      await page.click(
        ".govuk-width-container > #main-content > p > a > .govuk-button"
      );
    }
  );

  await navigationPromise;
  log.info("Click on HMRC Check CRI Build");
  await synthetics.executeStep(
    "Click on HMRC Check CRI Build",
    async function () {
      await page.waitForSelector(
        ".govuk-width-container > #main-content > p:nth-child(4) > a > .govuk-button"
      );
      await page.click(
        ".govuk-width-container > #main-content > p:nth-child(4) > a > .govuk-button"
      );
    }
  );

  await navigationPromise;
  log.info("About to Click on New User Hyperlink");

  await synthetics.executeStep("Click New User Hyperlink", async function () {
    await page.waitForSelector(
      "#main-content > div.govuk-\\!-padding-bottom-9 > legend > a"
    );
    await page.click(
      "#main-content > div.govuk-\\!-padding-bottom-9 > legend > a"
    );
  });
  log.info(`Arrived at ${page.url()}`);

  await navigationPromise;

  await synthetics.executeStep("Click_3", async function () {
    await page.waitForSelector(
      ".govuk-width-container > #main-content #firstName"
    );
    await page.click(".govuk-width-container > #main-content #firstName");
  });

  log.info("Set firstName to Error");
  await synthetics.executeStep("Type_4", async function () {
    await page.type(
      ".govuk-width-container > #main-content #firstName",
      "Error"
    );
  });

  await synthetics.executeStep("Click_5", async function () {
    await page.waitForSelector(
      ".govuk-width-container > #main-content #surname"
    );
    await page.click(".govuk-width-container > #main-content #surname");
  });

  log.info("Set firstName to Deceased");
  await synthetics.executeStep("Type_6", async function () {
    await page.type(
      ".govuk-width-container > #main-content #surname",
      "Deceased"
    );
  });

  await synthetics.executeStep("Click_7", async function () {
    await page.waitForSelector(
      ".govuk-template__body > .govuk-width-container > #main-content > form > .govuk-button"
    );
    await page.click(
      ".govuk-template__body > .govuk-width-container > #main-content > form > .govuk-button"
    );
  });

  await navigationPromise;

  await synthetics.executeStep("Click_8", async function () {
    await page.waitForSelector(".govuk-grid-row #nationalInsuranceNumber");
    await page.click(".govuk-grid-row #nationalInsuranceNumber");
  });
  log.info(`Arrived at ${page.url()}`);

  log.info("Set #nationalInsuranceNumber to AA123456C");
  await synthetics.executeStep("Type_9", async function () {
    await page.type(".govuk-grid-row #nationalInsuranceNumber", "AA123456C");
  });

  await synthetics.executeStep("Click_10", async function () {
    await page.waitForSelector("#main-content #continue");
    await page.click("#main-content #continue");
  });

  await navigationPromise;

  log.info("What would you like to do?");
  await synthetics.executeStep("Click_11", async function () {
    await page.waitForSelector(
      ".govuk-form-group > #retryNationalInsuranceRadio-fieldset #retryNationalInsuranceRadio"
    );
    log.info(`About to Click on Continue on ${page.url()}`);

    await page.click(
      ".govuk-form-group > #retryNationalInsuranceRadio-fieldset #retryNationalInsuranceRadio"
    );
  });

  log.info("Set #retryNationalInsuranceRadio to retryNationalInsurance");
  await synthetics.executeStep("Type_12", async function () {
    await page.type(
      ".govuk-form-group > #retryNationalInsuranceRadio-fieldset #retryNationalInsuranceRadio",
      "retryNationalInsurance"
    );
  });

  log.info(`About to click continue button on ${page.url()}`);
  await synthetics.executeStep("Click_13", async function () {
    await page.waitForSelector("#main-content #continue");
    await page.click("#main-content #continue");
  });

  await navigationPromise;

  await synthetics.executeStep("Click_14", async function () {
    await page.waitForSelector("#main-content #continue");
    await page.click("#main-content #continue");
  });

  await navigationPromise;

  // Wait for the element to be visible
  await page.waitForSelector("#main-content > div > details > summary > span", {
    timeout: 3000,
  });
  // Click on the element
  await page.click("#main-content > div > details > summary > span");
  await new Promise((resolve) => setTimeout(resolve, 2000)); // 2000 milliseconds = 3 seconds

  await synthetics.executeStep("GetData", async function () {
    const data = await page.evaluate(() => {
      // eslint-disable-next-line no-undef
      const element = document.querySelector("[id='data']");
      return element.textContent.trim();
    });

    log.info("Extracted data:", data);
  });
  await new Promise((resolve) => setTimeout(resolve, 2000)); // 3000 milliseconds = 3 seconds

  await navigationPromise;
};
exports.handler = async () => {
  return await recordedScript();
};
