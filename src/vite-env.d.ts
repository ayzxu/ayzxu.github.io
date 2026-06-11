/// <reference types="vite/client" />

/* vite/client declares lowercase asset extensions; uppercase variants are
   distinct module patterns to TypeScript, so they're declared explicitly. */
declare module '*.JPEG' {
  const src: string;
  export default src;
}
