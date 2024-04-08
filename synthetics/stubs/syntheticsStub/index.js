// eslint-disable-next-line @typescript-eslint/no-var-requires
const puppeteer = require("puppeteer");

module.exports = function init(headless = false) {
  return {
    getPage: async () => {
      let page;
      const browser = await puppeteer.launch({
        headless,
        args: ["--disable-features=IsolateOrigins,site-per-process"],
        defaultViewport: {
          width: 1024,
          height: 768,
        },
      });
      const pages = await browser.pages();
      if (pages.length <= 1) {
        page = await browser.newPage();
      }
      return page;
    },
    executeStep: async (_step = null, stepFunc) => {
      try {
        await stepFunc();
      } catch (e) {
        // eslint-disable-next-line no-console
        console.error(e);
      }
    },
    getConfiguration: () => {
      return {
        setConfig: () => ({}),
        disableStepScreenshots: () => ({}),
        enableStepScreenshots: () => ({}),
      };
    },
  };
};
