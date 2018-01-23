importScripts('/js/idb.min.js');

/*
 Service Worker implementation
 inspired from https://github.com/GoogleChromeLabs/airhorn/blob/master/app/sw.js
 */

let version = '1.4.0';

let staticCacheName = 'mws-rrs1-' + version;

self.addEventListener('activate', event => {
  event.waitUntil(
    createDB()
  )
})

self.addEventListener('activate',  event => {
  event.waitUntil(self.clients.claim());
});


/* 
* Creating indexDb Database
*/

function createDB() {
  idb.open('restautrants', 1, function(upgradeDB) {

    console.log("Creating Restaurant List Object Store");

    var store = upgradeDB.createObjectStore('restaurant-list', {keyPath: 'id'})
  })
}

function addAllToDB(items) {
  idb.open('restautrants', 1).then(function(db) {
    var tx = db.transaction('restaurant-list', 'readwrite');
    var store = tx.objectStore('restaurant-list');

    return Promise.all(items.map(function(item) {
        console.log("Adding Item", item);
        return store.put(item);
      })
    ).then(function(e) {
      console.log("Added Successfully");
    }).catch(function(e) {
      tx.abort();
      console.log(e);
    })
  })
}


/*
 * Adapted from https://developers.google.com/web/ilt/pwa/lab-caching-files-with-service-worker
 * Another way to cache is to cache it in 'install' event, but I am not sure if rubrics demands that
 * It says visited page should show when there is no network access so only caching requests as they happen
 */
self.addEventListener('fetch', function(event) {
  console.log('Fetch event for ', event.request.url);

  if (event.request.url.indexOf('localhost:1337/restaurants') >= 0) {

    event.respondWith(
    idb.open('restautrants', 1).then(function(db) {
      var tx = db.transaction('restaurant-list', 'readonly');
      var store = tx.objectStore('restaurant-list');
      return store.getAll();
    }).then((rs) => {
      console.log("All Data", rs);
      if (!rs.length) {
        console.log('Attempting to fetch from network ', event.request);
        
        fetch(event.request)
          .then(function(response){
            if (response.status === 200) {
              response.clone().json()
              .then(function(data) {
                console.log(event.request.url, 'json data', data)
                addAllToDB(data);
                console.log('Saving to DB and responding from FETCH', data);
                return response;
                // event.respondWith(data);
              })
            }
            else {
              callback((`Request failed. Returned status of ${response.status}`), null);
            }
          })
      } else {
        console.log('Responding from IndexDB');

        const myHeaders = {
          "Content-Type":'json'
        };
  
        const init = {
          'type':'cors',
          'headers': myHeaders,
          'status' : 200,
          'statusText' : 'OKS',
        };

        var respo = new Response(JSON.stringify(rs), {
          headers : new Headers({
            'Access-Control-Allow-Credentials':'true',
            'Content-type': 'application/json'
          }),
          type : 'cors',
          status: 200
        });
        console.log("Response to sent to fetch ",respo);

        return respo;
        // event.respondWith(rs);
      }
    })
    )
  } else {
    event.respondWith(
      caches.match(event.request).then(function(response) {
        if (response) {
          console.log('Found ', event.request.url, ' in cache');
          return response;
        }
  
        console.log('Network request for ', event.request.url);
        return fetch(event.request)
          .then(function(response) {
            // TODO 5 - Respond with custom 404 page
            return caches.open(staticCacheName).then(function(cache) {
              if (event.request.url.indexOf('maps') < 0) { // don't cache google maps
                // ^ it's not a site asset, is it?
                console.log('Saving ' + event.request.url + ' into cache.');
                cache.put(event.request.url, response.clone());
              }
              return response;
            });
          });
  
      }).catch(function(error) {
        // TODO 6 - Respond with custom offline page
      })
    );  
  }
});


/* delete old cache */
self.addEventListener('activate', function(event) {
  console.log('Activating new service worker...');

  var cacheWhitelist = [staticCacheName];

  event.waitUntil(
    caches.keys().then(function(cacheNames) {
      return Promise.all(
        cacheNames.map(function(cacheName) {
          if (cacheWhitelist.indexOf(cacheName) === -1) {
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
});