import React, { useState } from 'react';
import { type ContractAddress } from '@midnight-ntwrk/midnight-js-protocol/compact-runtime';
import {
  Box,
  Button,
  CardContent,
  Typography,
} from '@mui/material';
import CreateCredentialIcon from '@mui/icons-material/AddCircleOutlined';
import JoinCredentialIcon from '@mui/icons-material/AddLinkOutlined';
import { TextPromptDialog } from './TextPromptDialog';

export interface EmptyCardContentProps {
  onCreateCredentialCallback: () => void;
  onJoinCredentialCallback: (contractAddress: ContractAddress) => void;
}

export const EmptyCardContent: React.FC<
  Readonly<EmptyCardContentProps>
> = ({
  onCreateCredentialCallback,
  onJoinCredentialCallback,
}) => {
  const [textPromptOpen, setTextPromptOpen] = useState(false);

  return (
    <>
      <CardContent
        sx={{
          minHeight: 220,
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'center',
          textAlign: 'center',
          background:
            'linear-gradient(145deg, #0f172a 0%, #172554 100%)',
          color: 'white',
          borderRadius: 2,
          p: 3,
        }}
      >
        <Box
          sx={{
            width: 64,
            height: 64,
            borderRadius: '50%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'rgba(59, 130, 246, 0.15)',
            mb: 2,
          }}
        >
          <CreateCredentialIcon
            sx={{ fontSize: 38, color: '#60a5fa' }}
          />
        </Box>

        <Typography
          variant="h6"
          sx={{ fontWeight: 700, mb: 1 }}
        >
          Course Credential
        </Typography>

        <Typography
          variant="body2"
          sx={{
            color: '#94a3b8',
            maxWidth: 230,
            mb: 3,
          }}
        >
          Create a new credential or connect to an existing
          course credential.
        </Typography>

        <Box
          sx={{
            display: 'flex',
            flexDirection: 'column',
            gap: 1.5,
            width: '100%',
          }}
        >
          <Button
            fullWidth
            variant="contained"
            startIcon={<CreateCredentialIcon />}
            onClick={onCreateCredentialCallback}
            sx={{
              py: 1.2,
              fontWeight: 700,
              borderRadius: 2,
            }}
          >
            Create Credential
          </Button>

          <Button
            fullWidth
            variant="outlined"
            startIcon={<JoinCredentialIcon />}
            onClick={() => setTextPromptOpen(true)}
            sx={{
              py: 1.2,
              fontWeight: 700,
              color: '#bfdbfe',
              borderColor: '#475569',
              borderRadius: 2,
            }}
          >
            Join Existing
          </Button>
        </Box>
      </CardContent>

      <TextPromptDialog
        prompt="Enter contract address"
        isOpen={textPromptOpen}
        onCancel={() => {
          setTextPromptOpen(false);
        }}
        onSubmit={(text) => {
          setTextPromptOpen(false);
          onJoinCredentialCallback(text);
        }}
      />
    </>
  );
};
