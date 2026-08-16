// This file is part of midnightntwrk/example-bboard.
// Copyright (C) Midnight Foundation
// SPDX-License-Identifier: Apache-2.0
// Licensed under the Apache License, Version 2.0 (the "License");
// You may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
// http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

import React, { useCallback, useEffect, useState } from 'react';
import { Alert, Box, Button, Card, CardContent, CircularProgress, Stack, Typography } from '@mui/material';
import WalletIcon from '@mui/icons-material/AccountBalanceWalletOutlined';
import VerifiedIcon from '@mui/icons-material/VerifiedOutlined';
import ContentCopyIcon from '@mui/icons-material/ContentCopyOutlined';
import * as pino from 'pino';
import {
  connectWallet,
  disconnectWallet,
  type WalletConnectionState,
  walletConnection$,
} from '../contexts/BrowserDeployedCredentialManager';

const logger = pino.pino({ level: 'info' });

/**
 * Renders the Midnight wallet connection UI; allowing the user to connect to their Midnight wallet,
 * display the connected wallet address, copy it, or disconnect.
 */
export const Wallet: React.FC = () => {
  const [walletState, setWalletState] = useState<WalletConnectionState>({ status: 'disconnected' });
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const subscription = walletConnection$.subscribe(setWalletState);

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const onConnect = useCallback(async () => {
    setCopied(false);
    try {
      await connectWallet(logger);
    } catch {
      // The wallet connection state has already been updated to reflect the error; nothing to do.
    }
  }, []);

  const onCopyAddress = useCallback(async () => {
    if (walletState.address) {
      await navigator.clipboard.writeText(walletState.address);
      setCopied(true);
      setTimeout(() => {
        setCopied(false);
      }, 2000);
    }
  }, [walletState.address]);

  const onDisconnect = useCallback(() => {
    setCopied(false);
    disconnectWallet();
  }, []);

  return (
    <Card
      sx={{
        position: 'relative',
        width: 420,
        minWidth: 420,
        backgroundColor: '#151a22',
        color: '#ffffff',
        border: '1px solid #2a3342',
      }}
      data-testid="wallet-connection"
    >
      <CardContent>
        <Stack spacing={2}>
          <Stack direction="row" sx={{ alignItems: 'center' }} spacing={1}>
            <WalletIcon color="primary" />
            <Typography variant="h6" sx={{ color: '#ffffff' }}>
              Midnight Wallet
            </Typography>
          </Stack>

          {walletState.status === 'connecting' && (
            <Stack direction="row" sx={{ alignItems: 'center' }} spacing={1}>
              <CircularProgress size={20} />
              <Typography variant="body2" sx={{ color: '#a8a8a8' }}>
                Waiting for authorization in your Midnight wallet...
              </Typography>
            </Stack>
          )}

          {walletState.status === 'connected' && walletState.address && (
            <React.Fragment>
              <Stack direction="row" sx={{ alignItems: 'center' }} spacing={1}>
                <VerifiedIcon sx={{ color: '#4caf50' }} />
                <Typography variant="body1" sx={{ color: '#4caf50', fontWeight: 700 }}>
                  Wallet Connected
                </Typography>
              </Stack>
              <Box>
                <Typography variant="body2" sx={{ color: '#a8a8a8' }}>
                  Address:
                </Typography>
                <Typography
                  variant="body2"
                  sx={{ color: '#ffffff', wordBreak: 'break-all' }}
                  data-testid="wallet-address"
                >
                  {walletState.address}
                </Typography>
              </Box>
              <Stack direction="row" spacing={1}>
                <Button
                  size="small"
                  variant="outlined"
                  startIcon={<ContentCopyIcon />}
                  onClick={onCopyAddress}
                  data-testid="wallet-copy-address"
                >
                  {copied ? 'Copied' : 'Copy Address'}
                </Button>
                <Button size="small" variant="outlined" onClick={onDisconnect} data-testid="wallet-disconnect">
                  Disconnect
                </Button>
              </Stack>
            </React.Fragment>
          )}

          {walletState.status === 'error' && (
            <React.Fragment>
              <Alert severity="error" sx={{ color: '#ffffff', backgroundColor: 'rgba(211, 47, 47, 0.15)' }}>
                {walletState.errorMessage ?? 'Unable to connect to the Midnight wallet.'}
              </Alert>
              <Typography variant="body2" sx={{ color: '#a8a8a8' }}>
                Authorization Required: please approve this application in your Midnight wallet and try again.
              </Typography>
            </React.Fragment>
          )}

          {(walletState.status === 'disconnected' || walletState.status === 'error') && (
            <Button
              variant="contained"
              color="primary"
              onClick={onConnect}

              data-testid="wallet-connect"
            >
              {'Connect Wallet'}
            </Button>
          )}
        </Stack>
      </CardContent>
    </Card>
  );
};
