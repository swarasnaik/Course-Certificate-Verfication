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
import { type ContractAddress } from '@midnight-ntwrk/midnight-js-protocol/compact-runtime';
import { fromHex, toHex } from '@midnight-ntwrk/midnight-js-utils';
import {
  Backdrop,
  Card,
  CardActions,
  CardContent,
  CardHeader,
  CircularProgress,
  IconButton,
  Skeleton,
  Typography,
} from '@mui/material';
import VerifiedIcon from '@mui/icons-material/VerifiedOutlined';
import VacantIcon from '@mui/icons-material/WorkspacePremiumOutlined';
import IssueIcon from '@mui/icons-material/AssignmentIndOutlined';
import RevokeIcon from '@mui/icons-material/DeleteOutlined';
import VerifyIcon from '@mui/icons-material/FactCheckOutlined';
import CopyIcon from '@mui/icons-material/ContentPasteOutlined';
import StopIcon from '@mui/icons-material/HighlightOffOutlined';
import {
  type CourseCredentialDerivedState,
  type CourseCredentialVerificationResult,
  type DeployedCourseCredentialAPI,
} from '../../../api/src/index';
import { useDeployedCredentialContext } from '../hooks';
import { type CredentialDeployment } from '../contexts';
import { type Observable } from 'rxjs';
import { State } from '../../../contract/src/index';
import { EmptyCardContent } from './Credential.EmptyCardContent';
import { CredentialFormDialog, type CredentialFormField } from './Credential.FormDialog';
import { CredentialBundleDialog, type IssuedCredentialBundle } from './Credential.BundleDialog';
import { VerifyResultDialog } from './Credential.VerifyResultDialog';

/** The props required by the {@link Credential} component. */
export interface CredentialProps {
  /** The observable course completion credential deployment. */
  credentialDeployment$?: Observable<CredentialDeployment>;
}

/**
 * Provides the UI for a deployed course completion credential contract; allowing a credential to be
 * issued, revoked or verified following the rules enforced by the underlying Compact contract.
 *
 * @remarks
 * With no `credentialDeployment$` observable, the component will render a UI that allows the user to
 * create or join course completion credentials. It requires a `<DeployedCredentialProvider />` to be
 * in scope in order to manage these additional credentials. It does this by invoking the `resolve(...)`
 * method on the currently in-scope `DeployedCredentialContext`.
 *
 * When a `credentialDeployment$` observable is received, the component begins by rendering a skeletal
 * view of itself, along with a loading background. It does this until the credential deployment
 * receives a `DeployedCourseCredentialAPI` instance, upon which it will then subscribe to its `state$`
 * observable in order to start receiving the changes in the credential state (i.e., when a credential
 * is issued or revoked).
 */
export const Credential: React.FC<Readonly<CredentialProps>> = ({ credentialDeployment$ }) => {
  const credentialApiProvider = useDeployedCredentialContext();
  const [credentialDeployment, setCredentialDeployment] = useState<CredentialDeployment>();
  const [deployedCredentialAPI, setDeployedCredentialAPI] = useState<DeployedCourseCredentialAPI>();
  const [errorMessage, setErrorMessage] = useState<string>();
  const [credentialState, setCredentialState] = useState<CourseCredentialDerivedState>();
  const [issueFormOpen, setIssueFormOpen] = useState(false);
  const [verifyFormOpen, setVerifyFormOpen] = useState(false);
  const [issuedBundle, setIssuedBundle] = useState<IssuedCredentialBundle>();
  const [verifyResult, setVerifyResult] = useState<CourseCredentialVerificationResult>();
  const [isWorking, setIsWorking] = useState(!!credentialDeployment$);

  // Two simple callbacks that call `resolve(...)` to either deploy or join a course completion
  // credential contract. Since the `DeployedCredentialContext` will create a new credential and
  // update the UI, we don't have to do anything further once we've called `resolve`.
  const onCreateCredential = useCallback(() => credentialApiProvider.resolve(), [credentialApiProvider]);
  const onJoinCredential = useCallback(
    (contractAddress: ContractAddress) => credentialApiProvider.resolve(contractAddress),
    [credentialApiProvider],
  );

  // Callback to handle the issuing of a course completion credential. The course and student
  // identifier are captured in the issue form, and we forward them to the `issueCredential`
  // method of the `DeployedCourseCredentialAPI` instance.
  const onIssueCredential = useCallback(
    async (values: Record<string, string>) => {
      setIssueFormOpen(false);

      try {
        if (deployedCredentialAPI) {
          setIsWorking(true);
          console.log('DEBUG: issueCredential called');
          const { salt } = await deployedCredentialAPI.issueCredential(values.course, values.studentIdentifier);
          console.log('DEBUG: SALT GENERATED:', salt);
          setIssuedBundle({
            course: values.course,
            studentIdentifier: values.studentIdentifier,
            salt,
          });
        }
      } catch (error: unknown) {
        setErrorMessage(error instanceof Error ? error.message : String(error));
      } finally {
        setIsWorking(false);
      }
    },
    [deployedCredentialAPI, setErrorMessage, setIsWorking],
  );

  // Callback to handle the revoking of a course completion credential.
  const onRevokeCredential = useCallback(async () => {
    try {
      if (deployedCredentialAPI) {
        setIsWorking(true);
        await deployedCredentialAPI.revokeCredential();
      }
    } catch (error: unknown) {
      setErrorMessage(error instanceof Error ? error.message : String(error));
    } finally {
      setIsWorking(false);
    }
  }, [deployedCredentialAPI, setErrorMessage, setIsWorking]);

  // Callback to handle the verification of a course completion credential. The course, student
  // identifier and salt are captured in the verify form and forwarded to the `verifyCredential`
  // method of the `DeployedCourseCredentialAPI` instance.
  const onVerifyCredential = useCallback(
    async (values: Record<string, string>) => {
      setVerifyFormOpen(false);

      try {
        if (deployedCredentialAPI) {
          setIsWorking(true);
          console.log('DEBUG: verifyCredential called with course:', values.course);
          const result = await deployedCredentialAPI.verifyCredential(
            values.course,
            values.studentIdentifier,
            values.salt,
          );
          console.log('DEBUG: verifyCredential result:', result);
          setVerifyResult(result);
        }
      } catch (error: unknown) {
        console.error('DEBUG: verifyCredential error:', error);
        setErrorMessage(error instanceof Error ? error.message : String(error));
      } finally {
        setIsWorking(false);
      }
    },
    [deployedCredentialAPI, setErrorMessage, setIsWorking],
  );

  const onCopyContractAddress = useCallback(async () => {
    if (deployedCredentialAPI) {
      await navigator.clipboard.writeText(deployedCredentialAPI.deployedContractAddress);
    }
  }, [deployedCredentialAPI]);

  // Subscribes to the `credentialDeployment$` observable so that we can receive updates on the deployment.
  useEffect(() => {
    if (!credentialDeployment$) {
      return;
    }

    const subscription = credentialDeployment$.subscribe(setCredentialDeployment);

    return () => {
      subscription.unsubscribe();
    };
  }, [credentialDeployment$]);

  // Subscribes to the `state$` observable on a `DeployedCourseCredentialAPI` if we receive one,
  // allowing the component to receive updates to the change in contract state; otherwise we update
  // the UI to reflect the error was received instead.
  useEffect(() => {
    if (!credentialDeployment) {
      return;
    }
    if (credentialDeployment.status === 'in-progress') {
      return;
    }

    setIsWorking(false);

    if (credentialDeployment.status === 'failed') {
      setErrorMessage(
        credentialDeployment.error.message.length
          ? credentialDeployment.error.message
          : 'Encountered an unexpected error.',
      );
      return;
    }

    // We need the credential API as well as subscribing to its `state$` observable, so that we can
    // invoke the `issueCredential`, `revokeCredential` and `verifyCredential` methods later.
    setDeployedCredentialAPI(credentialDeployment.api);
    const subscription = credentialDeployment.api.state$.subscribe(setCredentialState);
    return () => {
      subscription.unsubscribe();
    };
  }, [credentialDeployment, setIsWorking, setErrorMessage, setDeployedCredentialAPI]);

  return (
    <Card sx={{ position: 'relative', width: 275, height: 300, minWidth: 275, minHeight: 300 }} color="primary">
      {!credentialDeployment$ && (
        <EmptyCardContent onCreateCredentialCallback={onCreateCredential} onJoinCredentialCallback={onJoinCredential} />
      )}

      {credentialDeployment$ && (
        <React.Fragment>
          <Backdrop
            sx={{ position: 'absolute', color: '#fff', zIndex: (theme) => theme.zIndex.drawer + 1 }}
            open={isWorking}
          >
            <CircularProgress data-testid="credential-working-indicator" />
          </Backdrop>
          <Backdrop
            sx={{ position: 'absolute', color: '#ff0000', zIndex: (theme) => theme.zIndex.drawer + 1 }}
            open={!!errorMessage}
          >
            <StopIcon fontSize="large" />
            <Typography component="div" data-testid="credential-error-message">
              {errorMessage}
            </Typography>
          </Backdrop>
          <CardHeader
            avatar={
              credentialState ? (
                credentialState.state === State.ISSUED ? (
                  <VerifiedIcon data-testid="credential-issued-icon" />
                ) : (
                  <VacantIcon data-testid="credential-vacant-icon" />
                )
              ) : (
                <Skeleton variant="circular" width={20} height={20} />
              )
            }
            titleTypographyProps={{ color: 'primary' }}
            title={toShortFormatContractAddress(deployedCredentialAPI?.deployedContractAddress) ?? 'Loading...'}
            action={
              deployedCredentialAPI?.deployedContractAddress ? (
                <IconButton title="Copy contract address" onClick={onCopyContractAddress}>
                  <CopyIcon fontSize="small" />
                </IconButton>
              ) : (
                <Skeleton variant="circular" width={20} height={20} />
              )
            }
          />
          <CardContent>
            {credentialState ? (
              credentialState.state === State.ISSUED ? (
                <React.Fragment>
                  <Typography data-testid="credential-course" sx={{ minHeight: 32 }} color="primary">
                    {credentialState.course}
                  </Typography>
                  <Typography
                    data-testid="credential-student-commitment"
                    variant="body2"
                    color="primary"
                    sx={{ mb: 1 }}
                  >
                    Student commitment: 0x
                    {credentialState.studentCommitment
                      ? toHex(credentialState.studentCommitment).replace(/^0x/, '').slice(0, 16)
                      : '...'}
                    ...
                  </Typography>
                  <Typography data-testid="credential-issuer" variant="body2" color="primary">
                    {credentialState.isIssuer ? 'Issued by you' : 'Issued by another party'}
                  </Typography>
                </React.Fragment>
              ) : (
                <Typography data-testid="credential-vacant-message" sx={{ minHeight: 160 }} color="primary">
                  No credential has been issued for this contract yet.
                </Typography>
              )
            ) : (
              <Skeleton variant="rectangular" width={245} height={160} />
            )}
          </CardContent>
          <CardActions>
            {deployedCredentialAPI ? (
              <React.Fragment>
                <IconButton
                  title="Issue credential"
                  data-testid="credential-issue-btn"
                  disabled={credentialState?.state === State.ISSUED}
                  onClick={() => {
                    setIssueFormOpen(true);
                  }}
                >
                  <IssueIcon />
                </IconButton>
                <IconButton
                  title="Revoke credential"
                  data-testid="credential-revoke-btn"
                  disabled={
                    credentialState?.state === State.VACANT ||
                    (credentialState?.state === State.ISSUED && !credentialState.isIssuer)
                  }
                  onClick={onRevokeCredential}
                >
                  <RevokeIcon />
                </IconButton>
                <IconButton
                  title="Verify credential"
                  data-testid="credential-verify-btn"
                  onClick={() => {
                    setVerifyFormOpen(true);
                  }}
                >
                  <VerifyIcon />
                </IconButton>
              </React.Fragment>
            ) : (
              <Skeleton variant="rectangular" width={80} height={20} />
            )}
          </CardActions>
        </React.Fragment>
      )}

      <CredentialFormDialog
        title="Issue a course completion credential"
        description="Enter the course the student completed, and the student's private identifier."
        fields={ISSUE_FIELDS}
        isOpen={issueFormOpen}
        onCancel={() => {
          setIssueFormOpen(false);
        }}
        onSubmit={onIssueCredential}
      />
      <CredentialFormDialog
        title="Verify a course completion credential"
        description="Enter the course, and the student identifier and salt revealed by the student."
        fields={VERIFY_FIELDS}
        isOpen={verifyFormOpen}
        onCancel={() => {
          setVerifyFormOpen(false);
        }}
        onSubmit={onVerifyCredential}
      />
      {issuedBundle && (
        <CredentialBundleDialog
          bundle={issuedBundle}
          isOpen={!!issuedBundle}
          onClose={() => {
            setIssuedBundle(undefined);
          }}
        />
      )}
      {verifyResult && (
        <VerifyResultDialog
          result={verifyResult}
          isOpen={!!verifyResult}
          onClose={() => {
            setVerifyResult(undefined);
          }}
        />
      )}
    </Card>
  );
};

/** @internal */
const ISSUE_FIELDS: readonly CredentialFormField[] = [
  {
    key: 'course',
    label: 'Course',
    placeholder: 'Course the student completed',
  },
  {
    key: 'studentIdentifier',
    label: 'Student identifier',
    placeholder: 'Name, email or ID of the student',
  },
];

/** @internal */
const VERIFY_FIELDS: readonly CredentialFormField[] = [
  {
    key: 'course',
    label: 'Course',
    placeholder: 'Course the student claims to have completed',
  },
  {
    key: 'studentIdentifier',
    label: 'Student identifier',
    placeholder: 'Identifier revealed by the student',
  },
  {
    key: 'salt',
    label: 'Salt',
    placeholder: 'Salt revealed by the student (64 hexadecimal characters)',
  },
];

/** @internal */
const toShortFormatContractAddress = (contractAddress: ContractAddress | undefined): React.ReactElement | undefined =>
  // Returns a new string made up of the first, and last, 8 characters of a given contract address.
  contractAddress ? (
    <span data-testid="credential-address">
      0x{contractAddress?.replace(/^[A-Fa-f0-9]{6}([A-Fa-f0-9]{8}).*([A-Fa-f0-9]{8})$/g, '$1...$2')}
    </span>
  ) : undefined;
