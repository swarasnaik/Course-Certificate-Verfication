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

import { Button, Dialog, DialogActions, DialogContent, DialogTitle, Typography } from '@mui/material';
import React from 'react';
import {
  type CredentialVerificationFailureReason,
  type CourseCredentialVerificationResult,
} from '../../../api/src/index';

/**
 * The props required by the {@link VerifyResultDialog} component.
 *
 * @internal
 */
export interface VerifyResultDialogProps {
  /** The verification result to display. */
  result: CourseCredentialVerificationResult;
  /** `true` to render the dialog opened; otherwise closed. */
  isOpen: boolean;
  /** A callback that will be called if the user closes the dialog. */
  onClose: () => void;
}

/** @internal */
const VERIFICATION_FAILURE_MESSAGES: Record<CredentialVerificationFailureReason, string> = {
  'no-active-credential': 'There is no active credential for this contract.',
  'course-mismatch': 'The course does not match the course the credential was issued for.',
  'commitment-mismatch':
    'The student identifier and salt do not match the commitment stored on-chain. The credential cannot be verified.',
};

/**
 * A modal dialog that presents the outcome of verifying a course completion credential.
 *
 * @internal
 */
export const VerifyResultDialog: React.FC<Readonly<VerifyResultDialogProps>> = ({ result, isOpen, onClose }) => (
  <Dialog open={isOpen} onClose={onClose} fullWidth maxWidth="sm">
    <DialogTitle>
      <Typography variant="body1" color="black" data-testid="credential-verify-result-dialog-title">
        {result.valid ? 'Credential verified' : 'Credential verification failed'}
      </Typography>
    </DialogTitle>
    <DialogContent>
      {result.valid ? (
        <Typography variant="body2" color="textSecondary" data-testid="credential-verify-result-dialog-course">
          The student completed the course: {result.course}
        </Typography>
      ) : (
        <Typography variant="body2" color="textSecondary" data-testid="credential-verify-result-dialog-failure-reason">
          {VERIFICATION_FAILURE_MESSAGES[result.reason]}
        </Typography>
      )}
    </DialogContent>
    <DialogActions>
      <Button
        variant="contained"
        data-testid="credential-verify-result-dialog-close-btn"
        disableElevation
        onClick={onClose}
      >
        Close
      </Button>
    </DialogActions>
  </Dialog>
);
