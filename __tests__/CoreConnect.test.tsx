import React from 'react';
import ReactTestRenderer from 'react-test-renderer';
import CoreConnect from '../CoreConnect';

test('renders correctly', async () => {
  await ReactTestRenderer.act(() => {
    ReactTestRenderer.create(<CoreConnect />);
  });
});
