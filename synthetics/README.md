### Test Harness

Canaries can be run locally using a test harness (thanks to GOV.UK Pay for coming up with this!)

From the root folder of the project use `npm install` to get the required dependencies.

Run the tests locally with `node synthetics/index.js --test check-hmrc-success`. Provide the name
of the test you want to run with the `--test` flag. It will print out the valid
test names if none is provided or an invalid name is given.

To run the tests in a headless mode use the `--headless` flag.

Example:

> node synthetics/index.js --test check-hmrc-success --headless
