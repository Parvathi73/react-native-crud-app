import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Alert,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  createUser,
  updateUser,
  fetchUsers,
} from '../services/api';

export default function FormScreen({ navigation, route }) {
  const user = route?.params?.user;

  const [name, setName] = useState(user?.name || '');
  const [email, setEmail] = useState(user?.email || '');
  const [phone, setPhone] = useState(user?.phone || '');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    if (loading) return;

    if (name.trim().length < 5) {
      Alert.alert('Invalid Name', 'Name must contain at least 5 characters.');
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email.trim())) {
      Alert.alert('Invalid Email', 'Please enter a valid email address.');
      return;
    }

    if (!/^\d{10}$/.test(phone.trim())) {
      Alert.alert(
        'Invalid Phone',
        'Phone number must contain exactly 10 digits.'
      );
      return;
    }

    const userData = {
      name: name.trim(),
      email: email.trim(),
      phone: phone.trim(),
    };

    try {
      setLoading(true);

      if (user) {
        await updateUser(user.id, userData);

        await AsyncStorage.setItem(
          'currentUser',
          JSON.stringify(userData)
        );

        Alert.alert('Success', 'Employee updated successfully!');
      } else {
        const existingUsers = await fetchUsers();

        const alreadyExists = existingUsers.some(
          item =>
            item.email?.toLowerCase() ===
            userData.email.toLowerCase()
        );

        if (alreadyExists) {
          Alert.alert(
            'Already Exists',
            'Employee with this email already exists.'
          );
          return;
        }

        await createUser(userData);

        await AsyncStorage.setItem(
          'currentUser',
          JSON.stringify(userData)
        );

        Alert.alert('Success', 'Employee created successfully!');
      }

      setName('');
      setEmail('');
      setPhone('');

      navigation.replace('Details');

    } catch (error) {
      console.log(error);

      Alert.alert(
        'Error',
        error.message || 'Something went wrong.'
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.heading}>CoreConnect</Text>

      <Text style={styles.subHeading}>
        {user ? 'Edit Employee' : 'Employee Registration'}
      </Text>

      <TextInput
        style={styles.input}
        placeholder="Enter Full Name"
        value={name}
        onChangeText={setName}
      />

      <TextInput
        style={styles.input}
        placeholder="Enter Email"
        value={email}
        onChangeText={setEmail}
        keyboardType="email-address"
        autoCapitalize="none"
      />

      <TextInput
        style={styles.input}
        placeholder="Enter Phone Number"
        value={phone}
        onChangeText={setPhone}
        keyboardType="phone-pad"
        maxLength={10}
      />

      <TouchableOpacity
        style={[styles.button, loading && { opacity: 0.7 }]}
        onPress={handleSubmit}
        disabled={loading}
      >
        {loading ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.buttonText}>
            {user ? 'UPDATE EMPLOYEE' : 'SAVE EMPLOYEE'}
          </Text>
        )}
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
    justifyContent: 'center',
    paddingHorizontal: 25,
  },

  heading: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#2563EB',
    textAlign: 'center',
  },

  subHeading: {
    fontSize: 18,
    color: '#6B7280',
    textAlign: 'center',
    marginTop: 5,
    marginBottom: 35,
  },

  input: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 12,
    padding: 14,
    fontSize: 16,
    marginBottom: 18,
  },

  button: {
    backgroundColor: '#2563EB',
    padding: 15,
    borderRadius: 12,
    marginTop: 10,
    alignItems: 'center',
  },

  buttonText: {
    color: '#FFFFFF',
    fontWeight: 'bold',
    fontSize: 17,
  },
});