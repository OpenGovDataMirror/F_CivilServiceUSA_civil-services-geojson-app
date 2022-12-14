/**
 * Polyfill for startsWith
 */
if (!String.prototype.startsWith) {
  String.prototype.startsWith = (searchString, position) => {
    position = position || 0
    return this.substr(position, searchString.length) === searchString
  }
}

/**
 * Polyfill for startsWith
 */
if (!String.prototype.endsWith) {
  String.prototype.endsWith = (searchString, position) => {
    let subjectString = this.toString();
    if (typeof position !== 'number' || !isFinite(position) || Math.floor(position) !== position || position > subjectString.length) {
      position = subjectString.length
    }
    position -= searchString.length
    let lastIndex = subjectString.lastIndexOf(searchString, position)
    return lastIndex !== -1 && lastIndex === position
  };
}

/**
 * Build Details
 * Generates Markup for Drawer when GeoJSON region clicked
 * @param properties
 */
const buildDetails = (properties) => {
  let html = ''

  for (let key in properties) {
    if (properties.hasOwnProperty(key)) {

      // skip the custom property we added to handle mouse actions
      if (key !== 'geojson_app_unique') {
        let detail = properties[key].toString()

        // Check if the property is a URL
        if (detail.startsWith('http://') || detail.startsWith('https://')) {

          // Check if the property is an image
          if (detail.endsWith('.jpg') || detail.endsWith('.jpeg') || detail.endsWith('.png') || detail.endsWith('.gif')) {
            detail = '<a href="' + detail + '" class="detail-link">' + detail + '</a>' + '<a href="' + detail + '" class="detail-link"><img src="' + detail + '" class="detail-image"></a>'
          } else {
            detail = '<a href="' + detail + '" class="detail-link">' + detail + '</a>'
          }
        }

        // Check if the property is an email address
        let validEmail = /^(([^<>()\[\]\\.,;:\s@"]+(\.[^<>()\[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/;

        if (validEmail.test(detail)) {
          detail = '<a href="mailto:' + detail + '" class="detail-link">' + detail + '</a>'
        }

        html += '<div class="property-details"><dt>' + key + '</dt><dd>' + detail + '</dd></div>'
      }
    }
  }

  document.getElementById('drawer-content').innerHTML = html
}

module.exports = {
  buildDetails: buildDetails
}