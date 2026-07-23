// services/sync.js
import AsyncStorage from '@react-native-async-storage/async-storage';
import { deleteUser } from './api';
import { checkConnection } from './network';

const DELETE_QUEUE_KEY = 'offline_delete_queue';

/**
 * Retrieve the current queue of employee IDs pending deletion.
 */
export const getDeleteQueue = async () => {
  try {
    const queue = await AsyncStorage.getItem(DELETE_QUEUE_KEY);
    return queue ? JSON.parse(queue) : [];
  } catch (error) {
    console.error('Error reading delete queue:', error);
    return [];
  }
};

/**
 * Add an employee ID to the offline delete queue.
 */
export const addToDeleteQueue = async (id) => {
  try {
    const queue = await getDeleteQueue();
    const stringId = String(id);
    if (!queue.includes(stringId)) {
      const updatedQueue = [...queue, stringId];
      await AsyncStorage.setItem(DELETE_QUEUE_KEY, JSON.stringify(updatedQueue));
      console.log(`Added employee ${id} to offline delete queue. Queue size: ${updatedQueue.length}`);
    }
  } catch (error) {
    console.error('Error adding to delete queue:', error);
  }
};

/**
 * Sync the queued deletions with MockAPI.
 * @param {Function} onItemSynced Optional callback invoked when an item is successfully deleted.
 * @returns {Promise<boolean>} True if all items synced successfully, false if sync failed due to network.
 */
export const syncDeleteQueue = async (onItemSynced) => {
  // Verify online status
  const online = await checkConnection();
  if (!online) return false;

  let queue = await getDeleteQueue();
  if (queue.length === 0) return true;

  console.log(`Starting sync of delete queue. Total items: ${queue.length}`);
  const remainingQueue = [];

  for (const id of queue) {
    try {
      // Attempt delete request
      await deleteUser(id);
      console.log(`Successfully synced deletion of user: ${id}`);
      if (onItemSynced) {
        onItemSynced(id);
      }
    } catch (error) {
      console.log(`Failed to sync delete for user ${id}:`, error);

      // Distinguish network failure from API errors (like 404 Not Found)
      // If the error message indicates a network/connectivity issue, keep it in queue
      const isNetworkError =
        !error.message ||
        error.message.toLowerCase().includes('network') ||
        error.message.toLowerCase().includes('failed to fetch') ||
        error.message.toLowerCase().includes('timeout');

      if (isNetworkError) {
        remainingQueue.push(id);
      } else {
        // Discard 404 (not found) or similar client errors because they cannot be resolved on retry
        console.log(`Discarding id ${id} from queue because it is already deleted or invalid on server.`);
      }
    }
  }

  // Update AsyncStorage with remaining items (in case of network failure mid-sync)
  await AsyncStorage.setItem(DELETE_QUEUE_KEY, JSON.stringify(remainingQueue));
  return remainingQueue.length === 0;
};
