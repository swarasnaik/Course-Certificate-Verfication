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
 * Course completion credential common types and abstractions.
 *
 * @module
 */

import { type MidnightProviders } from '@midnight-ntwrk/midnight-js-types';
import { type FoundContract } from '@midnight-ntwrk/midnight-js-contracts';
import type { State, CourseCredentialPrivateState, Contract, Witnesses } from '../../contract/src/index';

export const courseCredentialPrivateStateKey = 'courseCredentialPrivateState';
export type PrivateStateId = typeof courseCredentialPrivateStateKey;

/**
 * The private states consumed throughout the application.
 *
 * @remarks
 * {@link PrivateStates} can be thought of as a type that describes a schema for all
 * private states for all contracts used in the application. Each key represents
 * the type of private state consumed by a particular type of contract.
 * The key is used by the deployed contract when interacting with a private state provider,
 * and the type (i.e., `typeof PrivateStates[K]`) represents the type of private state
 * expected to be returned.
 *
 * Since there is only one contract type for the course credential example, we only define a
 * single key/type in the schema.
 *
 * @public
 */
export type PrivateStates = {
  /**
   * Key used to provide the private state for {@link CourseCredentialContract} deployments.
   */
  readonly courseCredentialPrivateState: CourseCredentialPrivateState;
};

/**
 * Represents a course credential contract and its private state.
 *
 * @public
 */
export type CourseCredentialContract = Contract<CourseCredentialPrivateState, Witnesses<CourseCredentialPrivateState>>;

/**
 * The keys of the circuits exported from {@link CourseCredentialContract}.
 *
 * @public
 */
export type CourseCredentialCircuitKeys = Exclude<keyof CourseCredentialContract['impureCircuits'], number | symbol>;

/**
 * The providers required by {@link CourseCredentialContract}.
 *
 * @public
 */
export type CourseCredentialProviders = MidnightProviders<
  CourseCredentialCircuitKeys,
  PrivateStateId,
  CourseCredentialPrivateState
>;

/**
 * A {@link CourseCredentialContract} that has been deployed to the network.
 *
 * @public
 */
export type DeployedCourseCredentialContract = FoundContract<CourseCredentialContract>;

/**
 * A type that represents the derived combination of public (or ledger), and private state.
 */
export type CourseCredentialDerivedState = {
  readonly state: State;
  readonly sequence: bigint;
  readonly course: string | undefined;

  /**
   * The on-chain commitment to the student's identity. The student's identifier
   * itself is never stored on the ledger; only this hiding commitment is.
   *
   * @remarks
   * The commitment is `persistentCommit(sha256(studentIdentifier), salt)`. A verifier
   * can confirm a credential by recomputing this commitment from the identifier and
   * salt that the student reveals directly to them, and comparing it with this value.
   */
  readonly studentCommitment: Uint8Array | undefined;

  /**
   * A readonly flag that determines if the current credential was issued by the current user.
   *
   * @remarks
   * The `issuer` property of the public (or ledger) state is the public key of the credential
   * issuer, while the `secretKey` property of {@link CourseCredentialPrivateState} is the
   * secret key of the current user. If `issuer` corresponds to the public key derived from
   * `secretKey`, then `isIssuer` is `true`.
   */
  readonly isIssuer: boolean;
};
