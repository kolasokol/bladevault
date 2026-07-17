const {
  app,
  BrowserWindow,
  Menu,
  clipboard,
  dialog,
  ipcMain,
  shell,
} = require('electron')
const { spawn } = require('child_process')
const crypto = require('crypto')
const fs = require('fs')
const https = require('https')
const os = require('os')
const path = require('path')
const net = require('net')

const DEV_SERVER_URL = process.env.ELECTRON_START_URL || 'http://127.0.0.1:3000'
const DEV_SERVER_ORIGIN = new URL(DEV_SERVER_URL).origin
const FORCE_PRODUCTION_SERVER = process.env.BLADEVAULT_FORCE_PROD_SERVER === '1'
const SMOKE_TEST_MODE = process.env.BLADEVAULT_SMOKE_TEST === '1'
const PREFERRED_DESKTOP_PORT = Number.parseInt(
  process.env.BLADEVAULT_DESKTOP_PORT || '3000',
  10,
)
const FALLBACK_CLOUD_AUTH_URL = 'https://auth.bladevault.pro'

function getCloudAuthUrl() {
  const fromEnv = process.env.NEXT_PUBLIC_BLADEVAULT_AUTH_URL?.trim()
  if (fromEnv) {
    let normalized = fromEnv
    if (!/^https?:\/\//i.test(normalized)) {
      normalized = `https://${normalized}`
    }
    return normalized.replace(/\/$/, '')
  }
  return FALLBACK_CLOUD_AUTH_URL
}

let mainWindow = null
let serverProcess = null
let serverOrigin = null
let isQuitting = false
let isInstallingUpdate = false
let updateStatus = { status: 'idle' }

function publishUpdateStatus(nextStatus) {
  updateStatus = { ...nextStatus, platform: process.platform }
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('bladevault:update-status', updateStatus)
  }
}

function compareVersions(left, right) {
  const parse = (version) => version.replace(/^v/, '').split('.').map(Number)
  const leftParts = parse(left)
  const rightParts = parse(right)

  for (let index = 0; index < 3; index += 1) {
    const difference = (leftParts[index] || 0) - (rightParts[index] || 0)
    if (difference !== 0) return difference
  }

  return 0
}

function requestJson(url) {
  return new Promise((resolve, reject) => {
    https
      .get(
        url,
        { headers: { 'User-Agent': 'BladeVault desktop updater' } },
        (response) => {
          if (
            response.statusCode &&
            response.statusCode >= 300 &&
            response.statusCode < 400 &&
            response.headers.location
          ) {
            response.resume()
            requestJson(response.headers.location).then(resolve, reject)
            return
          }

          let body = ''
          response.setEncoding('utf8')
          response.on('data', (chunk) => {
            body += chunk
          })
          response.on('end', () => {
            if (response.statusCode !== 200) {
              reject(new Error(`GitHub returned HTTP ${response.statusCode}.`))
              return
            }

            try {
              resolve(JSON.parse(body))
            } catch {
              reject(new Error('GitHub returned invalid release metadata.'))
            }
          })
        },
      )
      .on('error', reject)
  })
}

function downloadFile(url, destination) {
  return new Promise((resolve, reject) => {
    const request = https.get(
      url,
      { headers: { 'User-Agent': 'BladeVault desktop updater' } },
      (response) => {
        if (
          response.statusCode &&
          response.statusCode >= 300 &&
          response.statusCode < 400 &&
          response.headers.location
        ) {
          response.resume()
          downloadFile(response.headers.location, destination).then(
            resolve,
            reject,
          )
          return
        }

        if (response.statusCode !== 200) {
          response.resume()
          reject(new Error(`Download failed with HTTP ${response.statusCode}.`))
          return
        }

        const file = fs.createWriteStream(destination)
        const hash = crypto.createHash('sha256')
        let transferred = 0
        const total = Number(response.headers['content-length'] || 0)

        response.on('data', (chunk) => {
          transferred += chunk.length
          hash.update(chunk)
          publishUpdateStatus({
            status: 'downloading',
            percent: total ? Math.round((transferred / total) * 100) : null,
          })
        })
        response.pipe(file)
        file.on('finish', () => {
          file.close(() => resolve({ sha256: hash.digest('hex') }))
        })
        file.on('error', (error) => {
          file.destroy()
          reject(error)
        })
      },
    )
    request.on('error', reject)
  })
}

function getUpdateAssetName() {
  if (process.platform === 'darwin') return 'BladeVault.dmg'
  if (process.platform === 'win32') return 'BladeVault.exe'
  return null
}

async function checkPlatformUpdate() {
  const release = await requestJson(
    'https://api.github.com/repos/dedkola/bladevault/releases/latest',
  )
  const version = String(release.tag_name || '').replace(/^v/, '')

  if (!version || compareVersions(version, app.getVersion()) <= 0) {
    publishUpdateStatus({
      status: 'not-available',
      currentVersion: app.getVersion(),
    })
    return updateStatus
  }

  const assetName = getUpdateAssetName()
  const asset = Array.isArray(release.assets)
    ? release.assets.find((candidate) => candidate.name === assetName)
    : null
  if (!asset?.browser_download_url) {
    throw new Error(`The latest release does not contain ${assetName}.`)
  }

  publishUpdateStatus({
    status: 'available',
    version,
    releaseUrl: release.html_url,
    downloadUrl: asset.browser_download_url,
  })
  return updateStatus
}

async function downloadPlatformUpdate() {
  const release = await requestJson(
    'https://api.github.com/repos/dedkola/bladevault/releases/latest',
  )
  const version = String(release.tag_name || '').replace(/^v/, '')
  const assetName = getUpdateAssetName()
  const asset = Array.isArray(release.assets)
    ? release.assets.find((candidate) => candidate.name === assetName)
    : null
  if (!asset?.browser_download_url || !version) {
    throw new Error(`The latest release does not contain ${assetName}.`)
  }

  const extension = process.platform === 'win32' ? 'exe' : 'dmg'
  const destination = path.join(
    os.tmpdir(),
    `BladeVault-${version}.${extension}`,
  )
  fs.rmSync(destination, { force: true })
  const result = await downloadFile(asset.browser_download_url, destination)
  const expectedDigest = String(asset.digest || '')
    .replace(/^sha256:/, '')
    .toLowerCase()
  if (expectedDigest && expectedDigest !== result.sha256.toLowerCase()) {
    fs.rmSync(destination, { force: true })
    throw new Error('The downloaded update failed its SHA-256 integrity check.')
  }
  publishUpdateStatus({
    status: 'downloaded',
    version,
    path: destination,
    sha256: result.sha256,
  })
  if (process.platform === 'darwin') {
    const openError = await shell.openPath(destination)
    if (openError) {
      throw new Error(`Failed to open downloaded update: ${openError}`)
    }
  }
  return updateStatus
}

function installDownloadedUpdate() {
  if (isInstallingUpdate) {
    return updateStatus
  }

  if (updateStatus.status !== 'downloaded' || !updateStatus.path) {
    throw new Error('No downloaded update is ready to install yet.')
  }

  if (process.platform !== 'win32') {
    return updateStatus
  }

  const installerPath = updateStatus.path
  if (!fs.existsSync(installerPath)) {
    throw new Error(
      'Downloaded installer was not found. Please download again.',
    )
  }

  isInstallingUpdate = true
  app.once('will-quit', () => {
    const installer = spawn(installerPath, [], {
      detached: true,
      stdio: 'ignore',
      windowsHide: false,
    })
    installer.unref()
  })
  app.quit()
  return updateStatus
}

async function checkForUpdates() {
  publishUpdateStatus({ status: 'checking' })
  if (getUpdateAssetName()) return checkPlatformUpdate()
  publishUpdateStatus({
    status: 'not-available',
    currentVersion: app.getVersion(),
  })
  return updateStatus
}

async function downloadUpdate() {
  if (getUpdateAssetName()) return downloadPlatformUpdate()
  return updateStatus
}

function isUsingEmbeddedServer() {
  return app.isPackaged || FORCE_PRODUCTION_SERVER
}

function getStandaloneDir() {
  if (app.isPackaged) {
    const unpackedStandaloneDir = path.join(
      process.resourcesPath,
      'app.asar.unpacked',
      '.next',
      'standalone',
    )

    if (fs.existsSync(unpackedStandaloneDir)) {
      return unpackedStandaloneDir
    }
  }

  return path.join(app.getAppPath(), '.next', 'standalone')
}

function getServerEntry() {
  return path.join(getStandaloneDir(), 'server.js')
}

function getServerWorkingDir() {
  return getStandaloneDir()
}

function getNodeExecPath() {
  if (app.isPackaged && process.platform === 'darwin') {
    const helperName = `${app.getName()} Helper`
    const helperExecPath = path.join(
      process.resourcesPath,
      '..',
      'Frameworks',
      `${helperName}.app`,
      'Contents',
      'MacOS',
      helperName,
    )

    if (fs.existsSync(helperExecPath)) {
      return helperExecPath
    }
  }

  return process.execPath
}

function getPreloadPath() {
  return path.join(__dirname, 'preload.cjs')
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function isLocalAppUrl(url) {
  if (!serverOrigin) {
    try {
      return new URL(url).origin === DEV_SERVER_ORIGIN
    } catch {
      return false
    }
  }

  try {
    return new URL(url).origin === serverOrigin
  } catch {
    return false
  }
}

function isAllowedPopupUrl(url) {
  if (url === 'about:blank') {
    return true
  }

  try {
    const parsed = new URL(url)
    const allowedOrigin = new URL(getCloudAuthUrl()).origin
    return (
      parsed.protocol === 'https:' &&
      parsed.origin === allowedOrigin &&
      parsed.pathname.startsWith('/auth/')
    )
  } catch {
    return false
  }
}

function reservePort(port) {
  return new Promise((resolve, reject) => {
    const server = net.createServer()
    server.unref()
    server.on('error', reject)
    server.listen(port, '127.0.0.1', () => {
      const address = server.address()
      if (!address || typeof address === 'string') {
        server.close(() => reject(new Error('Failed to reserve a local port.')))
        return
      }

      const { port } = address
      server.close((error) => {
        if (error) {
          reject(error)
          return
        }
        resolve(port)
      })
    })
  })
}

async function getPreferredPort() {
  if (Number.isInteger(PREFERRED_DESKTOP_PORT) && PREFERRED_DESKTOP_PORT > 0) {
    try {
      return await reservePort(PREFERRED_DESKTOP_PORT)
    } catch (error) {
      if (!(
        error &&
        typeof error === 'object' &&
        'code' in error &&
        error.code === 'EADDRINUSE'
      )) {
        throw error
      }
    }
  }

  return reservePort(0)
}

async function waitForServer(url, timeoutMs = 45000) {
  const deadline = Date.now() + timeoutMs

  while (Date.now() < deadline) {
    try {
      const response = await fetch(url, { cache: 'no-store' })
      if (response.ok) {
        return
      }
    } catch {
      // Server is still starting up.
    }

    if (serverProcess && serverProcess.exitCode !== null) {
      throw new Error(
        `Embedded server exited early with code ${serverProcess.exitCode}.`,
      )
    }

    await delay(400)
  }

  throw new Error(`Timed out waiting for BladeVault to start at ${url}.`)
}

async function startEmbeddedServer() {
  const serverEntry = getServerEntry()
  if (!fs.existsSync(serverEntry)) {
    throw new Error(
      `Missing desktop server build at ${serverEntry}. Run "npm run build:desktop" first.`,
    )
  }

  const port = await getPreferredPort()
  const env = {
    ...process.env,
    ELECTRON_RUN_AS_NODE: '1',
    HOSTNAME: '127.0.0.1',
    NEXT_TELEMETRY_DISABLED: '1',
    NODE_ENV: 'production',
    PORT: String(port),
  }

  serverProcess = spawn(getNodeExecPath(), [serverEntry], {
    cwd: getServerWorkingDir(),
    env,
    stdio: ['ignore', 'pipe', 'pipe'],
  })

  serverProcess.stdout.on('data', (chunk) => {
    process.stdout.write(`[bladevault-server] ${chunk}`)
  })

  serverProcess.stderr.on('data', (chunk) => {
    process.stderr.write(`[bladevault-server] ${chunk}`)
  })

  serverProcess.once('exit', (code) => {
    if (!isQuitting && mainWindow && !mainWindow.isDestroyed()) {
      dialog.showErrorBox(
        'BladeVault server stopped',
        `The embedded BladeVault server exited with code ${code ?? 'unknown'}.`,
      )
      mainWindow.close()
    }
  })

  const url = `http://127.0.0.1:${port}`
  await waitForServer(url)
  serverOrigin = new URL(url).origin
  return url
}

function stopEmbeddedServer() {
  if (!serverProcess) {
    return
  }

  serverProcess.kill()
  serverProcess = null
}

function getEditableContextMenuTemplate(editFlags) {
  return [
    {
      role: 'undo',
      enabled: editFlags.canUndo,
    },
    {
      role: 'redo',
      enabled: editFlags.canRedo,
    },
    {
      type: 'separator',
    },
    {
      role: 'cut',
      enabled: editFlags.canCut,
    },
    {
      role: 'copy',
      enabled: editFlags.canCopy,
    },
    {
      role: 'paste',
      enabled: editFlags.canPaste,
    },
    {
      role: 'delete',
      enabled: editFlags.canDelete,
    },
    {
      type: 'separator',
    },
    {
      role: 'selectAll',
      enabled: editFlags.canSelectAll,
    },
  ]
}

function buildAppContextMenu(window, params) {
  const hasSelection = params.selectionText.trim().length > 0
  const canCopySelection = params.isEditable
    ? params.editFlags.canCopy
    : hasSelection
  const template = [
    ...getEditableContextMenuTemplate({
      ...params.editFlags,
      canCopy: canCopySelection,
    }),
    {
      type: 'separator',
    },
    {
      label: 'Open Link in Browser',
      enabled: Boolean(params.linkURL),
      click: () => {
        if (!params.linkURL) {
          return
        }

        void shell.openExternal(params.linkURL)
      },
    },
    {
      label: 'Copy Link Address',
      enabled: Boolean(params.linkURL),
      click: () => {
        if (!params.linkURL) {
          return
        }

        clipboard.writeText(params.linkURL)
      },
    },
    {
      type: 'separator',
    },
    {
      label: 'Back',
      enabled: window.webContents.canGoBack(),
      click: () => {
        if (!window.webContents.canGoBack()) {
          return
        }

        window.webContents.goBack()
      },
    },
    {
      label: 'Forward',
      enabled: window.webContents.canGoForward(),
      click: () => {
        if (!window.webContents.canGoForward()) {
          return
        }

        window.webContents.goForward()
      },
    },
    {
      label: 'Reload',
      accelerator: 'CmdOrCtrl+R',
      click: () => {
        window.webContents.reload()
      },
    },
  ]

  return Menu.buildFromTemplate(template)
}

function wireAppContextMenu(window) {
  window.webContents.on('context-menu', (_event, params) => {
    const menu = buildAppContextMenu(window, params)
    menu.popup({
      window,
      x: params.x,
      y: params.y,
      frame: params.frame ?? undefined,
    })
  })
}

function wireMainWindowSecurity(window) {
  window.webContents.on('will-navigate', (event, url) => {
    if (isLocalAppUrl(url)) {
      return
    }

    event.preventDefault()
    void shell.openExternal(url)
  })

  window.webContents.setWindowOpenHandler(({ url }) => {
    if (isAllowedPopupUrl(url)) {
      return {
        action: 'allow',
        overrideBrowserWindowOptions: {
          autoHideMenuBar: true,
          height: 720,
          parent: window,
          title: 'BladeVault Sign In',
          width: 520,
          webPreferences: {
            contextIsolation: true,
            nodeIntegration: false,
            sandbox: true,
          },
        },
      }
    }

    void shell.openExternal(url)
    return { action: 'deny' }
  })
}

ipcMain.handle('bladevault:select-directory', async () => {
  const result = await dialog.showOpenDialog(mainWindow ?? undefined, {
    buttonLabel: 'Use Folder',
    properties: ['createDirectory', 'openDirectory'],
    title: 'Choose BladeVault Data Folder',
  })

  if (result.canceled) {
    return null
  }

  return result.filePaths[0] ?? null
})

ipcMain.handle('bladevault:get-update-status', () => updateStatus)
ipcMain.handle('bladevault:check-for-updates', () => checkForUpdates())
ipcMain.handle('bladevault:download-update', () => downloadUpdate())
ipcMain.handle('bladevault:install-update', () => installDownloadedUpdate())
async function createMainWindow() {
  const startUrl = isUsingEmbeddedServer()
    ? await startEmbeddedServer()
    : DEV_SERVER_URL

  if (!serverOrigin) {
    serverOrigin = new URL(startUrl).origin
  }

  mainWindow = new BrowserWindow({
    autoHideMenuBar: true,
    backgroundColor: '#121510',
    height: 960,
    minHeight: 760,
    minWidth: 760,
    show: false,
    title: 'BladeVault',
    width: 1440,
    webPreferences: {
      backgroundThrottling: false,
      contextIsolation: true,
      nodeIntegration: false,
      preload: getPreloadPath(),
      sandbox: true,
    },
  })

  wireMainWindowSecurity(mainWindow)

  mainWindow.once('ready-to-show', () => {
    mainWindow.show()
    mainWindow.webContents.send('bladevault:update-status', updateStatus)
  })

  if (SMOKE_TEST_MODE) {
    const timeout = setTimeout(() => {
      process.exitCode = 1
      app.quit()
    }, 60000)

    mainWindow.webContents.once('did-finish-load', () => {
      clearTimeout(timeout)
      setTimeout(() => app.quit(), 1200)
    })
  }

  await mainWindow.loadURL(startUrl)
}

app.on('before-quit', () => {
  isQuitting = true
  stopEmbeddedServer()
})

app.on('browser-window-created', (_event, window) => {
  wireAppContextMenu(window)
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

app.on('activate', async () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    try {
      await createMainWindow()
    } catch (error) {
      dialog.showErrorBox(
        'BladeVault failed to start',
        error instanceof Error ? error.message : 'Unknown error',
      )
      app.quit()
    }
  }
})

app
  .whenReady()
  .then(async () => {
    try {
      await createMainWindow()
      void checkForUpdates().catch((error) => {
        publishUpdateStatus({ status: 'error', message: error.message })
      })
    } catch (error) {
      dialog.showErrorBox(
        'BladeVault failed to start',
        error instanceof Error ? error.message : 'Unknown error',
      )
      app.quit()
    }
  })
  .catch((error) => {
    dialog.showErrorBox(
      'BladeVault failed to start',
      error instanceof Error ? error.message : 'Unknown error',
    )
    app.quit()
  })
