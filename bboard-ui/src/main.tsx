import './globals';

import React from 'react';
import ReactDOM from 'react-dom/client';
import { ThemeProvider } from '@mui/material';
import CssBaseline from '@mui/material/CssBaseline';
import * as pino from 'pino';
import { setNetworkId } from '@midnight-ntwrk/midnight-js-network-id';

import App from './App';
import { theme } from './config/theme';
import { DeployedCredentialProvider } from './contexts';

const networkId = 'preview';
console.log('FORCED NETWORK:', networkId);

if (!networkId) {
  throw new Error('VITE_NETWORK_ID is not configured');
}

setNetworkId(networkId);

const logger = pino.pino({
  level: (import.meta.env.VITE_LOGGING_LEVEL as string | undefined) || 'info',
});

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <DeployedCredentialProvider logger={logger}>
        <App />
      </DeployedCredentialProvider>
    </ThemeProvider>
  </React.StrictMode>,
);
