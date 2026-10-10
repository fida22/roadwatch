import { MOCK } from '@/lib/api';
export default function MockBanner(){return MOCK?<p className="bg-amber-100 px-4 py-1 text-xs">Using mock data from /lib/mock. Set NEXT_PUBLIC_USE_MOCK=false to call the real API.</p>:null;}
