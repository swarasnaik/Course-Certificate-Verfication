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
import { toHex } from '@midnight-ntwrk/midnight-js-utils';

/**
 * The details of a newly issued credential that the issuer must hand to the student.
 *
 * @internal
 */
export interface IssuedCredentialBundle {
  /** The course the student completed. */
  readonly course: string;
  /** The private identifier of the student the credential was issued for. */
  readonly studentIdentifier: string;
  /** The salt that, together with the student identifier, the student reveals to a verifier. */
  readonly salt: Uint8Array;
}

/**
 * The props required by the {@link CredentialBundleDialog} component.
 *
 * @internal
 */
export interface CredentialBundleDialogProps {
  /** The issued credential bundle to display. */
  bundle: IssuedCredentialBundle;
  /** `true` to render the dialog opened; otherwise closed. */
  isOpen: boolean;
  /** A callback that will be called if the user closes the dialog. */
  onClose: () => void;
}

/**
 * A modal dialog that presents the details of a newly issued course completion credential so that
 * the issuer can share them (in private) with the student.
 *
 * @internal
 */
export const CredentialBundleDialog: React.FC<Readonly<CredentialBundleDialogProps>> = ({
  bundle,
  isOpen,
  onClose,
}) => (
  <Dialog open={isOpen} onClose={onClose} fullWidth maxWidth="sm">
    <DialogTitle>
      <Typography variant="body1" color="black" data-testid="credential-bundle-dialog-title">
        Credential issued successfully
      </Typography>
    </DialogTitle>
    <DialogContent>
      <Typography variant="body2" color="textSecondary" data-testid="credential-bundle-course">
        Course: {bundle.course}
      </Typography>
      <Typography variant="body2" color="textSecondary" data-testid="credential-bundle-student-identifier">
        Student identifier: {bundle.studentIdentifier}
      </Typography>
      <Typography variant="body2" color="textSecondary" data-testid="credential-bundle-salt">
        Salt: 0x{toHex(bundle.salt).replace(/^0x/, '')}
      </Typography>
      <Typography variant="body2" color="textSecondary" sx={{ mt: 2 }}>
        Share the student identifier and salt with the student, in private. They will need both to prove the credential
        to a verifier.
      </Typography>
    </DialogContent>
    <DialogActions>
      <Button variant="contained" data-testid="credential-bundle-dialog-close-btn" disableElevation onClick={onClose}>
        Close
      </Button>
    </DialogActions>
  </Dialog>
);
