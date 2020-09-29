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
    },
  }
};

