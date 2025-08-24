import React from 'react';
import { createRoot } from 'react-dom/client';
import './styles/index.css';
import RootRouter from './router';

createRoot(document.getElementById('root')!).render(<RootRouter />);
