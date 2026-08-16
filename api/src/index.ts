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

/**
 * Provides types and utilities for working with course completion credential contracts.
 *
 * @packageDocumentation
 */

import * as CourseCredential from '../../contract/src/managed/course-credential/contract/index.js';

import { type ContractAddress, convertFieldToBytes } from '@midnight-ntwrk/midnight-js-protocol/compact-runtime';
import { type Logger } from 'pino';
import {
  type CourseCredentialDerivedState,
  type CourseCredentialContract,
  type CourseCredentialProviders,
  type DeployedCourseCredentialContract,
  courseCredentialPrivateStateKey,
} from './common-types.js';
import { CompiledCourseCredentialContractContract } from '../../contract/src/index';
import * as utils from './utils/index.js';
import { deployContract, findDeployedContract } from '@midnight-ntwrk/midnight-js-contracts';
import { combineLatest, map, tap, from, type Observable } from 'rxjs';
import { toHex } from '@midnight-ntwrk/midnight-js-utils';
import { CourseCredentialPrivateState, createCourseCredentialPrivateState } from '../../contract/src/witnesses.js';

/** @internal */

/**
 * The result of verifying a course completion credential.
 *
 * @remarks
 * The `'valid'` variant reports the course that was successfully verified, while the
 * `'invalid'` variants describe the reason the credential could not be verified so
 * that a verifier can give helpful feedback. Note that none of these variants ever
 * disclose the student identifier itself; it remains only in the verifier's local
 * memory after being revealed by the student.
 */
export type CourseCredentialVerificationResult =
  | { readonly valid: true; readonly course: string }
  | { readonly valid: false; readonly reason: CredentialVerificationFailureReason };

/**
 * The reasons a course completion credential can fail verification.
 */
export type CredentialVerificationFailureReason = 'no-active-credential' | 'course-mismatch' | 'commitment-mismatch';

/**
 * An API for a deployed course completion credential.
 */
export interface DeployedCourseCredentialAPI {
  readonly deployedContractAddress: ContractAddress;
  readonly state$: Observable<CourseCredentialDerivedState>;

  issueCredential: (course: string, studentIdentifier: string) => Promise<{ salt: Uint8Array }>;
  revokeCredential: () => Promise<void>;
  verifyCredential: (
    course: string,
    studentIdentifier: string,
    salt: Uint8Array | string,
  ) => Promise<CourseCredentialVerificationResult>;
}

/**
 * Provides an implementation of {@link DeployedCourseCredentialAPI} by adapting a deployed course
 * completion credential contract.
 *
 * @remarks
 * The `CourseCredentialPrivateState` is managed at the DApp level by a private state provider. As such,
 * this private state is shared between all instances of {@link CourseCredentialAPI}, and their underlying
 * deployed contracts. The private state defines a `'secretKey'` property that effectively identifies the
 * current user, and is used to determine if the current user is the issuer of the credential as the
 * observable contract state changes.
 *
 * In the future, Midnight.js will provide a private state provider that supports private state storage
 * keyed by contract address. This will remove the current workaround of sharing private state across
 * the deployed course credential contracts, and allows for a unique secret key to be generated for each
 * course credential that the user interacts with.
 */
// TODO: Update CourseCredentialAPI to use contract level private state storage.
export class CourseCredentialAPI implements DeployedCourseCredentialAPI {
  /** @internal */
  private constructor(
    public readonly deployedContract: DeployedCourseCredentialContract,
    providers: CourseCredentialProviders,
    private readonly logger?: Logger,
  ) {
    this.deployedContractAddress = deployedContract.deployTxData.public.contractAddress;
    this.providers = providers;
    providers.privateStateProvider.setContractAddress(this.deployedContractAddress);
    this.state$ = combineLatest(
      [
        // Combine public (ledger) state with...
        providers.publicDataProvider.contractStateObservable(this.deployedContractAddress, { type: 'latest' }).pipe(
          map((contractState) => CourseCredential.ledger(contractState.data)),
          tap((ledgerState) =>
            logger?.trace({
              ledgerStateChanged: {
                ledgerState: {
                  ...ledgerState,
                  state: ledgerState.state === CourseCredential.State.ISSUED ? 'issued' : 'vacant',
                  issuer: toHex(ledgerState.issuer),
                  studentCommitment: ledgerState.studentCommitment.is_some
                    ? toHex(ledgerState.studentCommitment.value)
                    : 'none',
                },
              },
            }),
          ),
        ),
        // ...private state...
        //    since the private state of the course credential application never changes, we can query the
        //    private state once and always use the same value with `combineLatest`. In applications
        //    where the private state is expected to change, we would need to make this an `Observable`.
        from(
          providers.privateStateProvider.get(courseCredentialPrivateStateKey) as Promise<CourseCredentialPrivateState>,
        ),
      ],
      // ...and combine them to produce the required derived state.
      (ledgerState, privateState) => {
        const hashedSecretKey = CourseCredential.pureCircuits.publicKey(
          privateState.secretKey,
          convertFieldToBytes(32, ledgerState.sequence, 'api/src/index.ts'),
        );

        return {
          state: ledgerState.state,
          course: ledgerState.course.is_some ? ledgerState.course.value : undefined,
          studentCommitment: ledgerState.studentCommitment.is_some ? ledgerState.studentCommitment.value : undefined,
          sequence: ledgerState.sequence,
          isIssuer: toHex(ledgerState.issuer) === toHex(hashedSecretKey),
        };
      },
    );
  }

  private readonly providers: CourseCredentialProviders;

  /**
   * Gets the address of the current deployed contract.
   */
  readonly deployedContractAddress: ContractAddress;

  /**
   * Gets an observable stream of state changes based on the current public (ledger),
   * and private state data.
   */
  readonly state$: Observable<CourseCredentialDerivedState>;

  /**
   * Attempts to issue a course completion credential.
   *
   * @param course The name of the course that was completed.
   * @param studentIdentifier A private identifier of the student (e.g. a name, email or ID).
   *
   * @returns A `Promise` that resolves with a randomly generated `salt` that, together with
   * `studentIdentifier`, must be handed to the student so they can later prove the credential
   * to a verifier.
   *
   * @remarks
   * The `studentIdentifier` is never written to the ledger. It is hashed (SHA-256) and then
   * committed on-chain together with a randomly generated `salt` that this method returns.
   * This method can fail during local circuit execution if a credential is currently active.
   */
  async issueCredential(course: string, studentIdentifier: string): Promise<{ salt: Uint8Array }> {
    const normalizedCourse = course.trim();
    const normalizedStudentId = studentIdentifier.trim();
    const salt = utils.randomBytes(32);
    const studentIdBytes = await utils.hashToBytes32(normalizedStudentId);

    console.log('DEBUG: issueCredential start for course:', normalizedCourse);
    console.log('DEBUG: student identifier hashed to 32 bytes (masked):', toHex(studentIdBytes).slice(0, 10) + '...');
    console.log('DEBUG: salt generated (32 bytes hex):', toHex(salt));
    this.logger?.info(`issuingCredentialForCourse: ${normalizedCourse}`);

    const txData = await this.deployedContract.callTx.issueCredential(normalizedCourse, studentIdBytes, salt);

    console.log('DEBUG: issueCredential tx submitted:', txData.public.txHash);
    this.logger?.trace({
      transactionAdded: {
        circuit: 'issueCredential',
        txHash: txData.public.txHash,
        blockHeight: txData.public.blockHeight,
      },
    });

    return { salt };
  }

  /**
   * Attempts to revoke any currently issued course completion credential.
   *
   * @remarks
   * This method can fail during local circuit execution if no credential is currently active,
   * or if the currently issued credential wasn't issued by the issuer computed from the current
   * private state.
   */
  async revokeCredential(): Promise<void> {
    this.logger?.info('revokingCredential');

    const txData = await this.deployedContract.callTx.revokeCredential();

    this.logger?.trace({
      transactionAdded: {
        circuit: 'revokeCredential',
        txHash: txData.public.txHash,
        blockHeight: txData.public.blockHeight,
      },
    });
  }

  /**
   * Attempts to verify that a student completed a given course.
   *
   * @param course The name of the course the student claims to have completed.
   * @param studentIdentifier The private identifier revealed by the student.
   * @param salt The salt that the issuer generated (and handed to the student) when the
   * credential was issued, passed as a `Uint8Array` or hex string.
   *
   * @returns A `Promise` that resolves with a {@link CourseCredentialVerificationResult}.
   *
   * @remarks
   * Verification is performed locally against the on-chain commitment; no transaction is
   * submitted and nothing is written to the ledger. The commitment stored on-chain is
   * recomputed from `studentIdentifier` and `salt` using the contract's own `commit` pure
   * circuit, and compared with the on-chain value. The identifier therefore never needs to
   * be stored on the ledger to be verified.
   */
  async verifyCredential(
    course: string,
    studentIdentifier: string,
    salt: Uint8Array | string,
  ): Promise<CourseCredentialVerificationResult> {
    const normalizedCourse = course.trim();
    const normalizedStudentId = studentIdentifier.trim();

    let saltBytes: Uint8Array;
    if (typeof salt === 'string') {
      saltBytes = utils.hexToBytes32(salt);
    } else if (salt instanceof Uint8Array && salt.length === 32) {
      saltBytes = salt;
    } else {
      saltBytes = utils.hexToBytes32(toHex(salt));
    }

    console.log('DEBUG: verifyCredential start for course:', normalizedCourse);
    this.logger?.info(`verifyingCredentialForCourse: ${normalizedCourse}`);

    const contractState = await this.providers.publicDataProvider.queryContractState(this.deployedContractAddress);
    if (contractState === null) {
      console.log('DEBUG: verifyCredential failed - contract state is null');
      return { valid: false, reason: 'no-active-credential' };
    }

    const ledgerState = CourseCredential.ledger(contractState.data);
    if (ledgerState.state !== CourseCredential.State.ISSUED) {
      console.log('DEBUG: verifyCredential failed - ledger state is not ISSUED');
      return { valid: false, reason: 'no-active-credential' };
    }
    if (ledgerState.course.value.trim() !== normalizedCourse) {
      console.log(
        `DEBUG: verifyCredential failed - course mismatch. On-chain: '${ledgerState.course.value}', Claimed: '${normalizedCourse}'`,
      );
      return { valid: false, reason: 'course-mismatch' };
    }

    const studentId = await utils.hashToBytes32(normalizedStudentId);
    const computedCommitment = CourseCredential.pureCircuits.commit(studentId, saltBytes);
    if (toHex(computedCommitment) !== toHex(ledgerState.studentCommitment.value)) {
      console.log('DEBUG: verifyCredential failed - commitment mismatch');
      return { valid: false, reason: 'commitment-mismatch' };
    }

    console.log('DEBUG: verifyCredential succeeded for course:', ledgerState.course.value);
    return { valid: true, course: ledgerState.course.value };
  }

  /**
   * Deploys a new course completion credential contract to the network.
   *
   * @param providers The course credential providers.
   * @param logger An optional 'pino' logger to use for logging.
   * @returns A `Promise` that resolves with a {@link CourseCredentialAPI} instance that manages the newly
   * deployed {@link DeployedCourseCredentialContract}; or rejects with a deployment error.
   */
  static async deploy(providers: CourseCredentialProviders, logger?: Logger): Promise<CourseCredentialAPI> {
    logger?.info('deployContract');

    const deployedCourseCredentialContract = await deployContract(providers, {
      compiledContract: CompiledCourseCredentialContractContract,
      privateStateId: courseCredentialPrivateStateKey,
      initialPrivateState: createCourseCredentialPrivateState(utils.randomBytes(32)),
    });

    logger?.trace({
      contractDeployed: {
        finalizedDeployTxData: deployedCourseCredentialContract.deployTxData.public,
      },
    });

    return new CourseCredentialAPI(deployedCourseCredentialContract, providers, logger);
  }

  /**
   * Finds an already deployed course completion credential contract on the network, and joins it.
   *
   * @param providers The course credential providers.
   * @param contractAddress The contract address of the deployed course credential contract to search
   * for and join.
   * @param logger An optional 'pino' logger to use for logging.
   * @returns A `Promise` that resolves with a {@link CourseCredentialAPI} instance that manages the
   * joined {@link DeployedCourseCredentialContract}; or rejects with an error.
   */
  static async join(
    providers: CourseCredentialProviders,
    contractAddress: ContractAddress,
    logger?: Logger,
  ): Promise<CourseCredentialAPI> {
    logger?.info({
      joinContract: {
        contractAddress,
      },
    });

    const deployedCourseCredentialContract = await findDeployedContract<CourseCredentialContract>(providers, {
      contractAddress,
      compiledContract: CompiledCourseCredentialContractContract,
      privateStateId: courseCredentialPrivateStateKey,
      initialPrivateState: await CourseCredentialAPI.getPrivateState(providers, contractAddress),
    });

    logger?.trace({
      contractJoined: {
        finalizedDeployTxData: deployedCourseCredentialContract.deployTxData.public,
      },
    });

    return new CourseCredentialAPI(deployedCourseCredentialContract, providers, logger);
  }

  private static async getPrivateState(
    providers: CourseCredentialProviders,
    contractAddress: ContractAddress,
  ): Promise<CourseCredentialPrivateState> {
    providers.privateStateProvider.setContractAddress(contractAddress);
    const existingPrivateState = await providers.privateStateProvider.get(courseCredentialPrivateStateKey);
    return existingPrivateState ?? createCourseCredentialPrivateState(utils.randomBytes(32));
  }
}

/**
 * A namespace that represents the exports from the `'utils'` sub-package.
 *
 * @public
 */
export * as utils from './utils/index.js';

export * from './common-types.js';
