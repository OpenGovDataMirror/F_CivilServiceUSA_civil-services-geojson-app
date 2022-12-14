const { shell, ipcRenderer } = require('electron')
const settings = require('electron-settings')
const {app, BrowserWindow, Menu} = require('electron').remote

const fs = require('fs')
const JSONStream = require('JSONStream')
const geojsonExtent = require('geojson-extent')
const geojsonNormalize = require('geojson-normalize')

const util = require('./libs/util')
const i18n = require('./translations/i18n')

let accessToken
let map
let theme
let drawerInterval
let mapLayers = []

/**
 * Listen for Theme Selection for Main Menu
 */
ipcRenderer.on('set-theme', (event, style) => {
  settings.set('theme', style).then(() => {

    theme = style

    let themeFile = require('./themes/' + style + '.json')
    map.setStyle(themeFile)

    document.body.className = style

    settings.get('lastFile').then(file => {
      if (file) {
        loadFile(file)
      }
    })
  })
})

/**
 * Listen for Load GeoJSON File Requests
 */
ipcRenderer.on('load-file', (event, fileName) => {
  console.log('Load File')
  loadFile(fileName)
})


/**
 * Listen for Load GeoJSON Data Requests
 */
ipcRenderer.on('load-data', (event, fileData) => {
  console.log('Load Data')
  renderData(fileData)
})

/**
 * Listen for Window Errors
 */
ipcRenderer.on('window-error', function(event, data){
  showError('<button id="inspect-button"><i class="fa fa-fw fa-code"></i> ' + i18n.get('buttons.inspect') + '</button>' + data.error)
})

/**
 * Load Translation Text into HTML
 */
window.addEventListener('load', () => {
  let token = document.getElementById('token')
  let submitButton = document.getElementById('submit-token')
  let getAccessToken = document.getElementById('get-access-token')
  let poweredBy = document.getElementById('powered-by')
  let builtWithLabel = document.getElementById('built-with-label')
  let drawerTitle = document.getElementById('drawer-header-title')

  let getStartedTitle = document.getElementById('get-started-title')
  let getStartedMessage = document.getElementById('get-started-message')
  let getStartedMethod1 = document.getElementById('get-started-method-1')
  let getStartedMethod2 = document.getElementById('get-started-method-2')
  let getStartedMethod3 = document.getElementById('get-started-method-3')

  token.setAttribute('placeholder', i18n.get('page.placeholder'))
  submitButton.innerHTML = i18n.get('page.go_button')
  getAccessToken.innerHTML = i18n.get('page.get_access_token')
  poweredBy.innerHTML = i18n.get('page.created_by')
  builtWithLabel.innerHTML = i18n.get('page.built_with')
  drawerTitle.innerHTML = i18n.get('page.drawer_header_title')

  getStartedTitle.innerHTML = i18n.get('page.get_started_title')
  getStartedMessage.innerHTML = i18n.get('page.get_started_message')
  getStartedMethod1.innerHTML = i18n.get('page.get_started_method_1')
  getStartedMethod2.innerHTML = i18n.get('page.get_started_method_2')
  getStartedMethod3.innerHTML = i18n.get('page.get_started_method_3')

}, false)

/**
 * Listen for Dropping File on Window
 */
document.addEventListener('drop', (e) => {
  if (!accessToken) {
    e.preventDefault()
    e.stopPropagation()
    return
  }

  document.getElementById('drop-zone').style.display = 'none'

  e.preventDefault()
  e.stopPropagation()

  let file = (e.dataTransfer.files) ? e.dataTransfer.files[0] : null
  let details = {
    lastModified: file.lastModified || null,
    lastModifiedDate: file.lastModifiedDate || null,
    name: file.name || null,
    path: file.path || null,
    type: file.type || file.name.substring(file.name.indexOf('.') + 1)
  }

  if (details.type === 'json' || details.type === 'geojson') {
    app.focus()
    loadFile(details.path)
  } else {
    showError(i18n.get('errors.not_geojson_file'))
  }

  return false
}, false)

/**
 * Listen for Dragging a File over Window
 */
document.addEventListener('dragover', (e) => {

  hideGettingStarted()

  if (!accessToken) {
    e.preventDefault()
    e.stopPropagation()
    return
  }

  document.getElementById('drop-zone').style.display = 'block'
  e.preventDefault()
  e.stopPropagation()
  e.dataTransfer.dropEffect = 'copy'
}, false)

/**
 * Listen for Mouse Leaving Page
 */
document.addEventListener('mouseleave', (e) => {
  document.getElementById('drop-zone').style.display = 'none'
}, false)

/**
 * Change whether Application is Ready to Open Files
 * @param enable
 */
const enableOpeningFiles = (enable) => {
  if (Menu && typeof Menu.getApplicationMenu !== 'undefined') {
    const appMenu = Menu.getApplicationMenu()

    if (enable === null) {
      enable = false
    }

    appMenu.items.forEach(function (item) {
      if (item.submenu) {
        item.submenu.items.forEach(function (item) {
          if (typeof item.protected !== 'undefined') {
            item.enabled = enable
          }
        })
      }
    })
  }
}

/**
 * Show Error Message
 * @param error
 */
const showError = (error) => {
  let errorMessageDiv = document.getElementById('error-message')
  let errorDiv = document.getElementById('error')
  let closeErrorButton = document.getElementById('close-error')

  errorMessageDiv.innerHTML = error
  errorDiv.style.display = 'block'

  closeErrorButton.removeEventListener('click', closeError, false)
  closeErrorButton.addEventListener('click', closeError, false)

  let focusedWindow = BrowserWindow.getFocusedWindow()
  let inspectButton = document.getElementById('inspect-button')

  if (inspectButton) {
    let handler = (e) => {
      e.preventDefault()
      e.stopPropagation()
      focusedWindow.openDevTools()
    }

    inspectButton.removeEventListener('click', handler, false)
    inspectButton.addEventListener('click', handler, false)
  }
}

/**
 * Close Error Message
 */
const closeError = () => {
  document.getElementById('error-message').innerHTML = ''
  document.getElementById('error').style.display = 'none'
}

/**
 * Ask User for their Mapbox Access Token
 */
const requestToken = () => {
  setTimeout(hideLoading, 100)

  accessToken = null

  let token = document.getElementById('token')
  let enterTokenDiv = document.getElementById('enter-token')
  let submitButton = document.getElementById('submit-token')
  let textWrapperDiv = document.getElementById('text-wrapper')
  let getAccessToken = document.getElementById('get-access-token')
  let poweredBy = document.getElementById('powered-by')
  let mapboxButton = document.getElementById('built-with-mapbox')
  let electronButton = document.getElementById('built-with-electron')

  let handler = () => {
    submitButton.innerHTML = '<i class="fa fa-refresh fa-spin fa-fw"></i>'
    enterToken()
  }

  let enterKey = (evt) => {
    if (evt.keyCode == 13) {
      submitButton.innerHTML = '<i class="fa fa-refresh fa-spin fa-fw"></i>'
      enterToken()
    }
  }

  let openMapboxWebsite = () => {
    shell.openExternal('https://www.mapbox.com/help/create-api-access-token/')
  }

  let poweredByWebsite = () => {
    shell.openExternal('https://civil.services/')
  }

  let mapboxLink = () => {
    shell.openExternal('https://www.mapbox.com/')
  }

  let electronLink = () => {
    shell.openExternal('http://electron.atom.io/')
  }

  enterTokenDiv.style.display = 'block'

  setTimeout(() => {
    textWrapperDiv.className = 'animated fadeInDown'
    textWrapperDiv.style.display = 'block'
  }, 500)

  submitButton.removeEventListener('click', handler, false)
  submitButton.addEventListener('click', handler, false)

  token.removeEventListener('keyup', enterKey, false)
  token.addEventListener('keyup', enterKey, false)

  getAccessToken.removeEventListener('click', openMapboxWebsite, false)
  getAccessToken.addEventListener('click', openMapboxWebsite, false)

  poweredBy.removeEventListener('click', poweredByWebsite, false)
  poweredBy.addEventListener('click', poweredByWebsite, false)

  mapboxButton.removeEventListener('click', mapboxLink, false)
  mapboxButton.addEventListener('click', mapboxLink, false)

  electronButton.removeEventListener('click', electronLink, false)
  electronButton.addEventListener('click', electronLink, false)

  const InputMenu = Menu.buildFromTemplate([{
      label: 'Cut',
      role: 'cut',
    }, {
      label: 'Copy',
      role: 'copy',
    }, {
      label: 'Paste',
      role: 'paste',
    }, {
      type: 'separator',
    }, {
      label: 'Select all',
      role: 'selectall',
    }
  ])

  document.body.addEventListener('contextmenu', (e) => {
    e.preventDefault()
    e.stopPropagation()

    let node = e.target
    let focusedWindow = BrowserWindow.getFocusedWindow()

    while (node) {
      if (node.nodeName.match(/^(input|textarea)$/i) || node.isContentEditable) {
        InputMenu.popup(focusedWindow)
        break
      }
      node = node.parentNode;
    }
  })
}

/**
 * Process Access Token from Form
 */
const enterToken = () => {
  let token = document.getElementById('token').value

  if (token && token.startsWith('pk.ey')) {
    accessToken = token.toString()
    document.getElementById('submit-token').innerHTML = '<i class="fa fa-check"></i>'
    document.getElementById('token').value = ''
    document.getElementById('token').setAttribute('placeholder', i18n.get('page.init_map'))
    document.getElementById('token').setAttribute('disabled', 'disabled')
    init()
  } else {
    setTimeout(() => {
      document.getElementById('token').setAttribute('placeholder', i18n.get('page.placeholder'))
      document.getElementById('token').removeAttribute('disabled')
      document.getElementById('submit-token').innerHTML = i18n.get('page.go_button')
    }, 250)

    showError(i18n.get('errors.invalid_mapbox_access_token'))
  }
}

/**
 * Hide Loading Screen
 */
const hideLoading = () => {
  setTimeout(() => {
    document.getElementById('loading').className = 'fullscreen animated fadeOut'
    document.getElementById('loading-image-wrapper').className = 'animated rollOut'
  }, 750)

  setTimeout(() => {
    document.getElementById('loading').style.display = 'none'
  }, 1500)
}

/**
 * Show Map
 */
const showMap = () => {
  let mapDiv = document.getElementById('map')
  let enterTokenDiv = document.getElementById('enter-token')

  enterTokenDiv.className = 'fullscreen animated fadeOut'


  let drawerCloseButton = document.getElementById('drawer-close')

  let handler = () => {
    hideDrawer()
  }

  drawerCloseButton.removeEventListener('click', handler, false)
  drawerCloseButton.addEventListener('click', handler, false)

  setTimeout(() => {
    enterTokenDiv.style.display = 'none'
  }, 750)

  setTimeout(() => {

  }, 1500)

  mapDiv.style.display = 'block'

  hideLoading()
  closeError()
  enableOpeningFiles(true)

  /**
   * Load Last File or Show Getting Started
   */
  settings.get('lastFile').then(file => {
    if (file) {
      loadFile(file)
    } else {
      showGettingStarted()
    }
  })
}

/**
 * Show Getting Started Layover
 */
const showGettingStarted = () => {
  let getStartedDiv = document.getElementById('get-started')
  getStartedDiv.className = 'animated flipInY'
  getStartedDiv.style.display = 'block'
}

/**
 * Hide Getting Started Layover
 */
const hideGettingStarted = () => {
  let getStartedDiv = document.getElementById('get-started')
  getStartedDiv.className = 'animated flipOutY'

  setTimeout(() => {
    getStartedDiv.style.display = 'none'
  }, 1000)

}

/**
 * Show Drawer
 * @param {object} properties - GeoJSON Feature `properties` Data
 */
const showDrawer = (properties) => {
  document.getElementById('drawer-content').scrollTop = 0
  document.getElementById('map').style.right = '300px'
  document.getElementById('drawer').style.right = '0'

  util.buildDetails(properties)

  setTimeout(() => {
    let detailLinks = document.getElementsByClassName('detail-link')

    for (let i = 0; i < detailLinks.length; i++) {
      let href = detailLinks[i].getAttribute('href')

      detailLinks[i].removeEventListener('click', (evt) => {
        shell.openExternal(href)
        evt.preventDefault()
        evt.stopPropagation()
      }, false)

      detailLinks[i].addEventListener('click', (evt) => {
        shell.openExternal(href)
        evt.preventDefault()
        evt.stopPropagation()
      }, false)
    }
  }, 250)

  let step = 0
  clearInterval(drawerInterval)
  drawerInterval = setInterval(() => {
    map.resize()
    step++

    if (step === 25) {
      clearInterval(drawerInterval)
    }
  }, 10)
}

/**
 * Hide Drawer
 */
const hideDrawer = () => {
  document.getElementById('map').style.right = '0'
  document.getElementById('drawer').style.right = '-350px'

  let step = 0
  clearInterval(drawerInterval)
  drawerInterval = setInterval(() => {
    map.resize()
    step++

    if (step === 25) {
      clearInterval(drawerInterval)
    }
  })
}

/**
 * Set Progress Bar
 * @param progress
 */
const setProgressBar = (progress) => {
  document.getElementById('progress-bar').style.width = progress + '%'
}

/**
 * Load File
 * @param fileName
 */
const loadFile = (fileName) => {

  hideGettingStarted()
  hideDrawer()

  var fileData = ''

  let stats = fs.statSync(fileName)
  let readStream = fs.createReadStream(fileName, { encoding: 'utf8' })
  let window = BrowserWindow.getFocusedWindow()

  readStream.on('data', function(chunk) {
    fileData += chunk
    let percent = readStream.bytesRead / stats.size

    setProgressBar(Math.round(percent * 100))

    if (window) {
      window.setProgressBar(percent)
    }
  })

  readStream.on('end', function () {
    settings.set('lastFile', fileName)

    if (window) {
      window.setProgressBar(-1)
    }

    setProgressBar(100)

    setTimeout(() => {
      setProgressBar(0)
    }, 200)

    renderData(fileData)
  })

  readStream.on('error', function (err) {
    setProgressBar(0)
  })
}

const renderData = (fileData) => {

  for (let i = 0; i < mapLayers.length; i++) {
    map.removeLayer(mapLayers[i])
  }

  mapLayers = []

  let fileJSON = JSON.parse(fileData)

  // add a unique ID for interacting with features
  if (fileJSON.type === 'FeatureCollection') {
    for (let i = 0; i < fileJSON.features.length; i++) {
      fileJSON.features[i].properties.geojson_app_unique = i
    }
  } else if (fileJSON.type === 'Feature') {
    fileJSON.properties.geojson_app_unique = 0
  }

  let data = geojsonNormalize(fileJSON)
  let bounds = geojsonExtent(data)

  let timestamp = Date.now().toString()
  let shapesId = 'shapes-'.concat(timestamp)
  let linesId = 'lines-'.concat(timestamp)
  let fillsId = 'fills-'.concat(timestamp)
  let fillsHoverId = 'fills-hover-'.concat(timestamp)
  let fillsActiveId = 'fills-active-'.concat(timestamp)

  let mapThemes = {
    'dark': {
      'line-color': '#fdc70d',
      'line-opacity': 0.35,
      'fill-color': '#fdc70d',
      'fill-opacity': 0.2,
      'fill-opacity-active': 0.3
    },
    'light': {
      'line-color': '#27b0fd',
      'line-opacity': 0.35,
      'fill-color': '#27b0fd',
      'fill-opacity': 0.2,
      'fill-opacity-active': 0.3
    },
    'outdoors': {
      'line-color': '#ed1200',
      'line-opacity': 0.4,
      'fill-color': '#ed1200',
      'fill-opacity': 0.3,
      'fill-opacity-active': 0.4
    },
    'satellite': {
      'line-color': '#0085e7',
      'line-opacity': 0.4,
      'fill-color': '#0085e7',
      'fill-opacity': 0.3,
      'fill-opacity-active': 0.4
    },
    'streets': {
      'line-color': '#ed1200',
      'line-opacity': 0.4,
      'fill-color': '#ed1200',
      'fill-opacity': 0.3,
      'fill-opacity-active': 0.4
    },
    'satellite-streets': {
      'line-color': '#fdc70d',
      'line-opacity': 0.45,
      'fill-color': '#fdc70d',
      'fill-opacity': 0.35,
      'fill-opacity-active': 0.45
    }
  }

  mapLayers = [shapesId, linesId, fillsId, fillsHoverId, fillsActiveId]

  map.addLayer({
    'id': shapesId,
    'type': 'symbol',
    'source': {
      'type': 'geojson',
      'data': data
    }
  })

  map.addLayer({
    'id': linesId,
    'type': 'line',
    'source': shapesId,
    'paint': {
      'line-color': mapThemes[theme]['line-color'],
      'line-width': 1,
      'line-opacity': mapThemes[theme]['line-opacity'],
    }
  })

  map.addLayer({
    'id': fillsId,
    'type': 'fill',
    'source': shapesId,
    'paint': {
      'fill-color': mapThemes[theme]['fill-color'],
      'fill-opacity': mapThemes[theme]['fill-opacity']
    }
  })

  map.addLayer({
    'id': fillsHoverId,
    'type': 'fill',
    'source': shapesId,
    'paint': {
      'fill-color': mapThemes[theme]['fill-color'],
      'fill-opacity': mapThemes[theme]['fill-opacity-active']
    },
    'filter': ['==', 'geojson_app_unique', '']
  })

  map.addLayer({
    'id': fillsActiveId,
    'type': 'fill',
    'source': shapesId,
    'paint': {
      'fill-color': mapThemes[theme]['fill-color'],
      'fill-opacity': mapThemes[theme]['fill-opacity-active']
    },
    'filter': ['==', 'geojson_app_unique', '']
  })

  if ((bounds[ 1 ] == bounds[ 3 ]) && (bounds[ 0 ] == bounds[ 2 ])) {
    return
  }

  map.fitBounds([[ bounds[0], bounds[1] ], [ bounds[2], bounds[3] ]], { padding: 100, linear: true })

  map.on('click', evt => {
    if (fillsId && map.getLayer(fillsId)) {
      let features = map.queryRenderedFeatures(evt.point, { layers: [ fillsId ] })

      if (features && features.length) {
        map.setFilter(fillsActiveId, ['==', 'geojson_app_unique', features[0].properties.geojson_app_unique])
      } else {
        map.setFilter(fillsActiveId, ['==', 'geojson_app_unique', ''])
        return
      }

      let properties = features[ 0 ].properties

      showDrawer(properties)
    }
  })

  map.on('mousemove', evt => {
    if (fillsId && fillsHoverId && map.getLayer(fillsId) && map.getLayer(fillsHoverId)) {
      let features = map.queryRenderedFeatures(evt.point, { layers: [fillsId] })
      map.getCanvas().style.cursor = (features && features.length) ? 'pointer' : ''

      if (features && features.length) {
        map.setFilter(fillsHoverId, ['==', 'geojson_app_unique', features[0].properties.geojson_app_unique])
      } else {
        map.setFilter(fillsHoverId, ['==', 'geojson_app_unique', ''])
      }
    }
  })

  map.on('mouseout', function() {
    if (fillsHoverId && map.getLayer(fillsHoverId)) {
      map.setFilter(fillsHoverId, [ '==', 'geojson_app_unique', '' ])
    }
  })
}

/**
 * Initialize Electron App
 */
const init = () => {
  mapboxgl.accessToken = accessToken.toString()

  let mapDiv = document.getElementById('map')

  settings.get('theme').then(style => {

    document.body.className = style

    theme = style

    mapDiv.style.display = 'block'

    map = new mapboxgl.Map({
      container: 'map',
      style: require('./themes/' + style + '.json'),
      center: [ 0, 0 ],
      zoom: 1
    })

    let controller = new mapboxgl.NavigationControl()

    map.addControl(controller, 'top-left')

    map.on('load', () => {
      let token = document.getElementById('token')
      settings.set('accessToken', accessToken.toString()).then(() => {
        showMap()
        enableOpeningFiles(true)
      })
    })

    map.on('error', (response) => {

      // ignore map layer errors
      if (response.error.message.indexOf('does not exist in the map\'s style and cannot be removed') !== -1) {
        return
      }

      // check if map error is because of invaild API key
      if (response.error.message.indexOf('Unauthorized') !== -1) {
        mapDiv.style.display = 'none'
        console.error(response.error.message)
        requestToken()
        enableOpeningFiles(false)

        let token = document.getElementById('token')
        token.value = ''
        token.setAttribute('placeholder', i18n.get('page.placeholder'))
        token.removeAttribute('disabled')

        document.getElementById('submit-token').innerHTML = i18n.get('page.go_button')
        document.getElementById('enter-token').className = 'fullscreen animated fadeIn'

        showError(i18n.get('errors.invalid_mapbox_access_token'))

      } else {
        console.error('response', response)

        showError('<button id="inspect-button"><i class="fa fa-fw fa-code"></i> ' + i18n.get('buttons.inspect') + '</button>' + i18n.get('errors.mapbox_failure') + ' ' +  response.error.message)
      }
    })
  })
}

/**
 * Check for if we have a Mapbox Access Token Saved
 */
settings.get('accessToken').then(token => {
  if (!token) {
    requestToken()
  } else {
    accessToken = token.toString()
    init()
  }
})

