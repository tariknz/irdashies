export const platform = {
  openFile: async (): Promise<void> => {
    try {
      if (window.electron) {
        await window.electron.openFile();
      } else {
        console.warn("Electron API not available in browser");
      }
    } catch (error) {
      console.error("Error while opening file:", error);
      throw error;
    }
  }
};