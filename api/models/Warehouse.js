/**
 * Warehouse.js
 *
 * @description :: A model definition represents a database table/collection.
 * @docs        :: https://sailsjs.com/docs/concepts/models-and-orm/models
 */

module.exports = {
  tableName: 'warehouses',
  attributes: {
    //  ╔═╗╦═╗╦╔╦╗╦╔╦╗╦╦  ╦╔═╗╔═╗
    //  ╠═╝╠╦╝║║║║║ ║ ║╚╗╔╝║╣ ╚═╗
    //  ╩  ╩╚═╩╩ ╩╩ ╩ ╩ ╚╝ ╚═╝╚═╝
    id: {
      type: 'number',
      autoIncrement: true
    },
    name: {
      type: 'string',
      required: true
    },
    maxCapacity: {
      type: 'number',
      columnName: 'max_capacity',
      min: 1,
      max: 1000000
    },
    position: {
      type: 'ref',
      columnType: 'jsonb',
      //TODO: to helper
      custom: function (value) {
        const geoJsonValidation = require('geojson-validation');

        return geoJsonValidation.valid(value);
      }
    },
    addressLine: {
      type: 'ref',
      columnName: 'address_line',
      columnType: 'text[]',
      required: true
    },
    //  ╔═╗╔╦╗╔╗ ╔═╗╔╦╗╔═╗
    //  ║╣ ║║║╠╩╗║╣  ║║╚═╗
    //  ╚═╝╩ ╩╚═╝╚═╝═╩╝╚═╝


    //  ╔═╗╔═╗╔═╗╔═╗╔═╗╦╔═╗╔╦╗╦╔═╗╔╗╔╔═╗
    //  ╠═╣╚═╗╚═╗║ ║║  ║╠═╣ ║ ║║ ║║║║╚═╗
    //  ╩ ╩╚═╝╚═╝╚═╝╚═╝╩╩ ╩ ╩ ╩╚═╝╝╚╝╚═╝
    city: {
      model: 'City',
      columnName: 'city_id'
    },
    trucks: {
      collection: 'Truck',
      via: 'warehouse'
    },
    events: {
      collection: 'event',
      via: 'warehouse',
      through: 'EventHasWarehouse'
    },
    orders: {
      collection: 'order',
      via: 'warehouse',
      through: 'WarehouseHasOrder'
    }
  },
  /*****
   * CUSTOM METHODS
   */

  /**
    *
    * @param {Object} opts
    * @param {Number} otps.addressLong
    * @param {Number} otps.addressLat
    */
  getNearest: async function ({addressLong, addressLat}) {
    const warehouses = await sails.models.warehouse.find({});

    if (!warehouses) {
      throw new Error('NO_WAREHOUSES');
    }

    // make a coordinate array of GeoJSON point coordinates [long, lat] https://tools.ietf.org/html/rfc7946#section-9
    // joined with "," https://github.com/ecteodoro/google-distance-matrix#origins

    const origins = warehouses.map((({position: {coordinates: [long, lat]}}) => [lat,long].join(',')));

    const destinations = [ [ addressLat, addressLong ].join(',') ];

    const optimalOrigins = await getOptimalOrigins(origins, destinations);

    const existsOptimal = !!optimalOrigins.filter(({isOptimal}) => isOptimal).length;

    let nearestWarehouse;

    for (const { distanceCost: currentDistanceCost, isOptimal, originalIndex: warehouseIndex } of optimalOrigins) {
      const warehouse = warehouses[parseInt(warehouseIndex)];

      const orderCount = await sails.models.warehousehasorder.count({warehouse: warehouse.id});

      // cant send to warehouse with 95% capacity
      if ( (warehouse.maxCapicity / orderCount) >= 0.95 ) {
        continue;
      }

      // Not exists optimal origin, send to nearest
      if (!existsOptimal) {
        nearestWarehouse = warehouse;
        break;
      }

      // first optimal origin
      if (isOptimal) {
        nearestWarehouse = warehouse;
        break;
      }

      // search if is better to wait one more day (distance cost + cost per day delay)
      const warehouseToWait = optimalOrigins.find(({distanceCost}) => (distanceCost + 70) < currentDistanceCost);

      // if not, send to nearest warehouse
      if (!warehouseToWait) {
        nearestWarehouse = warehouse;
        break;
      }

      throw new Error('WAIT_WAREHOUSE');
    }

    return nearestWarehouse;
  }
};


/**
 *@typedef Origin
 *@property {Number} distance in meters
 *@property {Number} originalIndex
 */

/**
 *@typedef OptimalOrigin
 *@property {Number} distance in meters
 *@property {Number} originalIndex
 *@property {Boolean} isOptimal
 *@property {Number} distanceCost
 */

/**
 *
 * @param {String[]} origins
 * @param {String[]} destinations
 *
 * @returns {Promise<Origin[]>} Nearest Origin's Index
 */
function getOrderedtOriginIndexes(origins, destinations) {
  const distance = require('google-distance-matrix');

  let originIndexes = [];

  const distancePromise = new Promise((resolve, reject) => {
    distance.matrix(origins, destinations, (err, distances) => {
      if (err) {
        reject(err);
        return;
      }

      if(!distances) {
        reject(new Error('NO_DISTANCES'));
        return;
      }

      if (distances.status !== 'OK') {
        sails.log('Error response', distances);
        reject(new Error('NO_STATUS_OK'));
        return;
      }

      for (const i in origins) {
        for (const j in destinations) {
          sails.log('distances found', distances.rows[i].elements);

          if (distances.rows[i].elements[j].status !== 'OK') {
            continue;
          }

          const origin = distances.rows[i];

          const { distance: { value: distance } } = origin.elements[j];

          const originIndex = {
            originalIndex: i,
            distance
          };

          originIndexes.push(originIndex);
        }
      }

      if(!originIndexes.length) {
        reject(new Error('NO_INDEXES_FOUND'));
        return;
      }

      // Sort descending
      originIndexes.sort(({distance: distanceA}, {distance: distanceB}) => distanceA - distanceB);

      resolve(originIndexes);
    });
  });

  return distancePromise;
};


/**
 *
 * @param {Number} distance Distance in meters
 *
 * @returns {Number}
 */
function getDistancePrice(distance) {
  if (distance < 5000) {
    // minimal value, 1 usd
    return 1;
  }

  // 1 usd per 5 km
  return (distance / 5000);
};

/**
 *
 * @param {Number} distance Distance in meters
 *
 * @returns {Object}
 */
function sendIsOptimal(distance) {
  //70 usd, default late arrival price
  const distanceCost = getDistancePrice(distance);

  const isOptimal = distanceCost < 70;

  return { distanceCost, isOptimal };
};

/**
 *
 * @param {String[]} origins;
 * @param {String[]} destinations;
 *
 * @returns {Promise<OptimalOrigin[]>} Nearest Origin's Index
 */
async function getOptimalOrigins(origins, destinations) {
  const orderedOrigins = await getOrderedtOriginIndexes(origins, destinations);

  for (const orderedOrigin in orderedOrigins) {
    const { distance } = orderedOrigins[orderedOrigin];

    const { distanceCost, isOptimal } = sendIsOptimal(distance);

    orderedOrigins[orderedOrigin].isOptimal = isOptimal;
    orderedOrigins[orderedOrigin].distanceCost = distanceCost;
  }

  return orderedOrigins;
};
