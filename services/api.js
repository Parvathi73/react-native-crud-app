// services/api.js

export const API_URL =
  'https://6a61df59da10c59c1809f388.mockapi.io/api/v1/users';

// GET ALL USERS
export const fetchUsers = async () => {
  const response = await fetch(API_URL);

  if (!response.ok) {
    throw new Error('Failed to fetch users');
  }

  return await response.json();
};

// CREATE USER
export const createUser = async (userData) => {
  const response = await fetch(API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(userData),
  });

  const result = await response.text();

  console.log('Status:', response.status);
  console.log('Response:', result);

  if (!response.ok) {
    throw new Error(result);
  }

  return JSON.parse(result);
};

// UPDATE USER
export const updateUser = async (id, userData) => {
  const response = await fetch(`${API_URL}/${id}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(userData),
  });

  const result = await response.text();

  console.log('Update Status:', response.status);
  console.log('Update Response:', result);

  if (!response.ok) {
    throw new Error(result);
  }

  return JSON.parse(result);
};

// DELETE USER
export const deleteUser = async (id) => {
  const response = await fetch(`${API_URL}/${id}`, {
    method: 'DELETE',
  });

  if (!response.ok) {
    throw new Error('Failed to delete employee');
  }

  return await response.json();
};
