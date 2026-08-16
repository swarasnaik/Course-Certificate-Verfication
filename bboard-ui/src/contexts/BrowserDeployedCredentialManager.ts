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
  CourseCredentialAPI,
  type CourseCredentialCircuitKeys,
  type CourseCredentialProviders,
  type DeployedCourseCredentialAPI,
} from '../../../api/src/index';
import { type ContractAddress } from '@midnight-ntwrk/midnight-js-protocol/compact-runtime';
import { fromHex, toHex } from '@midnight-ntwrk/midnight-js-utils';
import {
  BehaviorSubject,
  filter,
  firstValueFrom,
  interval,
  map,
  type Observable,
  take,
  tap,
  throwError,
  timeout,
} from 'rxjs';
import { pipe as fnPipe } from 'fp-ts/function';
import { type Logger } from 'pino';
import { ConnectedAPI, ErrorCodes, type APIError, type InitialAPI } from '@midnight-ntwrk/dapp-connector-api';
import { FetchZkConfigProvider } from '@midnight-ntwrk/midnight-js-fetch-zk-config-provider';
import { httpClientProofProvider } from '@midnight-ntwrk/midnight-js-http-client-proof-provider';
import { indexerPublicDataProvider } from '@midnight-ntwrk/midnight-js-indexer-public-data-provider';
import semver from 'semver';
import {
  Binding,
  FinalizedTransaction,
  Proof,
  SignatureEnabled,
  Transaction,
  TransactionId,
} from '@midnight-ntwrk/midnight-js-protocol/ledger';
import type { CourseCredentialPrivateState } from '@midnight-ntwrk/bboard-contract';
import { inMemoryPrivateStateProvider } from '../in-memory-private-state-provider';
import { NetworkId } from '@midnight-ntwrk/midnight-js-network-id';
import type { UnboundTransaction } from '@midnight-ntwrk/midnight-js-types';

/**
 * An in-progress course completion credential deployment.
 */
export interface InProgressCredentialDeployment {
  readonly status: 'in-progress';
}

/**
 * A deployed course completion credential deployment.
 */
export interface DeployedCredentialDeployment {
  readonly status: 'deployed';

  /**
   * The {@link DeployedCourseCredentialAPI} instance when connected to an on network course
   * completion credential contract.
   */
  readonly api: DeployedCourseCredentialAPI;
}

/**
 * A failed course completion credential deployment.
 */
export interface FailedCredentialDeployment {
  readonly status: 'failed';

  /**
   * The error that caused the deployment to fail.
   */
  readonly error: Error;
}

/**
 * A course completion credential deployment.
 */
export type CredentialDeployment =
  InProgressCredentialDeployment | DeployedCredentialDeployment | FailedCredentialDeployment;

/**
 * Provides access to course completion credential deployments.
 */
export interface DeployedCredentialAPIProvider {
  /**
   * Gets the observable set of credential deployments.
   *
   * @remarks
   * This property represents an observable array of {@link CredentialDeployment}, each also an
   * observable. Changes to the array will be emitted as credentials are resolved (deployed or
   * joined), while changes to each underlying credential can be observed via each item in the array.
   */
  readonly credentialDeployments$: Observable<Array<Observable<CredentialDeployment>>>;

  /**
   * Joins or deploys a course completion credential contract.
   *
   * @param contractAddress An optional contract address to use when resolving.
   * @returns An observable credential deployment.
   *
   * @remarks
   * For a given `contractAddress`, the method will attempt to find and join the identified course
   * completion credential contract; otherwise it will attempt to deploy a new one.
   */
  readonly resolve: (contractAddress?: ContractAddress) => Observable<CredentialDeployment>;
}

/**
 * A {@link DeployedCredentialAPIProvider} that manages course completion credential deployments in a
 * browser setting.
 *
 * @remarks
 * {@link BrowserDeployedCredentialManager} configures and manages a connection to the Midnight Lace
 * wallet, along with a collection of additional providers that work in a web-browser setting.
 */
export class BrowserDeployedCredentialManager implements DeployedCredentialAPIProvider {
  readonly #credentialDeploymentsSubject: BehaviorSubject<Array<BehaviorSubject<CredentialDeployment>>>;
  #initializedProviders: Promise<CourseCredentialProviders> | undefined;

  /**
   * Initializes a new {@link BrowserDeployedCredentialManager} instance.
   *
   * @param logger The `pino` logger to for logging.
   */
  constructor(private readonly logger: Logger) {
    this.#credentialDeploymentsSubject = new BehaviorSubject<Array<BehaviorSubject<CredentialDeployment>>>([]);
    this.credentialDeployments$ = this.#credentialDeploymentsSubject;
  }

  /** @inheritdoc */
  readonly credentialDeployments$: Observable<Array<Observable<CredentialDeployment>>>;

  /** @inheritdoc */
  resolve(contractAddress?: ContractAddress): Observable<CredentialDeployment> {
    const deployments = this.#credentialDeploymentsSubject.value;
    let deployment = deployments.find(
      (deployment) =>
        deployment.value.status === 'deployed' && deployment.value.api.deployedContractAddress === contractAddress,
    );

    if (deployment) {
      return deployment;
    }

    deployment = new BehaviorSubject<CredentialDeployment>({
      status: 'in-progress',
    });

    if (contractAddress) {
      void this.joinDeployment(deployment, contractAddress);
    } else {
      void this.deployDeployment(deployment);
    }

    this.#credentialDeploymentsSubject.next([...deployments, deployment]);

    return deployment;
  }

  private getProviders(): Promise<CourseCredentialProviders> {
    // We use a cached `Promise` to hold the providers. This will:
    //
    // 1. Cache and re-use the providers (including the configured connector API), and
    // 2. Act as a synchronization point if multiple contract deploys or joins run concurrently.
    //    Concurrent calls to `getProviders()` will receive, and ultimately await, the same
    //    `Promise`.
    return this.#initializedProviders ?? (this.#initializedProviders = initializeProviders(this.logger));
  }

  private async deployDeployment(deployment: BehaviorSubject<CredentialDeployment>): Promise<void> {
    try {
      const providers = await this.getProviders();
      console.log('DEBUG: Starting contract deployment on Preview network...');
      const api = await CourseCredentialAPI.deploy(providers, this.logger);
      console.log('DEBUG: Contract deployment finalized successfully! Address:', api.deployedContractAddress);

      deployment.next({
        status: 'deployed',
        api,
      });
    } catch (error: unknown) {
      console.error('DEBUG: Contract deployment failed:', error);
      deployment.next({
        status: 'failed',
        error: error instanceof Error ? error : new Error(String(error)),
      });
    }
  }

  private async joinDeployment(
    deployment: BehaviorSubject<CredentialDeployment>,
    contractAddress: ContractAddress,
  ): Promise<void> {
    try {
      const providers = await this.getProviders();
      console.log('DEBUG: Joining contract at address:', contractAddress);
      const api = await CourseCredentialAPI.join(providers, contractAddress, this.logger);
      console.log('DEBUG: Contract joined successfully! Address:', api.deployedContractAddress);

      deployment.next({
        status: 'deployed',
        api,
      });
    } catch (error: unknown) {
      console.error('DEBUG: Joining contract failed:', error);
      deployment.next({
        status: 'failed',
        error: error instanceof Error ? error : new Error(String(error)),
      });
    }
  }
}

/** @internal */
const initializeProviders = async (logger: Logger): Promise<CourseCredentialProviders> => {
  console.log('DEBUG: Initializing providers for Preview network...');
  const networkId: NetworkId = 'preview';
  console.log('DEBUG: Wallet network set to:', networkId);
  const connectedAPI = await connectWallet(logger, 'preview');
  const zkConfigPath = window.location.origin;
  const keyMaterialProvider = new FetchZkConfigProvider<CourseCredentialCircuitKeys>(zkConfigPath, fetch.bind(window));
  const config = await connectedAPI.getConfiguration();
  console.log('DEBUG: Connected wallet configuration:', {
    networkId: config.networkId,
    indexerUri: config.indexerUri?.split('?')[0],
    proverServerUri: config.proverServerUri,
    substrateNodeUri: config.substrateNodeUri,
  });
  const inMemoryCourseCredentialPrivateStateProvider = inMemoryPrivateStateProvider<
    string,
    CourseCredentialPrivateState
  >();
  const shieldedAddresses = connectedShieldedAddresses ?? (await connectedAPI.getShieldedAddresses());
  return {
    privateStateProvider: inMemoryCourseCredentialPrivateStateProvider,
    zkConfigProvider: keyMaterialProvider,
    proofProvider: httpClientProofProvider(config.proverServerUri!, keyMaterialProvider),
    publicDataProvider: indexerPublicDataProvider(config.indexerUri, config.indexerWsUri),
    walletProvider: {
      getCoinPublicKey(): string {
        return shieldedAddresses.shieldedCoinPublicKey;
      },
      getEncryptionPublicKey(): string {
        return shieldedAddresses.shieldedEncryptionPublicKey;
      },
      balanceTx: async (tx: UnboundTransaction, ttl?: Date): Promise<FinalizedTransaction> => {
        try {
          logger.info({ tx, ttl }, 'Balancing transaction via wallet');
          const serializedTx = toHex(tx.serialize());
          const received = await connectedAPI.balanceUnsealedTransaction(serializedTx);
          return Transaction.deserialize<SignatureEnabled, Proof, Binding>(
            'signature',
            'proof',
            'binding',
            fromHex(received.tx),
          );
        } catch (e) {
          logger.error({ error: e }, 'Error balancing transaction via wallet');
          throw e;
        }
      },
    },
    midnightProvider: {
      submitTx: async (tx: FinalizedTransaction): Promise<TransactionId> => {
        await connectedAPI.submitTransaction(toHex(tx.serialize()));
        const txIdentifiers = tx.identifiers();
        const txId = txIdentifiers[0]; // Return the first transaction ID
        logger.info({ txIdentifiers }, 'Submitted transaction via wallet');
        return txId;
      },
    },
  };
};

/** @internal */
const getFirstCompatibleWallet = (): InitialAPI | undefined => {
  if (!window.midnight) return undefined;
  return Object.values(window.midnight).find(
    (wallet): wallet is InitialAPI =>
      !!wallet &&
      typeof wallet === 'object' &&
      'apiVersion' in wallet &&
      semver.satisfies(wallet.apiVersion, COMPATIBLE_CONNECTOR_API_VERSION),
  );
};

const COMPATIBLE_CONNECTOR_API_VERSION = '4.x';

/** The network id this application is configured for. */
const NETWORK_ID: NetworkId = 'preview';

/**
 * The state of the connection to the Midnight wallet, published for the connection UI.
 */
export interface WalletConnectionState {
  readonly status: 'disconnected' | 'connecting' | 'connected' | 'error';
  readonly networkId?: string;
  readonly address?: string;
  readonly connectorName?: string;
  readonly errorMessage?: string;
}

const walletConnectionSubject: BehaviorSubject<WalletConnectionState> = new BehaviorSubject<WalletConnectionState>({
  status: 'disconnected',
});

/**
 * An observable stream of {@link WalletConnectionState} updates, consumed by the wallet connection
 * UI to display the connected wallet address and any connection errors.
 */
export const walletConnection$: Observable<WalletConnectionState> = walletConnectionSubject;

let connectedAPI: ConnectedAPI | undefined;
let connectedShieldedAddresses: Awaited<ReturnType<ConnectedAPI['getShieldedAddresses']>> | undefined;

/** @internal */
const waitForWalletConnector = (logger: Logger): Promise<InitialAPI> =>
  firstValueFrom(
    fnPipe(
      interval(100),
      map(() => getFirstCompatibleWallet()),
      tap((connectorAPI) => {
        logger.info(connectorAPI, 'Check for wallet connector API');
      }),
      filter((connectorAPI): connectorAPI is InitialAPI => !!connectorAPI),
      tap((connectorAPI) => {
        logger.info(connectorAPI, 'Compatible wallet connector API found. Connecting.');
      }),
      take(1),
      timeout({
        first: 30_000,
        with: () =>
          throwError(() => {
            logger.error('Could not find wallet connector API');

            return new Error('Could not find Midnight Lace wallet. Extension installed?');
          }),
      }),
    ),
  );

/** @internal */
const describeWalletError = (error: unknown): Error => {
  if (typeof error === 'object' && error !== null && (error as { type?: string }).type === 'DAppConnectorAPIError') {
    const apiError = error as APIError;
    if (apiError.code === ErrorCodes.Rejected || apiError.code === ErrorCodes.PermissionRejected) {
      return new Error(
        'Wallet authorization was not granted. Please approve this application in your Midnight wallet and try again.',
      );
    }
    return new Error(apiError.reason || apiError.message);
  }
  return error instanceof Error ? error : new Error(String(error));
};

/**
 * Connects to the Midnight wallet on the configured network, requesting the user's authorization
 * in the wallet when required.
 *
 * @remarks
 * The connection is cached and shared with the credential providers, so that contract deploys and
 * joins reuse an existing authorization instead of prompting the wallet again.
 *
 * @param logger The `pino` logger to use.
 * @param networkId The network id to connect the wallet to; defaults to the configured network.
 * @returns The connected wallet API, once the user has authorized the application.
 * @throws An actionable error if the connector is missing, authorization is rejected, or the wallet
 * is connected to a different network.
 */
export const connectWallet = (logger: Logger, networkId: string = NETWORK_ID): Promise<ConnectedAPI> => {
  if (connectedAPI) {
    return Promise.resolve(connectedAPI);
  }

  walletConnectionSubject.next({ status: 'connecting', networkId });

  return (async () => {
    try {
      const connectorAPI = await waitForWalletConnector(logger);
      console.log('CONNECTING TO NETWORK:', networkId);
      const walletAPI = await connectorAPI.connect(networkId);
      const connectionStatus = await walletAPI.getConnectionStatus();
      logger.info(connectionStatus, 'Wallet connector API enabled status');

      if (connectionStatus.status !== 'connected' || connectionStatus.networkId !== networkId) {
        throw new Error(
          `Midnight wallet is connected to ${
            connectionStatus.status === 'connected' ? connectionStatus.networkId : 'no network'
          }; this application requires ${networkId}. Select ${networkId} in your Midnight wallet and try again.`,
        );
      }

      const shieldedAddresses = await walletAPI.getShieldedAddresses();
      connectedAPI = walletAPI;
      connectedShieldedAddresses = shieldedAddresses;
      walletConnectionSubject.next({
        status: 'connected',
        networkId,
        address: shieldedAddresses.shieldedAddress,
        connectorName: connectorAPI.name,
      });
      logger.info({ connectorName: connectorAPI.name, networkId }, 'Wallet connected');

      return walletAPI;
    } catch (error: unknown) {
      connectedAPI = undefined;
      connectedShieldedAddresses = undefined;
      const friendlyError = describeWalletError(error);
      logger.error({ error: friendlyError }, 'Unable to connect to wallet');
      walletConnectionSubject.next({
        status: 'error',
        networkId,
        errorMessage: friendlyError.message,
      });
      throw friendlyError;
    }
  })();
};

/**
 * Drops the application-side connection to the Midnight wallet.
 */
export const disconnectWallet = (): void => {
  connectedAPI = undefined;
  connectedShieldedAddresses = undefined;
  walletConnectionSubject.next({ status: 'disconnected' });
};
