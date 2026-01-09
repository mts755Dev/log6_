/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL: string;
  readonly VITE_SUPABASE_ANON_KEY: string;
  readonly VITE_SUPABASE_SERVICE_ROLE_KEY: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

declare module '*.css' {
  const content: { [className: string]: string };
  export default content;
}


interface ImportMeta {
  readonly env: ImportMetaEnv;
}

declare module '*.css' {
  const content: { [className: string]: string };
  export default content;
}


interface ImportMeta {
  readonly env: ImportMetaEnv;
}

declare module '*.css' {
  const content: { [className: string]: string };
  export default content;
}

