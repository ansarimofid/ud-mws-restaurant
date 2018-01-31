if ('serviceWorker' in navigator) {
  navigator.serviceWorker
    .register('/sw.min.js')
    .then(function (reg) {
      if ('sync' in reg) {
        // do stuff here

        if (window.location.pathname === '/restaurant.html') {

          var form = document.querySelector('#review-form');
          var name = form.querySelector('#name');
          var rating = form.querySelector('#rating');
          var comment = form.querySelector('#comment');
          var restaurantId = getParameterByName('id');

          form.addEventListener('submit', (e) => {
            e.preventDefault();

            var review = {
              restaurant_id: restaurantId,
              name: name.value,
              rating: rating.options[rating.selectedIndex].value,
              comments: comment.value
            };


            idb.open('review', 1, function (upgradeDb) {
              upgradeDb.createObjectStore('outbox', {autoIncrement: true, keyPath: 'id'});
            }).then(function (db) {
              var transaction = db.transaction('outbox', 'readwrite');
              return transaction.objectStore('outbox').put(review);
            }).then(function () {
              name.value = '';
              comment.value = '';
              rating.selectedIndex = 0;
              // register for sync and clean up the form
              return reg.sync.register('outbox').then(() => {
                console.log('Sync registered');
              });
            });

          });
        }
      }
    }).catch(function (err) {
    console.error(err); // the Service Worker didn't install correctly
    form.submit();
  });
}