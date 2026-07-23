import React, { useState, useEffect, useCallback } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  ActivityIndicator,
  RefreshControl,
  TouchableOpacity,
  Alert,
} from 'react-native';

import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  fetchUsers,
  deleteUser,
} from '../services/api';
import {
  initNetworkMonitoring,
  removeNetworkListener,
  checkConnection,
} from '../services/network';
import {
  addToDeleteQueue,
  syncDeleteQueue,
} from '../services/sync';

export default function DetailsScreen({ navigation }) {
  const [userInfo, setUserInfo] = useState({ name: '', email: '' });
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [syncState, setSyncState] = useState('idle'); // 'idle' | 'syncing' | 'synced' | 'offline'

  useEffect(() => {
    const getUser = async () => {
      const data = await AsyncStorage.getItem('currentUser');

      if (data) {
        setUserInfo(JSON.parse(data));
      }
    };

    getUser();
  }, []);

  // Set up network monitoring and auto-synchronization
  useEffect(() => {
    let dismissTimeout;
    
    const handleNetworkChange = async (online) => {
      if (online) {
        setSyncState('syncing');
        const success = await syncDeleteQueue();
        if (success) {
          setSyncState('synced');
          // Reload the list of users from API to ensure synchronization is reflected
          loadUsers(false);
          dismissTimeout = setTimeout(() => {
            setSyncState('idle');
          }, 3000);
        } else {
          setSyncState('offline');
        }
      } else {
        setSyncState('offline');
      }
    };

    initNetworkMonitoring(handleNetworkChange);

    return () => {
      removeNetworkListener(handleNetworkChange);
      if (dismissTimeout) {
        clearTimeout(dismissTimeout);
      }
    };
  }, []);

  const loadUsers = async (showSpinner = true) => {
    try {
      if (showSpinner) {
        setLoading(true);
      }

      const online = await checkConnection();

      if (online) {
        const data = await fetchUsers();
        setUsers(data);
        await AsyncStorage.setItem('users', JSON.stringify(data));
        setError('');
      } else {
        setSyncState('offline');
        const cache = await AsyncStorage.getItem('users');
        if (cache) {
          setUsers(JSON.parse(cache));
          setError('');
        } else {
          setError('Unable to load employees. You are offline.');
        }
      }
    } catch (e) {
      console.log('Error loading users:', e);
      const cache = await AsyncStorage.getItem('users');
      if (cache) {
        setUsers(JSON.parse(cache));
        setError('');
      } else {
        setError('Unable to load employees.');
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      loadUsers();
      // Also try syncing queued deletes on focus
      syncDeleteQueue().then((success) => {
        if (success) {
          loadUsers(false);
        }
      });
    }, [])
  );

  const onRefresh = async () => {
    setRefreshing(true);
    const online = await checkConnection();

    if (online) {
      setSyncState('syncing');
      const success = await syncDeleteQueue();
      if (success) {
        setSyncState('synced');
        setTimeout(() => setSyncState('idle'), 3000);
      } else {
        setSyncState('offline');
      }
    }

    await loadUsers(false);
    setRefreshing(false);
  };

  const logout = () => {
    Alert.alert(
      'Logout',
      'Are you sure you want to logout?',
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Logout',
          style: 'destructive',
          onPress: async () => {
            await AsyncStorage.removeItem('currentUser');
            navigation.replace('Form');
          },
        },
      ]
    );
  };

  const handleDelete = (id) => {
    Alert.alert(
      'Delete Employee',
      'Are you sure you want to delete this employee?',
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            const previousUsers = [...users];

            // 1. Optimistic Update: Update local state immediately
            const updatedUsers = users.filter((item) => item.id !== id);
            setUsers(updatedUsers);

            // 2. Optimistic Update: Cache updated list locally
            await AsyncStorage.setItem('users', JSON.stringify(updatedUsers));

            try {
              const online = await checkConnection();
              if (!online) {
                // Device is offline, queue deletion
                await addToDeleteQueue(id);
                setSyncState('offline');
                return;
              }

              // Device is online, request MockAPI
              await deleteUser(id);
              console.log(`Successfully deleted employee ${id} on server.`);
            } catch (err) {
              console.log('Error deleting user:', err);

              const isNetworkError =
                !err.message ||
                err.message.toLowerCase().includes('network') ||
                err.message.toLowerCase().includes('failed to fetch') ||
                err.message.toLowerCase().includes('timeout');

              if (isNetworkError) {
                // Network error: add to offline delete queue
                await addToDeleteQueue(id);
                setSyncState('offline');
              } else {
                // API error: Rollback optimistic updates
                setUsers(previousUsers);
                await AsyncStorage.setItem('users', JSON.stringify(previousUsers));
                Alert.alert(
                  'Delete Failed',
                  err.message || 'Unable to delete employee from server. Reverting changes.'
                );
              }
            }
          },
        },
      ]
    );
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#2563EB" />
        <Text>Loading team members...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.center}>
        <Text style={{ color: 'red' }}>{error}</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {syncState !== 'idle' && (
        <View
          style={[
            styles.syncBanner,
            syncState === 'offline' && styles.bannerOffline,
            syncState === 'syncing' && styles.bannerSyncing,
            syncState === 'synced' && styles.bannerSynced,
          ]}
        >
          <Text style={styles.bannerText}>
            {syncState === 'offline' && '⚠️ Offline Mode (Deletes are queued)'}
            {syncState === 'syncing' && '🔄 Syncing offline deletes...'}
            {syncState === 'synced' && '✅ Changes synchronized successfully!'}
          </Text>
        </View>
      )}

      <View style={styles.headerCard}>
        <Text style={styles.welcome}>👋 Welcome Back</Text>
        <Text style={styles.userName}>{userInfo.name}</Text>
        <Text style={styles.userEmail}>📧 {userInfo.email}</Text>

        <TouchableOpacity style={styles.logoutBtn} onPress={logout}>
          <Text style={styles.logoutText}>Logout</Text>
        </TouchableOpacity>
      </View>

      <Text style={styles.heading}>CoreConnect Members</Text>

      <FlatList
        data={users}
        keyExtractor={(item) => String(item.id)}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
          />
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyIcon}>👥</Text>
            <Text style={styles.emptyTitle}>
              No Employees Found
            </Text>
            <Text style={styles.emptyText}>
              Add a new employee to get started.
            </Text>
          </View>
        }
        ItemSeparatorComponent={() => (
          <View style={{ height: 14 }} />
        )}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 40 }}
        renderItem={({ item }) => (
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>
                  {item.name?.charAt(0).toUpperCase()}
                </Text>
              </View>

              <View style={{ flex: 1 }}>
                <Text style={styles.name}>
                  {item.name}
                </Text>

                <Text style={styles.info}>
                  📧 {item.email}
                </Text>

                <Text style={styles.info}>
                  📞 {item.phone}
                </Text>
              </View>
            </View>

            <View style={styles.buttonRow}>
              <TouchableOpacity
                style={styles.editBtn}
                onPress={() =>
                  navigation.navigate('Form', {
                    user: item,
                  })
                }
              >
                <Text style={styles.editText}>
                  Edit
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.deleteBtn}
                onPress={() =>
                  handleDelete(item.id)
                }
              >
                <Text style={styles.deleteText}>
                  Delete
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    backgroundColor: '#fff',
  },

  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },

  headerCard: {
    backgroundColor: '#2563EB',
    padding: 20,
    borderRadius: 15,
    marginBottom: 20,
    elevation: 4,
  },

  welcome: {
    color: '#fff',
    fontSize: 18,
  },

  userName: {
    color: '#fff',
    fontSize: 25,
    fontWeight: 'bold',
    marginTop: 5,
  },

  userEmail: {
    color: '#E5E7EB',
    marginTop: 5,
  },

  logoutBtn: {
    backgroundColor: '#fff',
    padding: 10,
    borderRadius: 8,
    marginTop: 15,
    alignItems: 'center',
  },

  logoutText: {
    color: '#2563EB',
    fontWeight: 'bold',
  },

  heading: {
    fontSize: 22,
    fontWeight: 'bold',
    marginBottom: 15,
    color: '#1F2937',
  },

  card: {
    backgroundColor: '#fff',
    padding: 18,
    borderRadius: 12,
    elevation: 3,
  },

  name: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1F2937',
  },

  info: {
    marginTop: 6,
    fontSize: 15,
    color: '#4B5563',
  },

  editBtn: {
    flex: 1,
    backgroundColor: '#2563EB',
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
    marginRight: 8,
  },

  editText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 15,
  },

  deleteBtn: {
    flex: 1,
    backgroundColor: '#DC2626',
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
    marginLeft: 8,
  },

  deleteText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 15,
  },

  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },

  avatar: {
    width: 55,
    height: 55,
    borderRadius: 30,
    backgroundColor: '#2563EB',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 15,
  },

  avatarText: {
    color: '#fff',
    fontSize: 22,
    fontWeight: 'bold',
  },

  buttonRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 18,
  },

  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 80,
  },

  emptyIcon: {
    fontSize: 55,
  },

  emptyTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    marginTop: 15,
    color: '#374151',
  },

  emptyText: {
    marginTop: 8,
    color: '#6B7280',
    fontSize: 15,
    textAlign: 'center',
  },

  syncBanner: {
    paddingVertical: 10,
    paddingHorizontal: 15,
    borderRadius: 8,
    marginBottom: 15,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },

  bannerOffline: {
    backgroundColor: '#FEF3C7',
    borderColor: '#F59E0B',
    borderWidth: 1,
  },

  bannerSyncing: {
    backgroundColor: '#DBEAFE',
    borderColor: '#3B82F6',
    borderWidth: 1,
  },

  bannerSynced: {
    backgroundColor: '#D1FAE5',
    borderColor: '#10B981',
    borderWidth: 1,
  },

  bannerText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1F2937',
    textAlign: 'center',
  },
});