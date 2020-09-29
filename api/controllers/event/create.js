const distance = require('google-distance-matrix');

const {
  event: Event,
  order: Order,
  warehouse: Warehouse,
  truck: Truck,
  eventhaswarehouse: EventHasWarehouse,
  eventhastruck: EventHasTruck,
  warehousehasorder: WarehouseHasOrder,
} = sails.models;


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
const getOrderedtOriginIndexes = function (origins, destinations) {
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
const getDistancePrice = function (distance) {
  if (distance < 1000) {
    // minimal value, 5 usd
    return 5;
  }

  return (distance / 1000) * 5;
};

/**
 *
 * @param {Number} distance Distance in meters
 *
 * @returns {Object}
 */
const sendIsOptimal = function (distance) {
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
const getOptimalOrigins = async function (origins, destinations) {
  const orderedOrigins = await getOrderedtOriginIndexes(origins, destinations);

  for (const orderedOrigin in orderedOrigins) {
    const { distance } = orderedOrigin;

    const { distanceCost, isOptimal } = sendIsOptimal(distance);

    orderedOrigins[orderedOrigin].isOptimal = isOptimal;
    orderedOrigins[orderedOrigin].distanceCost = distanceCost;
  }

  return orderedOrigins;
};

module.exports = {
  friendlyName: 'Create',
  description: 'Create something.',
  inputs: {
    order: {
      type: 'string',
      required: true
    },
    eventType: {
      type: 'string',
      isIn: [ 'SEND_TO_WAREHOUSE', 'IN_WAREHOUSE', 'SEND_TO_CUSTOMER', 'DELIVERED', 'RETURNED_TO_WAREHOUSE' ],
      required: true
    },
    truck: {
      type: 'number',
      required: true
    },
    warehouse: {
      type: 'number'
    }
  },
  exits: {

  },
  fn: async function ({order: orderId, eventType, truck: truckId, warehouse: warehouseId }) {
    const order = await Order.findOne({id: orderId}).populate('events').populate('customerAddress');

    if(!order) {
      //TODO: no order exists
    }

    sails.log('Order Exists!', order);

    const { events } = order;

    const eventsCount = events.length;
    const lastEvent = events.pop();

    sails.log('Order Events total', eventsCount);
    sails.log('Last Event', lastEvent);

    let newEvent;

    switch(eventType) {
      case 'SEND_TO_WAREHOUSE':

        if (eventsCount && lastEvent && lastEvent.eventType !== 'SEND_TO_CUSTOMER') {
          //TODO: throw "MUST BE A PREVIOUS EVENT SEND_TO_CUSTOMER" or be the first event
        }

        const warehouses = await Warehouse.find({});

        if (!warehouses) {
          sails.log('Warehouse not found');
          //TODO: throw error
        }

        sails.log('Warehouses',  warehouses);

        const truck = await Truck.findOne({id: truckId});

        if (!truck) {
          sails.log('Truck not found');
          //TODO: throw error
        }

        sails.log('Truck',  truck);

        // make a coordinate array of GeoJSON point coordinates [long, lat] https://tools.ietf.org/html/rfc7946#section-9
        // joined with "," https://github.com/ecteodoro/google-distance-matrix#origins

        const origins = warehouses.map((({position: {coordinates: [long, lat]}}) => [lat,long].join(',')));
        const { customerAddress: { position: { coordinates: [addressLong, addressLat] } } } = order;

        const destinations = [ [ addressLat, addressLong ].join(',') ];

        sails.log('Origins Coordinates', origins);
        sails.log('Destinations Coordinates', destinations);

        //TODO: handle error getOptimalOrigins
        const optimalOrigins = await getOptimalOrigins(origins, destinations);

        sails.log('Origins Ordered', optimalOrigins);

        const existsOptimal = !!warehouses.filter(({isOptimal}) => isOptimal).length;

        sails.log('Origins Optimal exist', existsOptimal);

        let nearestWarehouse;

        for (const { distanceCost: currentDistanceCost, isOptimal, originalIndex: warehouseIndex } of optimalOrigins) {
          const warehouse = warehouses[parseInt(warehouseIndex)];

          sails.log('Current warehouse id', warehouse.id);

          const orderCount = await WarehouseHasOrder.count({warehouse: warehouse.id});

          sails.log('Current warehouse total packages', orderCount);

          // cant send to warehouse with 95% capacity
          if ( (warehouse.maxCapicity / orderCount) >= 0.95 ) {
            sails.log('warehouse limit reached');

            continue;
          }

          // Not exists optimal origin, send to nearest
          if (!existsOptimal) {
            sails.log('warehouse with optimal cost not exists, send to nearest');

            nearestWarehouse = warehouse;

            break;
          }

          // first optimal origin
          if (isOptimal) {
            sails.log('Current warehuose is optimal, send');

            nearestWarehouse = warehouse;

            break;
          }

          // search if is better to wait one more day (distance cost + cost per day delay)
          const warehouseToWait = optimalOrigins.find(({distanceCost}) => (distanceCost + 70) < currentDistanceCost);

          // if not, send to nearest warehouse
          if (!warehouseToWait) {
            sails.log('Send package to current');

            nearestWarehouse = warehouse;

            break;
          }

          sails.log('Is better to wait');

          //TODO: Throw
        }

        const newEventData = {
          order: orderId,
          eventType
        };

        newEvent = await Event.create(newEventData).fetch();

        sails.log('New Event Created!', newEvent);

        const newEventHasWarehouseData = {event: newEvent.id, warehouse: nearestWarehouse.id};
        const newEventHasTruckData = {event: newEvent.id, truck: truck.id};
        const newWarehouseHasOrderData = {warehouse: nearestWarehouse.id, order: order.id};

        await Promise.all([EventHasTruck.create(newEventHasTruckData), EventHasWarehouse.create(newEventHasWarehouseData), WarehouseHasOrder.create(newWarehouseHasOrderData)]);

        sails.log('Associations created');

        newEvent = await Event.findOne({id: newEvent.id}).populate('trucks').populate('warehouses')

        sails.log('Truck and Warehouse data populated', newEvent);
        break;
      case 'IN_WAREHOUSE':
        break;
      case 'SEND_TO_CUSTOMER':
        break;
      case 'DELIVERED':
        break;
    }

    return newEvent;
  }


};
