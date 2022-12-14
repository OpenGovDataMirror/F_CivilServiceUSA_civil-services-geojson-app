#!/usr/bin/env node

let fs = require('fs')
let dnode = require('dnode')
let argv = require('minimist')(process.argv.slice(2))
let electron = require('electron')
let proc = require('child_process')
let net = require('net')

let startingApp = false
let retry = 0

let validThemes = ['dark', 'light', 'outdoors', 'satellite', 'streets', 'satellite-streets']
let theme = (argv.theme && validThemes.indexOf(argv.theme) !== -1) ? argv.theme : null

const connect = () => {

  net.connect(5004, (err) => {
    if (err) {
      console.error(err)
    }
    remoteCommands()
  }).on('error', (e) => {
    if (!startingApp) {
      proc.spawn(electron, [ __dirname + '/../' ], { detached: true })
      startingApp = true
      return setTimeout(connect, 400).unref()
    }
    if (retry > 50) {
      return console.error('Cant connect to geojson', e)
    }
    retry++
    setTimeout(connect, 100).unref()
  }).unref()
}

const remoteCommands = () => {
  let d = dnode.connect(5004)
  d.on('remote', (remote) => {

    if (argv._.length) {
      let fileName = argv._[0]
      remote.open({ file: fileName, theme: theme }, (s) => {
        d.end()
        process.exit(0)
      })
    } else {
      let data = ''
      let first = true

      process.stdin.on('readable', function() {
        let chunk = this.read()
        if (chunk === null) {
          if ( !first && data === '') {
            d.end()
          }

          if (first) {
            d.end()
            process.exit(0)
          }
        } else {
          data += chunk
        }

        first = false
      })

      process.stdin.on('end', function() {
        remote.open({ data:data, theme: theme }, function (s) {
          d.end()
          process.exit(0)
        })
      });
    }
  }).on('fail', console.error)
}

connect()
