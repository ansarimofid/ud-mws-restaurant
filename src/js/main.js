let restaurants,
  neighborhoods,
  cuisines
var map
var markers = [];

/**
 * Fetch neighborhoods and cuisines as soon as the page is loaded.
 */
document.addEventListener('DOMContentLoaded', (event) => {
  fetchNeighborhoods();
  fetchCuisines();
});

/**
 * Fetch all neighborhoods and set their HTML.
 */
fetchNeighborhoods = () => {
  DBHelper.fetchNeighborhoods((error, neighborhoods) => {
    if (error) { // Got an error
      console.error(error);
    } else {
      self.neighborhoods = neighborhoods;
      fillNeighborhoodsHTML();
    }
  });
}

/**
 * Set neighborhoods HTML.
 */
fillNeighborhoodsHTML = (neighborhoods = self.neighborhoods) => {
  const select = document.getElementById('neighborhoods-select');
  neighborhoods.forEach(neighborhood => {
    const option = document.createElement('option');
    option.innerHTML = neighborhood;
    option.value = neighborhood;
    option.label = neighborhood;
    select.append(option);
  });
}

/**
 * Fetch all cuisines and set their HTML.
 */
fetchCuisines = () => {
  DBHelper.fetchCuisines((error, cuisines) => {
    if (error) { // Got an error!
      console.error(error);
    } else {
      self.cuisines = cuisines;
      fillCuisinesHTML();
    }
  });
}

/**
 * Set cuisines HTML.
 */
fillCuisinesHTML = (cuisines = self.cuisines) => {
  const select = document.getElementById('cuisines-select');

  cuisines.forEach(cuisine => {
    const option = document.createElement('option');
    option.innerHTML = cuisine;
    option.value = cuisine;
    option.label = cuisine;
    select.append(option);
  });
}

/**
 * Initialize Google map, called from HTML.
 */
window.initMap = () => {
  let loc = {
    lat: 40.722216,
    lng: -73.987501
  };
  self.map = new google.maps.Map(document.getElementById('map'), {
    zoom: 12,
    center: loc,
    scrollwheel: false,
    format: 'jpg'
  });

  updateRestaurants();
};

/**
 * Update page and map for current restaurants.
 */
updateRestaurants = () => {
  const cSelect = document.getElementById('cuisines-select');
  const nSelect = document.getElementById('neighborhoods-select');

  const cIndex = cSelect.selectedIndex;
  const nIndex = nSelect.selectedIndex;

  const cuisine = cSelect[cIndex].value;
  const neighborhood = nSelect[nIndex].value;

  DBHelper.fetchRestaurantByCuisineAndNeighborhood(cuisine, neighborhood, (error, restaurants) => {
    if (error) { // Got an error!
      console.error(error);
    } else {
      resetRestaurants(restaurants);
      fillRestaurantsHTML();
    }
  })
}

/**
 * Clear current restaurants, their HTML and remove their map markers.
 */
resetRestaurants = (restaurants) => {
  // Remove all restaurants
  self.restaurants = [];
  const ul = document.getElementById('restaurants-list');
  ul.innerHTML = '';

  // Remove all map markers
  self.markers.forEach(m => m.setMap(null));
  self.markers = [];
  self.restaurants = restaurants;
}

/**
 * Create all restaurants HTML and add them to the webpage.
 */
fillRestaurantsHTML = (restaurants = self.restaurants) => {
  const ul = document.getElementById('restaurants-list');
  restaurants.forEach(restaurant => {
    ul.append(createRestaurantHTML(restaurant));
  });
  addMarkersToMap();
}

/**
 * Create restaurant HTML.
 */
createRestaurantHTML = (restaurant) => {
  const li = document.createElement('li');
  li.setAttribute('role', 'listitem');

  const favIcon = document.createElement('span');
  favIcon.className = 'fav-icon';
  favIcon.setAttribute('data-id', restaurant.id);
  const favImg = document.createElement('img');


  if (restaurant.is_favorite === 'true') {
    favImg.alt = 'restaurant is favourite';
    favImg.src = 'img/icons/ic_favorite_black_24px.svg';
    favImg.className = 'fav-img fav-fill';
    console.log("Favourite val", restaurant.is_favorite);
  } else {
    favImg.alt = 'restaurant is not favourite';
    favImg.src = 'img/icons/ic_favorite_border_black.svg';
    favImg.className = 'fav-img';
  }

  // Adds EventListner to change favourite options
  favImg.addEventListener('click', (e) => {

    if (e.target === e.currentTarget) {

      var classAttr = e.target.className;

      if (classAttr === 'fav-img') {
        DBHelper.restaurantFavouriteHandler(restaurant.id, true, (error, response) => {
          if (response) {
            favImg.alt = 'restaurant is favourite';
            favImg.src = 'img/icons/ic_favorite_black_24px.svg';
            e.target.className = 'fav-img fav-fill';
          }
          else {
            alert("Something Went Wrong");
            console.log(error);
          }
        })

      } else {
        DBHelper.restaurantFavouriteHandler(restaurant.id, false, (error, response) => {
          if (response) {
            favImg.alt = 'restaurant is not favourite';
            favImg.src = 'img/icons/ic_favorite_border_black.svg';
            e.target.className = 'fav-img';
          }
          else {
            alert("Something Went Wrong");
            console.log(error);
          }
        })
      }
    }
  });

  favIcon.append(favImg);
  li.append(favIcon);


  const image = document.createElement('img');
  image.className = 'restaurant-img js-lazy-image';
  image.alt = restaurant.name + ' restautrant';
  var imgSrc = DBHelper.imageUrlForRestaurant(restaurant);

  image.setAttribute('data-src', imgSrc + '_thumb.webp');
  li.append(image);

  const name = document.createElement('h3');
  name.innerHTML = restaurant.name;
  name.tabIndex = 0;
  li.append(name);

  const neighborhood = document.createElement('p');
  neighborhood.tabIndex = 0;
  neighborhood.innerHTML = restaurant.neighborhood;
  li.append(neighborhood);

  const address = document.createElement('p');
  address.className = 'restaurant-address';
  address.innerHTML = restaurant.address;
  address.tabIndex = 0;
  li.append(address);

  const more = document.createElement('a');
  more.innerHTML = 'View Details';
  more.href = DBHelper.urlForRestaurant(restaurant);
  li.append(more);

  li.onload = lazyLoad();

  return li
}

/**
 * Add markers for current restaurants to the map.
 */
addMarkersToMap = (restaurants = self.restaurants) => {
  restaurants.forEach(restaurant => {
    // Add marker to the map
    const marker = DBHelper.mapMarkerForRestaurant(restaurant, self.map);
    google.maps.event.addListener(marker, 'click', () => {
      window.location.href = marker.url
    });
    self.markers.push(marker);
  });
}

//Adds click event to fav icon

