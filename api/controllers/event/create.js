const {
  event: Event,
  order: Order,
  warehouse: Warehouse,
  truck: Truck,
  eventhaswarehouse: EventHasWarehouse,
  eventhastruck: EventHasTruck,
  warehousehasorder: WarehouseHasOrder,
} = sails.models;

module.exports = {
  friendlyName: 'Create',
  description: 'Create something.',
  inputs: {
    order: {
      type: 'number',
      required: true
    },
    eventType: {
      type: 'string',
      isIn: [ 'SEND_TO_WAREHOUSE', 'IN_WAREHOUSE', 'SEND_TO_CUSTOMER', 'DELIVERED'],
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
    unprocessableEntity: {
      responseType: 'unprocessableEntity'
    },
    dataNotLoaded: {
      responseType: 'dataNotLoaded'
    },
    dataConflict: {
      responseType: 'dataConflict'
    }
  },
  fn: async function ({order: orderId, eventType, truck: truckId, warehouse: warehouseId }) {
    const order = await Order.findOne({id: orderId}).populate('events').populate('customerAddress');

    if(!order) {
      throw { unprocessableEntity:  { entity: 'order', id: orderId } };
    }

    sails.log('Order Exists!', order);

    const { events } = order;

    const eventsCount = events.length;
    const lastEvent = events.pop();

    sails.log('Order Events total', eventsCount);
    sails.log('Last Event', lastEvent);

    if (lastEvent && lastEvent.eventType === 'DELIVERED') {
      throw { dataConflict:  { entity: 'Event', conflict: 'Order was delivered already'} };
    }

    let newEvent;

    switch(eventType) {
      case 'SEND_TO_WAREHOUSE':

        if (eventsCount && lastEvent && lastEvent.eventType !== 'SEND_TO_CUSTOMER') {
          throw { dataConflict:  { entity: 'Event', conflict: 'SEND_TO_WAREHOUSE is invalid, because previous event SEND_TO_CUSTOMER must exist, or no event At all'} };
        }

        const truck = await Truck.findOne({id: truckId});

        if (!truck) {
          sails.log('Truck not found');
          throw { unprocessableEntity:  { entity: 'truck', id: truckId } };
        }

        sails.log('Truck',  truck);

        const { customerAddress: { position: { coordinates: [addressLong, addressLat] } } } = order;

        let nearestWarehouse;

        try {
          nearestWarehouse = await Warehouse.getNearest({addressLat, addressLong});
        } catch (e) {
          switch (e.message) {
            case 'NO_WAREHOUSES':
              throw { unprocessableEntity:  { entity: 'Warehouse' } };
            case 'WAIT_WAREHOUSE':
              throw { dataConflict:  { entity: 'Event', conflict: 'No warehouse is optimal to send, better wait'} };
            default:
              throw e;
          }
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

        newEvent = await Event.findOne({id: newEvent.id}).populate('trucks').populate('warehouses');

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
