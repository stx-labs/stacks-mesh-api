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

export class StacksRpcError extends Error {
  constructor(
    message: string,
    public statusCode: number,
    public responseBody?: string
  ) {
    super(message);
    this.name = 'StacksRpcError';
  }
}
