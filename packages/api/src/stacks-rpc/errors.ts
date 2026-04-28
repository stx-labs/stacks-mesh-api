export class StacksRpcBlockNotFoundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'StacksRpcBlockNotFoundError';
  }
}

export class StacksRpcTransactionNotFoundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'StacksRpcTransactionNotFoundError';
  }
}

export class StacksRpcSmartContractError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'StacksRpcSmartContractClarityError';
  }
}
