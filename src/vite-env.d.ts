/// <reference types="vite/client" />

/* vite/client declares lowercase asset extensions; a couple of the gym /
   volleyball clips use uppercase ".MOV", which TypeScript treats as a
   distinct module pattern, so it is declared explicitly here. */
declare module '*.MOV' {
  const src: string;
  export default src;
}

declare module '*.JPEG' {
  const src: string;
  export default src;
}
