import React from 'react';
import HomeScreen from './components/HomeScreen';
import BoundingScreen from './components/BoundingScreen';
import SegmentationScreen from './components/SegmentationScreen';
import { BrowserRouter as Router, Route, Routes } from 'react-router-dom'
import AnnotationChoiceScreen from './components/AnnotationChoiceScreen';

function App() {
  return (
    <Router>
      <Routes>
        <Route exact path="/" element={<HomeScreen />} />
        <Route exact path="/bounding" element={<BoundingScreen />} />
        <Route exact path="/segmentation/:ids" element={<SegmentationScreen />} />
        <Route exact path="/annotationChoice" element={<AnnotationChoiceScreen />} />
      </Routes>
    </Router>
  );
}

export default App;
