export type RsdMessage =
  | { type: 'save-current-as'; url: string }
  | { type: 'capture-url'; url: string };

export interface RsdResponse {
  ok: boolean;
  error?: string;
}
