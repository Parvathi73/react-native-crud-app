// __tests__/sync.test.js
import { getDeleteQueue, addToDeleteQueue, syncDeleteQueue } from '../services/sync';
import { deleteUser } from '../services/api';
import { checkConnection } from '../services/network';

// Mock AsyncStorage
jest.mock('@react-native-async-storage/async-storage', () => {
  let cache = {};
  return {
    getItem: jest.fn(async (key) => cache[key] || null),
    setItem: jest.fn(async (key, val) => {
      cache[key] = String(val);
    }),
    clear: jest.fn(async () => {
      cache = {};
    }),
  };
});

// Mock services/api
jest.mock('../services/api', () => ({
  deleteUser: jest.fn(),
  API_URL: 'https://6a61df59da10c59c1809f388.mockapi.io/api/v1/users',
}));

// Mock services/network
jest.mock('../services/network', () => ({
  checkConnection: jest.fn(),
}));

describe('Offline Delete Queue Sync', () => {
  beforeEach(async () => {
    jest.clearAllMocks();
    const mockStorage = require('@react-native-async-storage/async-storage');
    await mockStorage.clear();
  });

  test('getDeleteQueue returns empty array by default', async () => {
    const queue = await getDeleteQueue();
    expect(queue).toEqual([]);
  });

  test('addToDeleteQueue adds items correctly', async () => {
    await addToDeleteQueue(123);
    await addToDeleteQueue('456');
    const queue = await getDeleteQueue();
    expect(queue).toEqual(['123', '456']);
  });

  test('syncDeleteQueue does nothing if offline', async () => {
    checkConnection.mockResolvedValue(false);
    await addToDeleteQueue(123);

    const success = await syncDeleteQueue();
    expect(success).toBe(false);
    expect(deleteUser).not.toHaveBeenCalled();

    const queue = await getDeleteQueue();
    expect(queue).toEqual(['123']);
  });

  test('syncDeleteQueue process successfully online', async () => {
    checkConnection.mockResolvedValue(true);
    deleteUser.mockResolvedValue({ id: '123' });
    await addToDeleteQueue('123');

    const success = await syncDeleteQueue();
    expect(success).toBe(true);
    expect(deleteUser).toHaveBeenCalledWith('123');

    const queue = await getDeleteQueue();
    expect(queue).toEqual([]);
  });

  test('syncDeleteQueue retains item in queue if network error occurs during sync', async () => {
    checkConnection.mockResolvedValue(true);
    deleteUser.mockRejectedValue(new Error('Network request failed'));
    await addToDeleteQueue('123');

    const success = await syncDeleteQueue();
    expect(success).toBe(false);
    expect(deleteUser).toHaveBeenCalledWith('123');

    const queue = await getDeleteQueue();
    expect(queue).toEqual(['123']);
  });

  test('syncDeleteQueue discards item if 404 (already deleted) occurs during sync', async () => {
    checkConnection.mockResolvedValue(true);
    deleteUser.mockRejectedValue(new Error('Not Found')); // API error, not network error
    await addToDeleteQueue('123');

    const success = await syncDeleteQueue();
    expect(success).toBe(true); // Sync succeeded (queue cleared)
    expect(deleteUser).toHaveBeenCalledWith('123');

    const queue = await getDeleteQueue();
    expect(queue).toEqual([]);
  });
});
