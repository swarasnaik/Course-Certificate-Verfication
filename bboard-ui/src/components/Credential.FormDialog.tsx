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

import { Button, Dialog, DialogActions, DialogContent, DialogTitle, TextField, Typography } from '@mui/material';
import React, { useState } from 'react';

/**
 * A single field to be rendered by the {@link CredentialFormDialog}.
 *
 * @internal
 */
export interface CredentialFormField {
  /** The key under which the field's value is submitted. */
  readonly key: string;
  /** The label shown above the field. */
  readonly label: string;
  /** An optional placeholder shown inside the field. */
  readonly placeholder?: string;
  /** `true` to render a multi-line text area. */
  readonly multiline?: boolean;
  /** The input type of the field. Defaults to `'text'`. */
  readonly type?: 'text' | 'password';
}

/**
 * The props required by the {@link CredentialFormDialog} component.
 *
 * @internal
 */
export interface CredentialFormDialogProps {
  /** The prompt to display to the user. */
  title: string;
  /** An optional description shown below the title. */
  description?: string;
  /** The fields to render. */
  fields: readonly CredentialFormField[];
  /** `true` to render the dialog opened; otherwise closed. */
  isOpen: boolean;
  /** A callback that will be called if the user cancels the dialog. */
  onCancel: () => void;
  /** A callback that will be called when the user submits their inputted data. */
  onSubmit: (values: Record<string, string>) => void;
}

/**
 * A modal dialog that prompts the user for a set of textual values, such as the course name,
 * student identifier and salt needed to issue or verify a credential.
 *
 * @internal
 */
export const CredentialFormDialog: React.FC<Readonly<CredentialFormDialogProps>> = ({
  title,
  description,
  fields,
  isOpen,
  onCancel,
  onSubmit,
}) => {
  const [values, setValues] = useState<Record<string, string>>({});

  const setValue = (key: string, value: string) => {
    setValues((current) => ({ ...current, [key]: value }));
  };

  const isReady = fields.every((field) => (values[field.key] ?? '').trim().length > 0);

  return (
    <Dialog
      open={isOpen}
      onClose={() => {
        setValues({});
        onCancel();
      }}
      fullWidth
      maxWidth="sm"
    >
      <DialogTitle>
        <Typography variant="body1" color="black" data-testid="credential-form-dialog-title">
          {title}
        </Typography>
        {description && (
          <Typography variant="body2" color="textSecondary" sx={{ mt: 1 }}>
            {description}
          </Typography>
        )}
      </DialogTitle>
      <DialogContent>
        {fields.map((field) => (
          <TextField
            key={field.key}
            id={field.key}
            label={field.label}
            variant="outlined"
            focused
            fullWidth
            multiline={field.multiline}
            minRows={field.multiline ? 2 : undefined}
            maxRows={field.multiline ? 2 : undefined}
            size="small"
            color="primary"
            autoComplete="off"
            margin="dense"
            type={field.type ?? 'text'}
            placeholder={field.placeholder}
            slotProps={{ htmlInput: { style: { color: 'black' } } }}
            onChange={(e) => {
              setValue(field.key, e.target.value);
            }}
            data-testid={`credential-form-dialog-${field.key}`}
          />
        ))}
      </DialogContent>

      <DialogActions>
        <Button
          variant="contained"
          data-testid="credential-form-dialog-cancel-btn"
          disableElevation
          onClick={() => {
            setValues({});
            onCancel();
          }}
        >
          Cancel
        </Button>
        <Button
          variant="contained"
          data-testid="credential-form-dialog-ok-btn"
          disabled={!isReady}
          disableElevation
          onClick={() => {
            onSubmit(values);
            setValues({});
          }}
          type="submit"
        >
          OK
        </Button>
      </DialogActions>
    </Dialog>
  );
};
