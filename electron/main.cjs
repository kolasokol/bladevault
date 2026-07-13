const { app, BrowserWindow, Menu, clipboard, dialog, ipcMain, shell } = require('electron')
const { spawn } = require('child_process')
const fs = require('fs')
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

let mainWindow = null
let serverProcess = null
let serverOrigin = null
let isQuitting = false

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
    return parsed.protocol === 'https:' && parsed.pathname.startsWith('/auth/')
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
