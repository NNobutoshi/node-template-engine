var
   nodeX2j  = require("xls-to-json")
  ,fs       = require('fs')
  ,charset  = 'utf-8'
  ,settings = {
     dest      : './htdocs'
    ,src       : './src/html/_templates'
    ,template  : './src/html/_templates/template_default.html'
    ,indexfile : 'index.html'
    ,extension : /\.html?$/
    ,linefeed  : 'lf' // 'lf' or 'crlf'
    ,x2j : {
       input   : './sitemap.xlsx'
      ,output  : './output.json'
      ,sheet   : 'Sheet1'
    }
    ,map : {
       path     : 'url'
      ,template : 'template'
      ,ignore   : 'skip'
      ,targets  : {
         'title'       : /(<title>).*?(<\/title>)/g
        ,'description' : /(<meta name="[Dd]escription" content=").*?(" *\/?>)/g
        ,'keywords'    : /(<meta name="[Kk]eywords" content=").*?(" *\/?>)/g
      }
    }
  }
  ,_logger = function() {}
;

module.exports = _init;

function _init( options ) {
  console.time('time');
  Object.assign( settings, options );
  _xls2Json( _eachJsonData );
}

function _xls2Json( callback ) {
  nodeX2j( settings.x2j, function( err, result ) {
    if ( err ) {
      console.error( err );
    } else {
      _logger = _info( result.length );
      result.forEach( callback );
    }
  });
}

function _info( max ) {
  var
     count     = 0
    ,comments  = []
    ,timeoutId = null
    ,limit     = 3000
  ;

  return _collect;

  function _collect( comment ) {
    ++ count;
    _clear();
    timeoutId = setTimeout( _show, limit );
    if ( comment ) {
      comments.push( comment );
    }
    if ( count === max ) {
      _clear();
      _show();
    }
  }

  function _show() {
    _clear();
    console.info( '=== template engine ===' );
    console.info( comments.join('\n') );
    console.timeEnd('time');
    console.info( '=======================' );
  }

  function _clear() {
    clearTimeout( timeoutId );
    timeoutId = null;
  }

}

function _eachJsonData( data, index ) {
  var
     map = settings.map
    ,ret = {}
  ;
  if ( data[ map.path ] ) {
    data.path = data [ map.path ]
      .trim()
      .replace( /^https?:\/\/[^\/]+/, '')
      .replace( /^\/?/, settings.dest + '/' )
      .replace( /(\/[^\.\/]+)$/, '$1/' )
      .replace( /\/$/, '/' + settings.indexfile )
    ;
  } else {
    _logger();
    return false;
  }
  if ( data[ map.ignore ] ) {
    _logger( 'skipped : ' + data.path );
    return false;
  }
  if ( data[ map.template ] ) {
    data.template = settings.src + '/' + data[ map.template ];
  } else {
    if ( settings.template ) {
      data.template = settings.template;
    }
  }
  _runRecursively( data, _writeFile );
}

function _runRecursively( data, callback ) {
  var
     leaves = data.path.split('/')
    ,parent = ''
    ,len    = leaves.length
  ;
  leaves.forEach( function ( leaf, index, hoge ) {
    if ( parent === '') {
      parent = leaf;
    } else {
      parent  = parent + '/' + leaf;
    }
    if ( index === len -1 && settings.extension.test( parent ) ) {
      callback( data );
    } else {
      if ( !fs.existsSync( parent ) ) {
        fs.mkdirSync( parent );
      }
    }
  } );
}

function _writeFile( data ) {
  var
     orig       = {}
    ,template   = {}
    ,newContent = ''
    ,isNewFile  = false
  ;
  orig.exists = fs.existsSync( data.path );
  template.exists = ( data.template )? fs.existsSync( data.template ): false;
  if ( template.exists ) {
    template.content = fs.readFileSync( data.template, charset );
    if ( orig.exists ) {
      orig.content = fs.readFileSync( data.path, charset );
      newContent = _mergeContent( template.content, orig.content );
    } else {
      isNewFile = true;
      newContent = _mergeContent( template.content );
    }
  } else {
    if ( orig.exists ) {
      newContent = fs.readFileSync( data.path, charset );
    } else {
      _logger();
      return false;
    }
  }
  newContent = _replace( newContent, data, settings.map.targets );
  if ( newContent === orig.content ) {
    _logger( 'kept    : ' + data.path );
  } else {
    fs.writeFile( data.path, newContent, charset, function( err ) {
      if ( err ) {
        _logger();
        console.error( err );
      } else {
        if ( isNewFile === true ) {
          _logger( 'new     : ' + data.path );
        } else {
          _logger( 'writen  : ' + data.path );
        }
      }
    } );
  }
}

function _replace( content, data, targets ) {
  Object.keys( targets ).forEach( function( key ) {
    var
      str = data[ key ]
    ;
    if ( !str ) {
      return false;
    }
    if ( settings.linefeed === 'lf' ) {
      str = str.replace( /\r?\n/g, '\n' );
    } else if ( settings.linefeed === 'crlf' ) {
      str = str.replace( /\r?\n/g, '\r\n' );
    }
    content = content.replace( targets[ key ], _replacement( str ) );
  } );
  return content;
}

function _replacement( str ) {
  return function( m0, m1, m2, m3 ) {
    if ( typeof m3 === 'number') {
      return m1 + str + m2;
    } else if ( typeof m2 === 'number' ) {
      return m1 + str;
    } else {
      return str;
    }
  };
}

function _mergeContent( baseContent, origContent ) {
  var
     newContent
    ,commentPettern = /<!-- *{{ *'?(.*?)'? *-->(([^\r\n]*?)|\r?\n?(.*?)\r?\n[\s\S]*?\r?\n(.*?))\r?\n?<!-- *}} *-->/g
    ,store          = {}
    ,escapeRegex    = /([.*+?^=!:${}()|[\]\/\\])/g
    ,targets
  ;
  if ( origContent ) {
    targets = baseContent.match( commentPettern );
    if ( targets !== null ) {
      store.targets = targets.map( function( item ) {
        var
          ret  = ''
        ;
        ret = item.replace( commentPettern, function( m0, m1, m2, m3, m4, m5 ) {
          if ( m1 ) {
            if ( m3 ) {
                return m1;
            } else {
              if ( m4 && m5 ) {
                m5 = m5.replace( escapeRegex, '\\$1' );
                return m1 + '[\\s\\S]*?' + m5;
              }
            }
          } else {
            if ( m3 ) {
                m3 = m3.replace( escapeRegex, '\\$1' );
                return m3;
            } else {
              if ( m4 && m5 ) {
                m4 = m4.replace( escapeRegex, '\\$1' );
                m5 = m5.replace( escapeRegex, '\\$1' );
                return m4 + '[\\s\\S]*?' + m5;
              }
            }
          }
        } );
        return new RegExp( ret );
      } );
    }
    baseContent = baseContent.replace( /<!-- *{{ *'?(.*?)'? *-->\r?\n?|\r?\n?<!-- *}} *-->/g, '' );
    store.contents = store.targets.map( function( item ) {
      var match = origContent.match( item );
      if ( match !== null ) {
        return match[0];
      }
    } );
    store.targets.forEach( function( item, index ) {
      var replacement = store.contents[index];
      if ( replacement ) {
        baseContent = baseContent.replace( item, replacement );
      }
    } );
  }
  return baseContent.replace( /<!-- *{{ *'?(.*?)'? *-->\r?\n?|\r?\n?<!-- *}} *-->/g, '' );
}