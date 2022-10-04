import { MemoryRouter as Router, Routes, Route } from 'react-router-dom';
import './App.css';
import { YMLGenerator } from './ymlGenerator';

const ValidationPage = () => {
  return (
    <div>
      <YMLGenerator />
    </div>
  );
};

export default function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<ValidationPage />} />
      </Routes>
    </Router>
  );
}
