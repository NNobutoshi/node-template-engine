/*!
* node_template_engine.js
* version : 0.0.1
* link    : https://github.com/NNobutoshi/node_template_engine.git
* License : MIT
*/

var
   through  = require('through2')
  ,nodeX2j  = require("xls-to-json")
  ,fs       = require('fs')
  ,charset  = 'utf-8'
  ,settings = {
     dest      : './htdocs'
    ,src       : './src/html/_template'
    ,template  : './src/html/_template/template_default.html'
    ,indexfile : 'index.html'
    ,extension : /\.html?$/
    ,x2j : {
       input   : './sitemap.xlsx'
      ,output  : './output.json'
      ,sheet   : 'Sheet1'
    }
    ,map : {
       path     : 'url'
      ,template : 'template'
      ,targets  : {
         'description' : /(<meta name="[Dd]escription" content=").*?(" *\/?>)/g
        ,'keywords'    : /(<meta name="[Kk]eywords" content=").*?(" *\/?>)/g
      }
    }
  }
;

module.exports = _init;

function _init() {
  _xls2Json( _eachJsonData );
}

function _xls2Json( callback ) {
  nodeX2j( settings.x2j, function( err, result ) {
    if(err) {
      console.error( err );
    } else {
      result.forEach( callback );
    }
  });
}

function _eachJsonData( data ) {
  var
     map = settings.map
    ,ret = {}
  ;
  if ( data[ map.path ] ) {
    data.path = data [ map.path ]
      .replace( /https?:\/\/[^\/]+/, '')
      .replace( /^\/?/, settings.dest + '/' )
      .replace( /\/$/, '/' + settings.indexfile )
      .trim()
    ;
  } else {
    return false;
  }
  if ( data[ map.template ] ) {
    data.template = settings.src + '/' + data[ map.template ];
  } else {
    if( settings.template ) {
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
    if( parent === '') {
      parent = leaf;
    } else {
      parent  = parent + '/' + leaf;
    }
    if( index === len -1 && settings.extension.test( parent ) ) {
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
  ;
  orig.exists = fs.existsSync( data.path );
  template.exists = ( data.template )? fs.existsSync( data.template ): false;
  if( template.exists ) {
    template.content = fs.readFileSync( data.template, charset );
    if( orig.exists ) {
      orig.content = fs.readFileSync( data.path, charset );
      newContent = _getNewContent( template.content, orig.content );
    } else {
      newContent = _getNewContent( template.content );
    }
  } else {
    if( orig.exists ) {
      newContent = fs.readFileSync( data.path, charset );
    } else {
      return false;
    }
  }
  newContent = _replace( newContent, data, settings.map.targets );
  fs.writeFileSync( data.path, newContent );
}

function _replace( content, data, targets ) {
  Object.keys( targets ).forEach( function( key ) {
    content = content.replace( targets[ key ], _replacer( data[ key] ) );
  } );
  return content;
}

function _replacer( str ) {
  return function( m0, m1, m2, m3 ) {
    if( typeof m3 === 'number') {
      return m1 + str + m2;
    } else if( typeof m2 === 'number' ) {
      return m1 + str;
    } else {
      return str;
    }
  };
}

function _getNewContent( baseContent, origContent ) {
  var
     newContent
    ,commentPettern = /<!-- *{{ *'?(.*?)'? *-->(([^\r\n]*?)|\r?\n?(.*?)\r?\n[\s\S]*?\r?\n(.*?))\r?\n<!-- *}} *-->/g
    ,store          = {}
    ,escapeRegex    = /([.*+?^=!:${}()|[\]\/\\])/g
    ,targets
  ;
  if( origContent ) {
    targets = baseContent.match( commentPettern );
    if ( targets !== null ) {
      store.targets = targets.map( function( item ) {
        var
          ret  = ''
        ;
        ret = item.replace( commentPettern, function( m0, m1, m2, m3, m4, m5 ) {
          if( m1 ) {
            if( m3 ) {
                return m1;
            } else {
              if( m4 && m5 ) {
                m5 = m5.replace( escapeRegex, '\\$1' );
                return m1 + '[\\s\\S]*?' + m5;
              }
            }
          } else {
            if( m3 ) {
                m3 = m3.replace( escapeRegex, '\\$1' );
                return m3;
            } else {
              if( m4 && m5 ) {
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
      if( match !== null ) {
        return match[0];
      }
    } );
    store.targets.forEach( function( item, index ) {
      baseContent = baseContent.replace( item, store.contents[index] );
    } );
  }
  return baseContent.replace( /<!-- *{{ *'?(.*?)'? *-->\r?\n?|\r?\n?<!-- *}} *-->/g, '' );
}
