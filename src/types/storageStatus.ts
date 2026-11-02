export interface StorageStatus {
  diskFull: boolean;
}

export interface StorageStatusBridge {
  onStatus(callback: (status: StorageStatus) => void): () => void;
}
