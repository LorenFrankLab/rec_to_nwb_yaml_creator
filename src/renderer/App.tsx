import { MemoryRouter as Router, Routes, Route } from 'react-router-dom';
import './App.css';
import { ValidationForm } from './validationForm';

const ValidationPage = () => {
  return (
    <div>
      <h2 className="header-text">YAML Data</h2>
      <ValidationForm />
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
