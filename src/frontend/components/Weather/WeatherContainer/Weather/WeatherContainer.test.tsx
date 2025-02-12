import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import Weather/WeatherContainer from './Weather/WeatherContainer';

describe('<Weather/WeatherContainer />', () => {
  test('it should mount', () => {
    render(<Weather/WeatherContainer />);

    const weatherWeatherContainer = screen.getByTestId('Weather/WeatherContainer');

    expect(weatherWeatherContainer).toBeInTheDocument();
  });
});