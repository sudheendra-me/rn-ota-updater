// Type stubs for peer dependencies that won't be available during development
declare module 'react-native' {
  export interface Platform {
    OS: 'ios' | 'android' | 'windows' | 'macos' | 'web';
  }
  export const Platform: Platform;
}

declare module 'react-native/Libraries/Image/resolveAssetSource' {
  export function setCustomSourceTransformer(transformer: (resolver: any) => any): void;
}

declare module 'react-native-fs' {
  export const DocumentDirectoryPath: string;
  export function exists(path: string): Promise<boolean>;
  export function unlink(path: string): Promise<void>;
  export function mkdir(path: string): Promise<string>;
  export function moveFile(source: string, dest: string): Promise<void>;
  export function hash(path: string, algorithm: string): Promise<string>;
  export function stat(path: string): Promise<any>;
  export function writeFile(path: string, content: string, encoding?: string): Promise<void>;
  export function readFile(path: string, encoding?: string): Promise<string>;
  export function downloadFile(config: any): { promise: Promise<any> };
  export function getFSInfo(): Promise<any>;
}

declare module 'react-native-zip-archive' {
  export function unzip(source: string, dest: string): Promise<void>;
}
