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

import { CourseCredentialSimulator } from "./course-credential-simulator.js";
import { setNetworkId } from "@midnight-ntwrk/midnight-js-network-id";
import { describe, it, expect } from "vitest";
import { randomBytes } from "./utils.js";
import { State } from "../managed/course-credential/contract/index.js";
import { toHex } from "@midnight-ntwrk/midnight-js-utils";

setNetworkId("undeployed");

const COURSE = "Introduction to Zero-Knowledge Proofs";
const ANOTHER_COURSE = "Smart Contracts on Midnight";

describe("CourseCredential smart contract", () => {
  it("generates initial ledger state deterministically", () => {
    const key = randomBytes(32);
    const simulator0 = new CourseCredentialSimulator(key);
    const simulator1 = new CourseCredentialSimulator(key);
    expect(simulator0.getLedger()).toEqual(simulator1.getLedger());
  });

  it("properly initializes ledger state and private state", () => {
    const key = randomBytes(32);
    const simulator = new CourseCredentialSimulator(key);
    const initialLedgerState = simulator.getLedger();
    expect(initialLedgerState.sequence).toEqual(1n);
    expect(initialLedgerState.course.is_some).toEqual(false);
    expect(initialLedgerState.course.value).toEqual("");
    expect(initialLedgerState.studentCommitment.is_some).toEqual(false);
    expect(initialLedgerState.studentCommitment.value).toEqual(
      new Uint8Array(32),
    );
    expect(initialLedgerState.issuer).toEqual(new Uint8Array(32));
    expect(initialLedgerState.state).toEqual(State.VACANT);
    const initialPrivateState = simulator.getPrivateState();
    expect(initialPrivateState).toEqual({ secretKey: key });
  });

  it("lets an issuer issue a credential", () => {
    const simulator = new CourseCredentialSimulator(randomBytes(32));
    const initialPrivateState = simulator.getPrivateState();
    const studentId = randomBytes(32);
    const salt = randomBytes(32);
    simulator.issueCredential(COURSE, studentId, salt);
    // the private ledger state shouldn't change
    expect(initialPrivateState).toEqual(simulator.getPrivateState());
    // And all the correct things should have been updated in the public ledger state
    const ledgerState = simulator.getLedger();
    expect(ledgerState.sequence).toEqual(1n);
    expect(ledgerState.course.is_some).toEqual(true);
    expect(ledgerState.course.value).toEqual(COURSE);
    expect(ledgerState.studentCommitment.is_some).toEqual(true);
    expect(ledgerState.issuer).toEqual(simulator.publicKey());
    expect(ledgerState.state).toEqual(State.ISSUED);
  });

  it("hides the student identifier: the ledger only stores a commitment", () => {
    const simulator = new CourseCredentialSimulator(randomBytes(32));
    const studentId = randomBytes(32);
    const salt = randomBytes(32);
    simulator.issueCredential(COURSE, studentId, salt);
    const ledgerState = simulator.getLedger();
    // The raw identifier must never appear in the public ledger state.
    expect(ledgerState.studentCommitment.value).not.toEqual(studentId);
    // And the stored commitment is exactly what the exported `commit` circuit computes.
    expect(ledgerState.studentCommitment.value).toEqual(
      simulator.commit(studentId, salt),
    );
    // The commitment for a different identifier differs.
    expect(simulator.commit(randomBytes(32), salt)).not.toEqual(
      ledgerState.studentCommitment.value,
    );
    // The commitment for the same identifier with a different salt differs.
    expect(simulator.commit(studentId, randomBytes(32))).not.toEqual(
      ledgerState.studentCommitment.value,
    );
  });

  it("lets an issuer revoke a credential", () => {
    const simulator = new CourseCredentialSimulator(randomBytes(32));
    const initialPrivateState = simulator.getPrivateState();
    const initialPublicKey = simulator.publicKey();
    simulator.issueCredential(COURSE, randomBytes(32), randomBytes(32));
    const revokedCourse = simulator.revokeCredential();
    // the private ledger state shouldn't change
    expect(initialPrivateState).toEqual(simulator.getPrivateState());
    // The revoke circuit returns the course that was revoked.
    expect(revokedCourse).toEqual(COURSE);
    // And all the correct things should have been updated in the public ledger state
    const ledgerState = simulator.getLedger();
    expect(ledgerState.sequence).toEqual(2n);
    expect(ledgerState.course.is_some).toEqual(false);
    expect(ledgerState.course.value).toEqual("");
    expect(ledgerState.studentCommitment.is_some).toEqual(false);
    // Technically the circuit doesn't clear the previous issuer
    expect(ledgerState.issuer).toEqual(initialPublicKey);
    expect(ledgerState.state).toEqual(State.VACANT);
  });

  it("lets an issuer issue another credential after revoking the first", () => {
    const simulator = new CourseCredentialSimulator(randomBytes(32));
    const initialPrivateState = simulator.getPrivateState();
    simulator.issueCredential(COURSE, randomBytes(32), randomBytes(32));
    simulator.revokeCredential();
    const studentId = randomBytes(32);
    const salt = randomBytes(32);
    simulator.issueCredential(ANOTHER_COURSE, studentId, salt);
    // the private ledger state shouldn't change
    expect(initialPrivateState).toEqual(simulator.getPrivateState());
    // And all the correct things should have been updated in the public ledger state
    const ledgerState = simulator.getLedger();
    expect(ledgerState.sequence).toEqual(2n);
    expect(ledgerState.course.is_some).toEqual(true);
    expect(ledgerState.course.value).toEqual(ANOTHER_COURSE);
    expect(ledgerState.studentCommitment.value).toEqual(
      simulator.commit(studentId, salt),
    );
    expect(ledgerState.state).toEqual(State.ISSUED);
  });

  it("lets a different user issue a credential after revoking the first", () => {
    const simulator = new CourseCredentialSimulator(randomBytes(32));
    simulator.issueCredential(COURSE, randomBytes(32), randomBytes(32));
    simulator.revokeCredential();
    simulator.switchUser(randomBytes(32));
    const studentId = randomBytes(32);
    const salt = randomBytes(32);
    simulator.issueCredential(ANOTHER_COURSE, studentId, salt);
    const ledgerState = simulator.getLedger();
    expect(ledgerState.sequence).toEqual(2n);
    expect(ledgerState.course.is_some).toEqual(true);
    expect(ledgerState.course.value).toEqual(ANOTHER_COURSE);
    expect(ledgerState.issuer).toEqual(simulator.publicKey());
    expect(ledgerState.state).toEqual(State.ISSUED);
  });

  it("doesn't let the same issuer issue twice", () => {
    const simulator = new CourseCredentialSimulator(randomBytes(32));
    simulator.issueCredential(COURSE, randomBytes(32), randomBytes(32));
    expect(() =>
      simulator.issueCredential(
        ANOTHER_COURSE,
        randomBytes(32),
        randomBytes(32),
      ),
    ).toThrow(
      "failed assert: Attempted to issue a credential while one is already active",
    );
  });

  it("doesn't let different users issue twice", () => {
    const simulator = new CourseCredentialSimulator(randomBytes(32));
    simulator.issueCredential(COURSE, randomBytes(32), randomBytes(32));
    simulator.switchUser(randomBytes(32));
    expect(() =>
      simulator.issueCredential(
        ANOTHER_COURSE,
        randomBytes(32),
        randomBytes(32),
      ),
    ).toThrow(
      "failed assert: Attempted to issue a credential while one is already active",
    );
  });

  it("doesn't let users revoke someone else's credential", () => {
    const simulator = new CourseCredentialSimulator(randomBytes(32));
    simulator.issueCredential(COURSE, randomBytes(32), randomBytes(32));
    simulator.switchUser(randomBytes(32));
    expect(() => simulator.revokeCredential()).toThrow(
      "failed assert: Attempted to revoke a credential, but not the current issuer",
    );
  });

  it("lets a verifier check a credential using the issuer's commitment", () => {
    const issuer = new CourseCredentialSimulator(randomBytes(32));
    const studentId = randomBytes(32);
    const salt = randomBytes(32);
    issuer.issueCredential(COURSE, studentId, salt);

    // A verifier holds no secret key of its own, but can recompute the on-chain
    // commitment from the identifier and salt that the student reveals to it.
    const verifier = new CourseCredentialSimulator(randomBytes(32));
    const onChainCommitment = issuer.getLedger().studentCommitment.value;
    const revealedCommitment = verifier.commit(studentId, salt);

    expect(toHex(onChainCommitment)).toEqual(toHex(revealedCommitment));
  });
});
