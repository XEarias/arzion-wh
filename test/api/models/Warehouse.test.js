const WarehouseModel = require('../../../api/models/Warehouse');

const mockGoogleDistanceMatrix = jest.fn();

jest.mock('google-distance-matrix', () => ({ matrix: mockGoogleDistanceMatrix }));

describe('Warehouse Model', () => {
  describe('Function getDistancePrice', () => {
    describe('With a value < 5000 meters', () => {
      const result = WarehouseModel.getDistancePrice(100);

      test('Must return a number with value "1"', () => {
        expect(result).toStrictEqual(1);
      });
    });
    describe('With a value > 5000 meters', () => {
      const result = WarehouseModel.getDistancePrice(100000000);

      test('Must return a number with value "20000"', () => {
        expect(result).toStrictEqual(20000);
      });
    });
  });

  describe('Function sendIsOptimal', () => {
    describe('With a optimal value (50 km)', () => {
      const result = WarehouseModel.sendIsOptimal(50000);

      test('Must return a Object not Null', () => {
        expect(typeof result).toBe('object');
        expect(result).not.toBeNull();
      });

      test('Must have a property "isOptimal", with value "true"', () => {
        expect(result.isOptimal).toStrictEqual(true);
      });

      test('Must have a property "distanceCost", with value ', () => {
        expect(result.distanceCost).toStrictEqual(10);
      });
    });

    describe('With a subOptimal value (50000 km)', () => {
      const result = WarehouseModel.sendIsOptimal(50000000);

      test('Must return a Object not Null', () => {
        expect(typeof result).toBe('object');
        expect(result).not.toBeNull();
      });

      test('Must have a property "isOptimal", with value "false"', () => {
        expect(result.isOptimal).toStrictEqual(false);
      });

      test('Must have a property "distanceCost", with value ', () => {
        expect(result.distanceCost).toStrictEqual(10000);
      });
    });
  });

  describe('Function getOrderedtOriginIndexes', () => {
    afterEach(mockGoogleDistanceMatrix.mockReset);

    describe('Distance matrix return error', () => {
      beforeEach(() => {
        mockGoogleDistanceMatrix.mockImplementationOnce((origins, destinations, callback) => callback(new Error('MockError')));
      });

      test('Must be a rejected promise defined', async () => {
        await expect(WarehouseModel.getOrderedtOriginIndexes(['-34.611795,-58.429675'], ['-58.429675,-34.611795'])).rejects.toThrow('MockError');
      });
    });
    describe('Distance matrix return no Distances object', () => {
      beforeEach(() => {
        mockGoogleDistanceMatrix.mockImplementationOnce((origins, destinations, callback) => callback(null));
      });

      test('Must be a rejected promise "NO_DISTANCES"', async () => {
        await expect(WarehouseModel.getOrderedtOriginIndexes(['-34.611795,-58.429675'], ['-58.429675,-34.611795'])).rejects.toThrow('NO_DISTANCES');
      });
    });
    describe('Distance matrix return Distances object with bad status', () => {
      beforeEach(() => {
        mockGoogleDistanceMatrix.mockImplementationOnce((origins, destinations, callback) => callback(null, {status: 'FAIL'}));
      });

      test('Must be a rejected promise "NO_STATUS_OK"', async () => {
        await expect(WarehouseModel.getOrderedtOriginIndexes(['-34.611795,-58.429675'], ['-58.429675,-34.611795'])).rejects.toThrow('NO_STATUS_OK');
      });
    });
    describe('Matrix return Distances object with ok status, returning 2 distances Objects', () => {
      beforeEach(() => {
        const distancesData = {
          status: 'OK',
          rows: [
            {
              elements: [
                {
                  status: 'OK',
                  distance: {
                    value: 1000
                  }
                }
              ]
            },
            {
              elements: [
                {
                  status: 'OK',
                  distance: {
                    value: 200
                  }
                }
              ]
            }
          ]
        };

        mockGoogleDistanceMatrix.mockImplementationOnce((origins, destinations, callback) => callback(null, distancesData));
      });

      test('Must be a promise fullfiled', async () => {
        await expect(WarehouseModel.getOrderedtOriginIndexes(['-34.611795,-58.429675', '-34.611795,-58.429675'], ['-58.429675,-34.611795'])).resolves.toBeDefined();
      });

      test('Must return a array with DistanceObjects, 2 items, ordered DESC by distance', async () => {
        const distancesObjects =  await WarehouseModel.getOrderedtOriginIndexes(['-34.611795,-58.429675', '-34.611795,-58.429675'], ['-58.429675,-34.611795']);

        await expect(distancesObjects).toMatchObject([
          { originalIndex: '1', distance: 200 },
          { originalIndex: '0', distance: 1000 }
        ]);
      });
    });
  });

  describe('Function getOptimalOrigins', () => {
    afterEach(mockGoogleDistanceMatrix.mockReset);

    describe('getOrderedtOriginIndexes throw error', () => {
      beforeEach(() => {
        mockGoogleDistanceMatrix.mockImplementationOnce((origins, destinations, callback) => callback(new Error('MockError')));
      });

      test('Must be a rejected promise defined', async () => {
        await expect(WarehouseModel.getOptimalOrigins(['-34.611795,-58.429675'], ['-58.429675,-34.611795'])).rejects.toThrow('MockError');
      });
    });
    describe('getOrderedtOriginIndexes return distances', () => {
      beforeEach(() => {
        const distancesData = {
          status: 'OK',
          rows: [
            {
              elements: [
                {
                  status: 'OK',
                  distance: {
                    value: 1000
                  }
                }
              ]
            },
            {
              elements: [
                {
                  status: 'OK',
                  distance: {
                    value: 200
                  }
                }
              ]
            }
          ]
        };

        mockGoogleDistanceMatrix.mockImplementationOnce((origins, destinations, callback) => callback(null, distancesData));
      });

      test('Must be a promise fullfiled', async () => {
        await expect(WarehouseModel.getOptimalOrigins(['-34.611795,-58.429675', '-34.611795,-58.429675'], ['-58.429675,-34.611795'])).resolves.toBeDefined();
      });

      test('Must return a array with DistanceObjects, 2 items, ordered DESC by cost and distance,', async () => {
        const distancesObjects = await WarehouseModel.getOptimalOrigins(['-34.611795,-58.429675', '-34.611795,-58.429675'], ['-58.429675,-34.611795']);

        expect(distancesObjects).toMatchObject([
          {
            'distance': 200,
            'distanceCost': 1,
            'isOptimal': true,
            'originalIndex': '1'
          },
          {
            'distance': 1000,
            'distanceCost': 1,
            'isOptimal': true,
            'originalIndex': '0'
          }
        ]);
      });
    });
  });
});


