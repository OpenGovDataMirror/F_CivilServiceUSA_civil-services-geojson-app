const path = require('path')
const electron = require('electron')
const fs = require('fs')

let loadedLanguage;
let app = electron.app ? electron.app : electron.remote.app

if (fs.existsSync(path.join(__dirname, app.getLocale() + '.json'))) {
  loadedLanguage = JSON.parse(fs.readFileSync(path.join(__dirname, app.getLocale() + '.json'), 'utf8'))
} else {
  loadedLanguage = JSON.parse(fs.readFileSync(path.join(__dirname, 'en.json'), 'utf8'))
}

const getKey = (key) => {
  let translation = key.split('.').reduce((o,i)=>o[i], loadedLanguage)
  if (translation === undefined) {
    translation = key
  }
  return translation
}

module.exports = {
  get: getKey
}