export type RsdMessage =
  | { type: 'save-current-as'; url: string }
  | { type: 'capture-url'; url: string }
  | { type: 'thumbnail-updated'; urls: string[] };

export interface RsdResponse {
  ok: boolean;
  error?: string;
}
