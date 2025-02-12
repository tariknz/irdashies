import React from 'react';
import ReactDOM from 'react-dom';
import Weather/WindDirection from './Weather/WindDirection';

it('It should mount', () => {
  const div = document.createElement('div');
  ReactDOM.render(<Weather/WindDirection />, div);
  ReactDOM.unmountComponentAtNode(div);
});