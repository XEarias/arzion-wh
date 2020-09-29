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
    if (!truckId) {
      //TODO: throw 
    }

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

        const truck = await Truck.findOne({id: truckId});

        if (!truck) {
          sails.log('Truck not found');
          //TODO: throw error
        }

        // make a coordinate array of GeoJSON point coordinates [long, lat] https://tools.ietf.org/html/rfc7946#section-9
        // joined with "," https://github.com/ecteodoro/google-distance-matrix#origins

        const origins = warehouses.map((({position: {coordinates}}) => coordinates.join(',')));
        const { customerAddress: { position: { coordinates: addressCoordinates } } } = order;

        const destinations = [ addressCoordinates.join(',') ];

        sails.log('Origins Coordinates', origins);
        sails.log('Destinations Coordinates', destinations);

        //TODO: handle error getOptimalOrigins
        const optimalOrigins = getOptimalOrigins(origins, destinations);

        sails.log('Origins Ordered', optimalOrigins);

        const existsOptimal = !!warehouses.filter(({isOptimal}) => isOptimal).length;

        sails.log('Origins Optimal exist', existsOptimal);

        let nearestWarehouse;

        for (const { distanceCost: currentDistanceCost, isOptimal, originalIndex: warehouseIndex } in optimalOrigins) {
          const warehouse = warehouses[warehouseIndex];

          sails.log('Current warehouse id', warehouse.id);

          const orderCount = await WarehouseHasOrder.count({warehouse: warehouse.id});

          sails.log('Current warehouse total packages', orderCount)

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

        await Promise.all([newEvent.populate('truck'), newEvent.populate('warehouse')]);

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
