import jest from "jest";
import { TestEnvironment } from "jest-environment-node";
import { Circus } from "@jest/types";
import { JestEnvironmentConfig, EnvironmentContext } from "@jest/environment";
import {
  createSfnClient,
  createTestContainer,
  SfnContainerHelper,
} from "../step-functions/mocked/nino-check/sfn-container-helper";

export default class CustomTestEnvironment extends TestEnvironment {
  constructor(config: JestEnvironmentConfig, context: EnvironmentContext) {
    super(config, context);
  }

  async setup() {
    const requestStartTime = Math.floor(performance.now());

    this.global.sfnContainerHelper = new SfnContainerHelper(
      createTestContainer(),
      createSfnClient()
    );

    const requestEndTime = Math.floor(performance.now());
    const containerStartDuration = requestEndTime - requestStartTime;

    if (this.global && typeof this.global.setTimeout === "function") {
      this.global.setTimeout(() => {}, containerStartDuration);
    } else if (typeof global.setTimeout === "function") {
      global.setTimeout(() => {}, containerStartDuration);
    }

    //if (typeof jest !== "undefined" && typeof jest.setTimeout === "function") {
    jest.setTimeout(10000);
    //}

    this.global.testStartTime = Math.floor(performance.now());

    this.global.timeoutMonitor = setInterval(() => {
      const currentTime = Math.floor(performance.now());
      const testDuration = currentTime - this.global.testStartTime;

      if (testDuration > 4000) {
        const newTimeout = testDuration + 3000;

        if (
          typeof jest !== "undefined" &&
          typeof jest.setTimeout === "function"
        ) {
          jest.setTimeout(newTimeout);
          // eslint-disable-next-line no-console
          console.log(`Extended timeout to ${newTimeout}ms`);
        }
      }
    }, 1000);

    await super.setup();
  }

  async teardown() {
    if (this.global.sfnContainerHelper) {
      await (this.global.sfnContainerHelper as SfnContainerHelper).shutDown();
    }

    if (this.global.timeoutMonitor) {
      clearInterval(this.global.timeoutMonitor as NodeJS.Timeout);
    }

    await super.teardown();
  }

  async handleTestEvent(event: Circus.Event, _state: Circus.State) {
    if (event.name === "test_start") {
      this.global.testStartTime = Math.floor(performance.now());
      if (
        typeof jest !== "undefined" &&
        typeof jest.setTimeout === "function"
      ) {
        // eslint-disable-next-line no-console
        console.log(`Set to Default: ${1000}`);
        jest.setTimeout(10000);
      }
    }

    if (event.name === "test_done") {
      this.global.testEndTime = Math.floor(performance.now());
      const testDuration = this.global.testEndTime - this.global.testStartTime;

      // eslint-disable-next-line no-console
      console.log(`Test took ${testDuration}ms`);

      // If the test ran longer than expected, ensure it was extended
      const defaultTimeout = 10000;

      if (testDuration > defaultTimeout) {
        const newTimeout = testDuration + 3000;
        // eslint-disable-next-line no-console
        console.log(`About to add buffer time after the test: ${newTimeout}`);
        if (
          typeof jest !== "undefined" &&
          typeof jest.setTimeout === "function"
        ) {
          jest.setTimeout(newTimeout);
          // eslint-disable-next-line no-console
          console.log(`Dynamically extended timeout to ${newTimeout}ms`);
        }
      }
    }
  }
}
