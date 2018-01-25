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

self.addEventListener('activate', event => {
  event.waitUntil(self.clients.claim());
});


/*
 * Creates indexDb Database
 */

function createDB() {
  idb.open('restaurants-reviews', 1, function (upgradeDB) {

    console.log("Creating Restaurant List Object Store");

    var restStore = upgradeDB.createObjectStore('restaurants', {keyPath: 'id'})
    var reviewStore = upgradeDB.createObjectStore('reviews', {keyPath: 'id'})
  })
}

/*
 * Adds data to Database
 */

function addAllToDB(storeName, items) {
  idb.open('restaurants-reviews', 1).then(function (db) {
    var tx = db.transaction(storeName, 'readwrite');
    var store = tx.objectStore(storeName);

    return Promise.all(items.map(function (item) {
        console.log("Adding Item", item);
        return store.put(item);
      })
    ).then(function (e) {
      console.log("Added Successfully");
    }).catch(function (e) {
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

addEventListener('fetch', event => {
  // Prevent the default, and handle the request ourselves.
  event.respondWith(async function () {

    if (event.request.url.indexOf('localhost:1337/restaurants') >= 0 || event.request.url.indexOf('localhost:1337/reviews') >= 0) {
      var lastIndexOfSlash = event.request.url.lastIndexOf('/');
      var storeName = event.request.url.substring(lastIndexOfSlash + 1);

      return idb.open('restaurants-reviews', 1).then(function (db) {

        console.log("RequestDB", storeName);

        var tx = db.transaction(storeName, 'readonly');
        var store = tx.objectStore(storeName);
        return store.getAll();
      }).then((rs) => {
        console.log("All Data", rs);
        // If if indexdb contains data
        if (!rs.length) {
          console.log('Attempting to fetch from network ', event.request);
          // Fetches data from network
          return fetch(event.request)
            .then(function (response) {

              return response.json()
                .then(function (data) {
                  console.log(event.request.url, 'json data', data);
                  // Adds data to database
                  addAllToDB(storeName, data);
                  console.log('Saving to DB and responding from FETCH', data);
                  return response;
                  // event.respondWith(data);
                })
            })
        } else {
          // Responding when data is available in cache
          console.log('Responding from IndexDB');

          var init = {
            status: 200,
            statusText: "OK",
            headers: {'Content-Type': 'application/jso'}
          };

          const respo = new Response(JSON.stringify(rs), init);
          console.log("Response to send to fetch ", rs);
          return respo;
        }
      })
    } else {

      // Try to get the response from a cache.
      const cachedResponse = await caches.match(event.request);

      // Return it if we found one.
      if (cachedResponse) {
        console.log('Found ', event.request.url, ' in cache');
        return cachedResponse;
      }

      // If we didn't find a match in the cache, use the network.
      console.log('Network request for ', event.request.url);
      return fetch(event.request)
        .then(function (cachedResponse) {
          // TODO 5 - Respond with custom 404 page
          return caches.open(staticCacheName).then(function (cache) {
            if (event.request.url.indexOf('maps') < 0) { // don't cache google maps
              // ^ it's not a site asset, is it?
              console.log('Saving ' + event.request.url + ' into cache.');
              cache.put(event.request.url, cachedResponse.clone());
            }
            return cachedResponse;
          });
        });
    }
  }());
});


/* delete old cache */
self.addEventListener('activate', function (event) {
  console.log('Activating new service worker...');

  var cacheWhitelist = [staticCacheName];

  event.waitUntil(
    caches.keys().then(function (cacheNames) {
      return Promise.all(
        cacheNames.map(function (cacheName) {
          if (cacheWhitelist.indexOf(cacheName) === -1) {
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
});
