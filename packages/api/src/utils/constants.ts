
// Mesh API version
export const MESH_VERSION = '1.4.15';

const enum StacksNetworkId {
  mainnet = 0x00000001,
  testnet = 0x80000000,
}
export function getStacksNetwork(networkId: number): 'mainnet' | 'testnet' {
  switch (networkId) {
    case StacksNetworkId.mainnet:
      return 'mainnet';
    case StacksNetworkId.testnet:
      return 'testnet';
    default:
      throw new Error(`Unknown network ID: ${networkId}`);
  }
}
