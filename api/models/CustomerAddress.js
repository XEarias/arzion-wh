/**
 * CustomerAddress.js
 *
 * @description :: A model definition represents a database table/collection.
 * @docs        :: https://sailsjs.com/docs/concepts/models-and-orm/models
 */

module.exports = {
  tableName: 'customer_addresses',
  attributes: {

    //  ╔═╗╦═╗╦╔╦╗╦╔╦╗╦╦  ╦╔═╗╔═╗
    //  ╠═╝╠╦╝║║║║║ ║ ║╚╗╔╝║╣ ╚═╗
    //  ╩  ╩╚═╩╩ ╩╩ ╩ ╩ ╚╝ ╚═╝╚═╝
    id: {
      type: 'number',
      autoIncrement: true
    },
    receptorName: {
      type: 'string',
      columnName: 'receptor_name',
      required: true
    },
    receptorDocument: {
      type: 'string',
      columnName: 'receptor_document',
      required: true
    },
    receptorPhone: {
      type: 'string',
      columnName: 'receptor_phone',
      required: true
    },
    notes: {
      type: 'string',
      allowNull: true
    },
    addressLine: {
      type: 'ref',
      columnName: 'address_line',
      columnType: 'text[]',
      required: true
    },
    postalCode: {
      type: 'string',
      columnName: 'postal_code',
      required: true,
    },
    position: {
      type: 'ref',
      columnType: 'jsob',
      required: true,
      //TODO: to helper
      custom: function (value) {
        const geoJsonValidation = require('geojson-validation');

        return geoJsonValidation.valid(value);
      }
    },

    //  ╔═╗╔╦╗╔╗ ╔═╗╔╦╗╔═╗
    //  ║╣ ║║║╠╩╗║╣  ║║╚═╗
    //  ╚═╝╩ ╩╚═╝╚═╝═╩╝╚═╝


    //  ╔═╗╔═╗╔═╗╔═╗╔═╗╦╔═╗╔╦╗╦╔═╗╔╗╔╔═╗
    //  ╠═╣╚═╗╚═╗║ ║║  ║╠═╣ ║ ║║ ║║║║╚═╗
    //  ╩ ╩╚═╝╚═╝╚═╝╚═╝╩╩ ╩ ╩ ╩╚═╝╝╚╝╚═╝
    customer: {
      model: 'Customer',
      columnName: 'customer_id'
    }
  },

};

