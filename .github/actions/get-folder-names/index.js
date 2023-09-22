const core = require('@actions/core');
const fs = require('fs');

try {
    const path = core.getInput('path');
    const folderNames = fs.readdirSync(path);
    if (folderNames.length === 0) throw new Error(`No directories found in path: ${path}`)
    core.setOutput("folder-names", JSON.parse(folderNames));
  } catch (error) {
    core.setFailed(error.message);
  }