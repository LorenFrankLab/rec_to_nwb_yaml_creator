import { MemoryRouter as Router, Routes, Route } from 'react-router-dom';
import icon from '../../assets/icon.svg';
import './App.css';
import { ValidationForm } from './validationForm';

const ValidationPage = () => {
  return (
    <div>
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
