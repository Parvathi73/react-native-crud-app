// services/network.js
import { AppState } from 'react-native';
import { API_URL } from './api';

let listeners = [];
let isOnline = true;
let checkInterval = null;
let appStateSubscription = null;

/**
 * Checks connection by pinging the API URL or another reliable endpoint.
 */
export const checkConnection = async () => {
  let status = false;
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3000);

    // Ping mockapi domain or standard URL to verify connectivity
    const response = await fetch(API_URL, {
      method: 'GET',
      headers: { 'Cache-Control': 'no-cache' },
      signal: controller.signal,
    });

    clearTimeout(timeoutId);
    
    // Any HTTP response or basic resolution means we have internet and can reach server
    status = response.ok || response.status >= 200;
  } catch (error) {
    status = false;
  }

  if (status !== isOnline) {
    isOnline = status;
    listeners.forEach((listener) => listener(isOnline));
  }
  return isOnline;
};

/**
 * Initialize network monitoring.
 * @param {Function} onStatusChange Callback function when connection status changes.
 */
export const initNetworkMonitoring = (onStatusChange) => {
  if (onStatusChange) {
    listeners.push(onStatusChange);
    // Notify immediately of current status
    onStatusChange(isOnline);
  }

  if (!checkInterval) {
    // Check connection every 8 seconds
    checkInterval = setInterval(checkConnection, 8000);
    // Initial check
    checkConnection();
  }

  if (!appStateSubscription) {
    appStateSubscription = AppState.addEventListener('change', (nextAppState) => {
      if (nextAppState === 'active') {
        checkConnection();
      }
    });
  }
};

/**
 * Remove network listener and clean up if no listeners remain.
 * @param {Function} onStatusChange Callback function to remove.
 */
export const removeNetworkListener = (onStatusChange) => {
  listeners = listeners.filter((l) => l !== onStatusChange);
  
  if (listeners.length === 0) {
    if (checkInterval) {
      clearInterval(checkInterval);
      checkInterval = null;
    }
    if (appStateSubscription) {
      if (appStateSubscription.remove) {
        appStateSubscription.remove();
      } else {
        // Fallback for older React Native versions
        AppState.removeEventListener('change', appStateSubscription);
      }
      appStateSubscription = null;
    }
  }
};

/**
 * Get the last known online status synchronously.
 */
export const getOnlineStatus = () => isOnline;
