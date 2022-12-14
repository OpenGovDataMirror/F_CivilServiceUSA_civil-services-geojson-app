const {app, dialog, shell, BrowserWindow, Menu} = require('electron')

const path = require('path')
const url = require('url')
const dnode = require('dnode')
const settings = require('electron-settings')
const i18n = require('./translations/i18n')

/**
 * CLI Server on Port 5004 to listen for Command Line
 */
const server = dnode({
  open: (s, cb) => {
    try {
      setTimeout(() => {
        let windows = BrowserWindow.getAllWindows()
        if (typeof s.theme !== 'undefined') {
          windows[0].webContents.send('set-theme', s.theme)
        }
      }, 100)

      setTimeout(() => {
        let windows = BrowserWindow.getAllWindows()
        if (typeof s.file !== 'undefined') {
          windows[0].webContents.send('load-file', s.file)
        } else if (typeof s.data !== 'undefined') {
          windows[0].webContents.send('load-data', s.data)
        }
      }, 1000)

    } catch (e) {
      console.error('Error parsing geojson', e)
    }
    cb()
  }
}, { weak: false })

server.listen(5004)

let appIcon
let mainWindow
let lastWindowState
let resizeDebounce

settings.defaults({
  accessToken: null,
  theme: 'dark',
  lastFile: null,
  lastWindowState: {
    width: 1280,
    height: 720,
    maximized: false
  }
})

/**
 * App Menu Template
 * @type array
 */
let menuTemplate = [
  {
    label: i18n.get('menu.geojson.app_menu'),
    submenu: [
      {
        label: i18n.get('menu.geojson.about_geojson'),
        selector: 'orderFrontStandardAboutPanel:'
      },
      {
        type: 'separator'
      },
      {
        label: i18n.get('menu.geojson.view_license'),
        click: (item, focusedWindow) => {
          if (focusedWindow) {
            shell.openExternal('https://raw.githubusercontent.com/CivilServiceUSA/civil-services-geojson-app/master/LICENSE')
          }
        }
      },
      {
        label: i18n.get('menu.geojson.view_open_source'),
        click: (item, focusedWindow) => {
          if (focusedWindow) {
            shell.openExternal('https://github.com/CivilServiceUSA/civil-services-geojson-app')
          }
        }
      },
      {
        label: i18n.get('menu.geojson.version') + ' ' + app.getVersion(),
        enabled: false
      },
      {
        type: 'separator'
      },
      {
        label: i18n.get('menu.geojson.quit'),
        accelerator: 'Command+Q',
        click: () => {
          app.quit()
        }
      }
    ]
  },
  {
    label: i18n.get('menu.file.app_menu'),
    submenu: [
      {
        label: i18n.get('menu.file.open'),
        accelerator: 'CmdOrCtrl+O',
        protected: true,
        click: (item, focusedWindow) => {
          if (focusedWindow) {
            dialog.showOpenDialog({
              filters: [
                {
                  name: 'geojson',
                  extensions: [ 'json', 'geojson' ]
                }
              ]
            }, (fileNames) => {
              if (fileNames === undefined) {
                return;
              }

              focusedWindow.webContents.send('load-file', fileNames[0])
            });
          }
        }
      }
    ]
  },
  {
    label: i18n.get('menu.edit.app_menu'),
    submenu: [
      {
        label: i18n.get('menu.edit.cut'),
        accelerator: 'CmdOrCtrl+X',
        selector: 'cut:'
      },
      {
        label: i18n.get('menu.edit.copy'),
        accelerator: 'CmdOrCtrl+C',
        selector: 'copy:'
      },
      {
        label: i18n.get('menu.edit.paste'),
        accelerator: 'CmdOrCtrl+V',
        selector: 'paste:'
      },
      {
        label: i18n.get('menu.edit.select_all'),
        accelerator: 'CmdOrCtrl+A',
        selector: 'selectAll:'
      }
    ]
  },
  {
    label: i18n.get('menu.view.app_menu'),
    submenu: [
      {
        label: i18n.get('menu.view.reload'),
        accelerator: 'CmdOrCtrl+R',
        click: (item, focusedWindow) => {
          if (focusedWindow) {
            focusedWindow.reload();
          }
        }
      },
      {
        label: i18n.get('menu.view.toggle_full_screen'),
        accelerator: (() => {
          if (process.platform == 'darwin') {
            return 'Ctrl+Command+F';
          } else {
            return 'F11';
          }
        })(),
        click: (item, focusedWindow) => {
          if (focusedWindow)
            focusedWindow.setFullScreen(!focusedWindow.isFullScreen());
        }
      },
      {
        label: i18n.get('menu.view.toggle_developer_tools'),
        accelerator: (() => {
          if (process.platform == 'darwin') {
            return 'Alt+Command+I';
          } else {
            return 'Ctrl+Shift+I';
          }
        })(),
        click: (item, focusedWindow) => {
          if (focusedWindow) {
            focusedWindow.toggleDevTools();
          }
        }
      }
    ]
  },
  {
    label: i18n.get('menu.theme.app_menu'),
    submenu: [
      {
        label: i18n.get('menu.theme.dark'),
        type: 'radio',
        option: 'dark',
        checked: false,
        enabled: false,
        protected: true,
        click: (item, focusedWindow) => {
          if (focusedWindow) {
            focusedWindow.webContents.send('set-theme', 'dark')
          }
        }
      },
      {
        label: i18n.get('menu.theme.light'),
        type: 'radio',
        option: 'light',
        checked: false,
        enabled: false,
        protected: true,
        click: (item, focusedWindow) => {
          if (focusedWindow) {
            focusedWindow.webContents.send('set-theme', 'light')
          }
        }
      },
      {
        label: i18n.get('menu.theme.outdoors'),
        type: 'radio',
        option: 'outdoors',
        checked: false,
        enabled: false,
        protected: true,
        click: (item, focusedWindow) => {
          if (focusedWindow) {
            focusedWindow.webContents.send('set-theme', 'outdoors')
          }
        }
      },
      {
        label: i18n.get('menu.theme.satellite'),
        type: 'radio',
        option: 'satellite',
        checked: false,
        enabled: false,
        protected: true,
        click: (item, focusedWindow) => {
          if (focusedWindow) {
            focusedWindow.webContents.send('set-theme', 'satellite')
          }
        }
      },
      {
        label: i18n.get('menu.theme.streets'),
        type: 'radio',
        option: 'streets',
        checked: false,
        enabled: false,
        protected: true,
        click: (item, focusedWindow) => {
          if (focusedWindow) {
            focusedWindow.webContents.send('set-theme', 'streets')
          }
        }
      },
      {
        label: i18n.get('menu.theme.hybrid'),
        type: 'radio',
        option: 'satellite-streets',
        checked: false,
        enabled: false,
        protected: true,
        click: (item, focusedWindow) => {
          if (focusedWindow) {
            focusedWindow.webContents.send('set-theme', 'satellite-streets')
          }
        }
      }
    ]
  },
  {
    label: i18n.get('menu.window.app_menu'),
    role: 'window',
    submenu: [
      {
        label: i18n.get('menu.window.minimize'),
        accelerator: 'CmdOrCtrl+M',
        role: 'minimize'
      },
      {
        label: i18n.get('menu.window.close'),
        accelerator: 'CmdOrCtrl+W',
        role: 'close'
      },
      {
        label: i18n.get('menu.window.reset_app'),
        accelerator: 'CmdOrCtrl+Shift+R',
        click: (item, focusedWindow) => {
          if (focusedWindow) {
            dialog.showMessageBox({
                type: 'question',
                buttons: [ i18n.get('buttons.yes'), i18n.get('buttons.no') ],
                title: i18n.get('dialog.reset_app.title'),
                message: i18n.get('dialog.reset_app.message'),
                detail: i18n.get('dialog.reset_app.detail'),
                icon: path.join(__dirname, './resources/icon.png')
              }, (option) => {
                if (option === 0) {
                  settings.resetToDefaults().then(() => {
                    app.relaunch({args: process.argv.slice(1).concat(['--relaunch'])})
                    app.exit(0)
                  })
                }
              }
            )
          }
        }
      }
    ]
  }
]

/**
 * Build App Menu
 */
const setMenu = () => {
  if (Menu && typeof Menu.buildFromTemplate !== 'undefined') {
    let appMenu = Menu.buildFromTemplate(menuTemplate)
    Menu.setApplicationMenu(appMenu)
  }
}

/**
 * Update Menu to Show Current Theme
 * @param theme
 */
const setTheme = (theme) => {
  if (!theme) {
    theme = 'dark'
  }

  if (Menu && typeof Menu.getApplicationMenu !== 'undefined') {
    const appMenu = Menu.getApplicationMenu()
    appMenu.items.forEach((item) => {
      if (item.submenu) {
        item.submenu.items.forEach((item) => {
          if (typeof item.checked !== 'undefined' && typeof item.protected !== 'undefined' && typeof item.option !== 'undefined') {
            let checked = (item.option.toString() === theme.toString())
            if (item.checked !== checked) {
              item.checked = checked
            }
          }
        })
      }
    })
  }
}

/**
 * Defines the Apps Ability to support Opening Files - Mapbox Account Token Required before enabling
 * @param enable
 */
const enableOpeningFiles = (enable) => {
  if (Menu && typeof Menu.getApplicationMenu !== 'undefined') {
    const appMenu = Menu.getApplicationMenu()

    if (enable === null) {
      enable = false
    }

    appMenu.items.forEach((item) => {
      if (item.submenu) {
        item.submenu.items.forEach((item) => {
          if (typeof item.protected !== 'undefined') {
            if (item.enabled !== enable) {
              item.enabled = enable
            }
          }
        })
      }
    })
  }
}

/**
 * Create Electron Window
 */
const createWindow = () => {

  mainWindow = new BrowserWindow({
    backgroundColor: '#191919',
    width: 1024,
    height: 768,
    center: true,
    show: false,
    title: 'GeoJSON',
    icon: appIcon
  })

  mainWindow.loadURL(url.format({
    pathname: path.join(__dirname, 'index.html'),
    protocol: 'file:',
    slashes: true
  }))

  setMenu()

  mainWindow.on('resize', () => {
    clearTimeout(resizeDebounce)
    resizeDebounce = setTimeout(storeWindowState, 200)
  })

  mainWindow.on('moved', storeWindowState)

  mainWindow.on('closed', () => {
    mainWindow = null
    process.exit()
  })

  settings.get('lastWindowState').then(lastState => {
    lastWindowState = lastState

    mainWindow.setBounds({
      x: lastState.x,
      y: lastState.y,
      width: lastState.width,
      height: lastState.height
    }, true)

    if (lastState.maximized) {
      mainWindow.maximize()
    }

    mainWindow.show()
  }).catch((error) => {
    mainWindow.show()
  })

  settings.get('accessToken').then(token => {
    let enabled = (token && token.length !== 0)
    enableOpeningFiles(enabled)
  })

  settings.get('theme').then(currentTheme => {
    setTheme(currentTheme)
  })
}

/**
 * Store Window State
 * Triggered after Window Resize & Move
 */
const storeWindowState = () => {
  let bounds = mainWindow.getBounds()
  settings.set('lastWindowState', {
    x: bounds.x,
    y: bounds.y,
    width: bounds.width,
    height: bounds.height,
    maximized: mainWindow.isMaximized()
  })
}

/**
 * Check if we are already running this app
 */
const shouldQuit = app.makeSingleInstance(() => {
  if (mainWindow) {
    if (mainWindow.isMinimized()) {
      mainWindow.restore()
    }
    mainWindow.focus()
  }
})

if (shouldQuit) {
  app.quit()
}

app.on('will-finish-launching', () => {
  app.on('open-file', (ev, path) => {

    console.log(path)

    if (mainWindow) {
      mainWindow.webContents.send('load-file', path)
    }

    ev.preventDefault()
  })
})

/**
 * Initialize Electron App
 */
app.on('ready', createWindow)


/**
 * Check if app is closed and quit it from running in the background
 */
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

/**
 * Recreate Window if not initialized
 */
app.on('activate', () => {
  if (mainWindow === null) {
    createWindow()
  }
})