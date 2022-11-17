import React from 'react';
import Canvas from './components/Canvas';
import { BrowserRouter as Router, Route, Routes } from 'react-router-dom'

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Canvas />} />
      </Routes>
    </Router>
  );
}

export default App;
