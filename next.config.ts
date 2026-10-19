import type {NextConfig} from 'next';

const config:NextConfig={
 basePath:process.env.NEXT_PUBLIC_BASE_PATH||'',
 trailingSlash:process.env.VGM_PAGES_BUILD==='1',
};

export default config;
