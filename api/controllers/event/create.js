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
 * @returns {Origin[]} Nearest Origin's Index
 */
const getOrderedtOriginIndexes = function (origins, destinations) {
  let originIndexes = [];

  distance.matrix(origins, destinations, (err, distances) => {
    if (err) {
      //TODO:
    }

    if(!distances) {
      //TODO:
    }

    if (distances.status !== 'OK') {
      //TODO:
    }

    for (const i in origins) {
      for (const j in destinations) {

        if (distances.rows[0].elements[j].status !== 'OK') {
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
      //THROW
    }

    // Sort descending
    originIndexes.sort(({distance: distanceA}, {distance: distanceB}) => distanceB - distanceA);

    return originIndexes;
  });



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
 * @returns {OptimalOrigin[]} Nearest Origin's Index
 */
const getOptimalOrigins = function (origins, destinations) {
  const orderedOrigins = getOrderedtOriginIndexes(origins, destinations);

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

    const { events } = order;

    const { length: eventsCount } = events;

    let newEvent;

    switch(eventType) {
      case 'SEND_TO_WAREHOUSE':
        const lastEvent = events.pop();

        if (eventsCount && lastEvent && lastEvent.eventType !== 'SEND_TO_CUSTOMER') {
          //TODO: throw "MUST BE A PREVIOUS EVENT SEND_TO_CUSTOMER" or be the first event
        }

        const warehouses = await Warehouse.find({});

        if (!warehouses) {
          //TODO: throw error
        }

        const truck = await Truck.findOne({id: truckId});

        if (!truck) {
          //TODO: throw error
        }

        // make a coordinate array of GeoJSON point coordinates [long, lat] https://tools.ietf.org/html/rfc7946#section-9
        // joined with "," https://github.com/ecteodoro/google-distance-matrix#origins

        const origins = warehouses.map((({position: {coordinates}}) => coordinates.join(',')));
        const { customerAddress: { coordinates: addressCoordinates } } = order;

        const destinations = [ addressCoordinates.join(',') ];

        //TODO: handle error getOptimalOrigins
        const optimalOrigins = getOptimalOrigins(origins, destinations);

        const existsOptimal = !!warehouses.filter(({isOptimal}) => isOptimal).length;

        let nearestWarehouse;


        for (const { distanceCost: currentDistanceCost, isOptimal, originalIndex: warehouseIndex } in optimalOrigins) {
          const warehouse = warehouses[warehouseIndex];

          const orderCount = await WarehouseHasOrder.count({warehouse: warehouse.id});

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

          //TODO: Throw
        }

        const newEventData = {
          order: orderId,
          eventType
        };

        const newEvent = await Event.create(newEventData).fetch();

        const newEventHasWarehouseData = {event: newEvent.id, warehouse: nearestWarehouse.id};
        const newEventHasTruckData = {event: newEvent.id, truck: truck.id};
        const newWarehouseHasOrderData = {warehouse: nearestWarehouse.id, order: order.id};

        await Promise.all([EventHasTruck.create(newEventHasTruckData), EventHasWarehouse.create(newEventHasWarehouseData), WarehouseHasOrder.create(newWarehouseHasOrderData)]);

        await Promise.all([newEvent.populate('truck'), newEvent.populate('warehouse')]);

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
