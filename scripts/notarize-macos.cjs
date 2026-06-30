const path = require('path');

async function runNotarization(context) {
  if (process.platform !== 'darwin') {
    return;
  }

  const { notarize } = require('@electron/notarize');

  const {
    APPLE_APP_SPECIFIC_PASSWORD,
    APPLE_ID,
    APPLE_TEAM_ID,
  } = process.env;

  if (!APPLE_ID || !APPLE_APP_SPECIFIC_PASSWORD || !APPLE_TEAM_ID) {
    throw new Error(
      'Missing Apple notarization credentials. Set APPLE_ID, APPLE_APP_SPECIFIC_PASSWORD, and APPLE_TEAM_ID.'
    );
  }

  const appName = context.packager.appInfo.productFilename;
  const appPath = path.join(context.appOutDir, `${appName}.app`);

  await notarize({
    appBundleId: context.packager.appInfo.id,
    appPath,
    appleId: APPLE_ID,
    appleIdPassword: APPLE_APP_SPECIFIC_PASSWORD,
    teamId: APPLE_TEAM_ID,
  });
}

module.exports = runNotarization;
