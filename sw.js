importScripts('/js/idb.min.js');

/*
 Service Worker implementation
 inspired from https://github.com/GoogleChromeLabs/airhorn/blob/master/app/sw.js
 */

let version = '1.4.0';

let staticCacheName = 'mws-rrs1-' + version;

/*
 * Creates indexDb Database
 */

function createDB() {
  idb.open('restaurants-reviews', 1, function (upgradeDB) {

    console.log("Creating Restaurant List Object Store");

    upgradeDB.createObjectStore('restaurants', {keyPath: 'id'});

    for (var i = 1; i <= 10; i++) {
      upgradeDB.createObjectStore('reviews-' + i, {keyPath: 'id'})
    }
    // var reviewStore = upgradeDB.createObjectStore('reviews', {keyPath: 'id'})
  })
}

self.addEventListener('activate', event => {
  event.waitUntil(
    createDB()
  )
});

self.addEventListener('activate', event => {
  event.waitUntil(self.clients.claim());
});

// Background sync of review

self.addEventListener('sync', function (event) {
  if (event.tag === 'outbox') {
    event.waitUntil(fetchReview()
      .then(() => {
        console.log("Successfully Synced")
      })
      .catch((error) => {
        console.log("Error syncing the reviews",error);
      })
    );
  }
});


function fetchReview() {

  // Opens indexDB
  return idb.open('review', 1)
    .then(function (db) {
      var transaction = db.transaction('outbox', 'readonly');
      return transaction.objectStore('outbox').getAll();
    }).then(function (reviews) {

      return Promise.all(reviews.map(function (review) {

        var reviewID = review.id;

        delete review.id;

        console.log("review inside promis", review);

        // Fetching request the review
        return fetch('http://localhost:1337/reviews', {
          method: 'POST',
          body: JSON.stringify(review),
          headers: {
            'Accept': 'application/json',
            'Content-Type': 'application/json'
          }
        }).then(function (response) {
          console.log(response);
          return response.json();
        }).then(function (data) {

          console.log("Successfully Added data ", data);

          if (data) {
            // Deleting data from indexDB
            idb.open('review', 1)
              .then(function (db) {
                var transaction = db.transaction('outbox', 'readwrite');
                return transaction.objectStore('outbox').delete(reviewID);
              })
          }
        })
      }))

    });
}

/*
 * Adds data to Database
 */

function addAllToDB(storeName, items) {
  idb.open('restaurants-reviews', 1).then(function (db) {
    var tx = db.transaction(storeName, 'readwrite');
    var store = tx.objectStore(storeName);

    return Promise.all(items.map(function (item) {
        // console.log("Adding Item", item);
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

    // Check if request is an API request
    if (checkForIndexDBRequest(event.request.url)) {
      var lastIndexOfSlash = event.request.url.lastIndexOf('/');

      var storeName = event.request.url.substring(lastIndexOfSlash + 1);

      if (storeName.lastIndexOf('restaurant_id') > 0) {
        storeName = 'reviews-' + storeName.substring(storeName.lastIndexOf('=') + 1);
      }

      console.log(storeName);

      // Open the indexDB database
      return idb.open('restaurants-reviews', 1).then(function (db) {

        var tx = db.transaction(storeName, 'readonly');
        var store = tx.objectStore(storeName);

        // Return items from database
        return store.getAll();
      }).then((rs) => {
        console.log("All Data From IndexDB", rs);

        // If if indexdb doesn't contains data
        if (!rs.length) {
          console.log('Attempting to fetch from network ', event.request.url);
          // Fetches data from network
          return fetch(event.request.url)
            .then((response) => {

              // return response;
              return response.json()
                .then(function (data) {
                  console.log(event.request.url, 'json data', data);

                  // Adds data to database
                  addAllToDB(storeName, data);
                  console.log('Saving to DB and responding from FETCH', data);

                  var init = {
                    status: 200,
                    statusText: "OK",
                    headers: {'Content-Type': 'application/jso'}
                  };

                  const fetchResponse = new Response(JSON.stringify(data), init);
                  return fetchResponse;
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

          const indexDBResponse = new Response(JSON.stringify(rs), init);
          console.log("Response from indexDB to send to fetch ", rs);
          return indexDBResponse;
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


function checkForIndexDBRequest(str) {
  var r1 = /^http:\/\/localhost:1337\/restaurants$/;
  var r2 = /^http:\/\/localhost:1337\/reviews/;

  var m1 = str.match(r1);
  var m2 = str.match(r2);

  if (m1 || m2)
    return 1;

  return 0;

}

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

