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

import {
  type CircuitContext,
  QueryContext,
  sampleContractAddress,
  convertFieldToBytes,
  createConstructorContext,
  CostModel,
} from "@midnight-ntwrk/compact-runtime";
import {
  Contract,
  type Ledger,
  ledger,
} from "../managed/course-credential/contract/index.js";
import { type CourseCredentialPrivateState, witnesses } from "../witnesses.js";

/**
 * Serves as a testbed to exercise the contract in tests
 */
export class CourseCredentialSimulator {
  readonly contract: Contract<CourseCredentialPrivateState>;
  circuitContext: CircuitContext<CourseCredentialPrivateState>;

  constructor(secretKey: Uint8Array) {
    this.contract = new Contract<CourseCredentialPrivateState>(witnesses);
    const {
      currentPrivateState,
      currentContractState,
      currentZswapLocalState,
    } = this.contract.initialState(
      createConstructorContext({ secretKey }, "0".repeat(64)),
    );
    this.circuitContext = {
      currentPrivateState,
      currentZswapLocalState,
      costModel: CostModel.initialCostModel(),
      currentQueryContext: new QueryContext(
        currentContractState.data,
        sampleContractAddress(),
      ),
    };
  }

  /***
   * Switch to a different secret key for a different user
   *
   * TODO: is there a nicer abstraction for testing multi-user dApps?
   */
  public switchUser(secretKey: Uint8Array) {
    this.circuitContext.currentPrivateState = {
      secretKey,
    };
  }

  public getLedger(): Ledger {
    return ledger(this.circuitContext.currentQueryContext.state);
  }

  public getPrivateState(): CourseCredentialPrivateState {
    return this.circuitContext.currentPrivateState;
  }

  public issueCredential(
    course: string,
    studentId: Uint8Array,
    salt: Uint8Array,
  ): Ledger {
    // Update the current context to be the result of executing the circuit.
    this.circuitContext = this.contract.impureCircuits.issueCredential(
      this.circuitContext,
      course,
      studentId,
      salt,
    ).context;
    return ledger(this.circuitContext.currentQueryContext.state);
  }

  public revokeCredential(): string {
    const { context, result } = this.contract.impureCircuits.revokeCredential(
      this.circuitContext,
    );
    this.circuitContext = context;
    return result;
  }

  public commit(studentId: Uint8Array, salt: Uint8Array): Uint8Array {
    return this.contract.circuits.commit(this.circuitContext, studentId, salt)
      .result;
  }

  public publicKey(): Uint8Array {
    const sequence = convertFieldToBytes(
      32,
      this.getLedger().sequence,
      "course-credential-simulator.ts",
    );
    return this.contract.circuits.publicKey(
      this.circuitContext,
      this.getPrivateState().secretKey,
      sequence,
    ).result;
  }
}
